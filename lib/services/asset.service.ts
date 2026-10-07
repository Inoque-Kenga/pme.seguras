import { z } from "zod";
import { AssetStatus, AssetType, Criticality, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

/** Apenas estes papéis podem criar/editar ativos (ver secção de regras da fase). */
export const ASSET_EDITOR_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canEditAssets(role: string): boolean {
  return ASSET_EDITOR_ROLES.includes(role);
}

const ipSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,3}){3}$/, "Endereço IP inválido.")
  .optional()
  .or(z.literal(""));

export const assetInputSchema = z.object({
  name: z.string().trim().min(2, "Indique o nome do ativo.").max(160),
  type: z.nativeEnum(AssetType),
  marcaModelo: z.string().trim().max(160).optional().or(z.literal("")),
  numeroSerie: z.string().trim().max(80).optional().or(z.literal("")),
  sistemaOperativo: z.string().trim().max(120).optional().or(z.literal("")),
  ip: ipSchema,
  location: z.string().trim().max(160).optional().or(z.literal("")),
  owner: z.string().trim().max(120).optional().or(z.literal("")),
  criticality: z.nativeEnum(Criticality),
  status: z.nativeEnum(AssetStatus),
  protecaoEndpoint: z.coerce.boolean(),
  ultimaAtualizacao: z.string().optional().or(z.literal("")),
  mfaAplicavel: z.coerce.boolean(),
  cifragem: z.coerce.boolean(),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

export type AssetListParams = {
  search?: string;
  type?: AssetType;
  criticality?: Criticality;
  status?: AssetStatus;
  protecaoEndpoint?: boolean;
  cifragem?: boolean;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;
const STALE_DAYS = 30;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

function buildWhere(organizationId: string, params: AssetListParams): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = { organizationId, archivedAt: null };
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { marcaModelo: { contains: params.search, mode: "insensitive" } },
      { numeroSerie: { contains: params.search, mode: "insensitive" } },
      { owner: { contains: params.search, mode: "insensitive" } },
    ];
  }
  if (params.type) where.type = params.type;
  if (params.criticality) where.criticality = params.criticality;
  if (params.status) where.status = params.status;
  if (params.protecaoEndpoint !== undefined) where.protecaoEndpoint = params.protecaoEndpoint;
  if (params.cifragem !== undefined) where.cifragem = params.cifragem;
  return where;
}

/** Lista ativos da organização com pesquisa, filtros e paginação. */
export async function listAssets(organizationId: string, params: AssetListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const where = buildWhere(organizationId, params);

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ criticality: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.asset.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Opções para selects de ativos (ex.: associação em riscos). */
export async function listAssetOptions(organizationId: string) {
  return prisma.asset.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Indicadores do topo da página de ativos. */
export async function getAssetIndicators(organizationId: string, now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const base = { organizationId, archivedAt: null };

  const [total, critical, withoutEndpoint, stale, withoutEncryption] = await Promise.all([
    prisma.asset.count({ where: base }),
    prisma.asset.count({ where: { ...base, criticality: "CRITICAL" } }),
    prisma.asset.count({ where: { ...base, protecaoEndpoint: false } }),
    prisma.asset.count({
      where: { ...base, OR: [{ ultimaAtualizacao: null }, { ultimaAtualizacao: { lt: staleBefore } }] },
    }),
    prisma.asset.count({ where: { ...base, cifragem: false } }),
  ]);

  return { total, critical, withoutEndpoint, stale, withoutEncryption, staleDays: STALE_DAYS };
}

/** Detalhe de um ativo com registos associados (só leitura). */
export async function getAssetDetail(organizationId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId },
    include: {
      risks: { orderBy: { createdAt: "desc" }, take: 10 },
      tickets: { orderBy: { createdAt: "desc" }, take: 10, include: { createdBy: { select: { name: true } } } },
      incidents: { orderBy: { detectedAt: "desc" }, take: 10 },
    },
  });
  return asset;
}

function toAssetData(input: AssetInput) {
  return {
    name: input.name,
    type: input.type,
    marcaModelo: input.marcaModelo || null,
    numeroSerie: input.numeroSerie || null,
    sistemaOperativo: input.sistemaOperativo || null,
    ip: input.ip || null,
    location: input.location || null,
    owner: input.owner || null,
    criticality: input.criticality,
    status: input.status,
    protecaoEndpoint: input.protecaoEndpoint,
    ultimaAtualizacao: input.ultimaAtualizacao ? new Date(input.ultimaAtualizacao) : null,
    mfaAplicavel: input.mfaAplicavel,
    cifragem: input.cifragem,
    description: input.description || null,
  };
}

export async function createAsset(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canEditAssets(ctx.role)) return err("FORBIDDEN", "O seu papel não permite registar ativos.");

  const parsed = assetInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const asset = await prisma.asset.create({
    data: { organizationId: ctx.organization.id, ...toAssetData(parsed.data) },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "asset",
    resourceId: asset.id,
  });
  return ok({ id: asset.id });
}

export async function updateAsset(
  ctx: OrganizationContext,
  actorId: string,
  assetId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditAssets(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar ativos.");

  const parsed = assetInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { organizationId: true, archivedAt: true } });
  if (!asset || asset.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Ativo não encontrado.");
  if (asset.archivedAt) return err("CONFLICT", "Não é possível editar um ativo arquivado.");

  await prisma.asset.update({ where: { id: assetId }, data: toAssetData(parsed.data) });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "asset",
    resourceId: assetId,
  });
  return ok(undefined);
}

/** Arquivamento (soft delete) de um ativo. */
export async function archiveAsset(ctx: OrganizationContext, actorId: string, assetId: string): Promise<Result> {
  if (!canEditAssets(ctx.role)) return err("FORBIDDEN", "O seu papel não permite arquivar ativos.");

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { organizationId: true, archivedAt: true } });
  if (!asset || asset.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Ativo não encontrado.");
  if (asset.archivedAt) return err("CONFLICT", "O ativo já está arquivado.");

  await prisma.asset.update({ where: { id: assetId }, data: { archivedAt: new Date() } });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "asset",
    resourceId: assetId,
    metadata: { arquivado: true },
  });
  return ok(undefined);
}

/** Dados para exportação CSV (campos essenciais). */
export async function listAssetsForExport(organizationId: string, params: AssetListParams = {}) {
  const where = buildWhere(organizationId, params);
  return prisma.asset.findMany({
    where,
    select: {
      name: true,
      type: true,
      criticality: true,
      status: true,
      protecaoEndpoint: true,
      cifragem: true,
    },
    orderBy: { name: "asc" },
    take: 5000,
  });
}
