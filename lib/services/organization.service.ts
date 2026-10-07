import { z } from "zod";
import { OrganizationSize, OrganizationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";

export const organizationInputSchema = z.object({
  name: z.string().trim().min(2, "Indique o nome da organização.").max(160),
  slug: z
    .string()
    .trim()
    .min(2, "Indique um identificador (slug).")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "O slug só pode conter letras minúsculas, números e hífenes."),
  nif: z.string().trim().max(20).optional().or(z.literal("")),
  sector: z.string().trim().max(120).optional().or(z.literal("")),
  dimensao: z.nativeEnum(OrganizationSize).optional(),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  provincia: z.string().trim().max(120).optional().or(z.literal("")),
  contactoNome: z.string().trim().max(120).optional().or(z.literal("")),
  contactoEmail: z
    .string()
    .trim()
    .email("E-mail de contacto inválido.")
    .max(254)
    .optional()
    .or(z.literal("")),
  contactoTelefone: z.string().trim().max(30).optional().or(z.literal("")),
  planoId: z.string().optional().or(z.literal("")),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;

export type OrganizationListParams = {
  search?: string;
  status?: OrganizationStatus;
  sector?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** Lista organizações com pesquisa, filtros e paginação (área de administração). */
export async function listOrganizations(params: OrganizationListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.OrganizationWhereInput = {};
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { slug: { contains: params.search, mode: "insensitive" } },
      { nif: { contains: params.search, mode: "insensitive" } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.sector) where.sector = { equals: params.sector, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        plano: { select: { name: true } },
        _count: { select: { memberships: true, assets: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listOrganizationSectors() {
  const rows = await prisma.organization.findMany({
    where: { sector: { not: null } },
    select: { sector: true },
    distinct: ["sector"],
    orderBy: { sector: "asc" },
  });
  return rows.map((row) => row.sector).filter((sector): sector is string => Boolean(sector));
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      plano: { select: { id: true, name: true } },
      _count: { select: { memberships: true, assets: true, risks: true, tickets: true, incidents: true } },
    },
  });
}

function toNullable(input: OrganizationInput) {
  return {
    nif: input.nif || null,
    sector: input.sector || null,
    dimensao: input.dimensao ?? null,
    city: input.city || null,
    provincia: input.provincia || null,
    contactoNome: input.contactoNome || null,
    contactoEmail: input.contactoEmail ? input.contactoEmail.toLowerCase() : null,
    contactoTelefone: input.contactoTelefone || null,
    planoId: input.planoId || null,
  };
}

/** Apenas SUPER_ADMIN pode criar organizações (verificado pelo chamador). */
export async function createOrganization(actorId: string, input: unknown): Promise<Result<{ id: string }>> {
  const parsed = organizationInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.organization.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return err("CONFLICT", "Já existe uma organização com este slug.");

  if (parsed.data.planoId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: parsed.data.planoId } });
    if (!plan) return err("VALIDATION", "Plano selecionado não existe.");
  }

  const organization = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      ...toNullable(parsed.data),
    },
  });

  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: actorId, organizationId: organization.id } },
    update: {},
    create: { userId: actorId, organizationId: organization.id, role: "SUPER_ADMIN" },
  });

  await writeAuditLog({
    actorId,
    organizationId: organization.id,
    action: "CREATE",
    resource: "organization",
    resourceId: organization.id,
  });
  return ok({ id: organization.id });
}

export async function updateOrganization(
  actorId: string,
  organizationId: string,
  input: unknown,
): Promise<Result> {
  const parsed = organizationInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return err("NOT_FOUND", "Organização não encontrada.");

  const slugTaken = await prisma.organization.findFirst({
    where: { slug: parsed.data.slug, id: { not: organizationId } },
  });
  if (slugTaken) return err("CONFLICT", "Já existe outra organização com este slug.");

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      ...toNullable(parsed.data),
    },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "UPDATE",
    resource: "organization",
    resourceId: organizationId,
  });
  return ok(undefined);
}

/** Arquivamento (soft delete): a organização e os dados não são apagados. */
export async function archiveOrganization(actorId: string, organizationId: string): Promise<Result> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return err("NOT_FOUND", "Organização não encontrada.");
  if (organization.status === "ARCHIVED") return err("CONFLICT", "A organização já está arquivada.");

  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: "ARCHIVED" },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "STATUS_CHANGE",
    resource: "organization",
    resourceId: organizationId,
    metadata: { status: "ARCHIVED" },
  });
  return ok(undefined);
}

export async function listActivePlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
