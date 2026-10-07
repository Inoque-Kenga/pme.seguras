import { z } from "zod";
import { Prisma, RiskLevel, RiskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import { computeRiskLevel } from "@/lib/risk-level";
import type { OrganizationContext } from "@/lib/current-organization";

/** Papéis que podem criar/editar riscos. */
export const RISK_EDITOR_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canEditRisks(role: string): boolean {
  return RISK_EDITOR_ROLES.includes(role);
}

const score15 = z.coerce.number().int().min(1, "Mínimo 1.").max(5, "Máximo 5.");

export const riskInputSchema = z.object({
  title: z.string().trim().min(3, "Indique o título do risco.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  assessmentId: z.string().optional().or(z.literal("")),
  assetId: z.string().optional().or(z.literal("")),
  threat: z.string().trim().max(1000).optional().or(z.literal("")),
  vulnerability: z.string().trim().max(1000).optional().or(z.literal("")),
  probability: score15,
  impact: score15,
  treatment: z.string().trim().max(4000).optional().or(z.literal("")),
  ownerId: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  status: z.nativeEnum(RiskStatus),
});

export type RiskInput = z.infer<typeof riskInputSchema>;

export type DueDateFilter = "vencidos" | "proximos7" | "sem_prazo";

export type RiskListParams = {
  riskLevel?: RiskLevel;
  status?: RiskStatus;
  ownerId?: string;
  assetId?: string;
  due?: DueDateFilter;
  search?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 12;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export function buildRiskWhere(organizationId: string, params: RiskListParams, now = new Date()): Prisma.RiskWhereInput {
  const where: Prisma.RiskWhereInput = { organizationId };
  if (params.riskLevel) where.riskLevel = params.riskLevel;
  if (params.status) where.status = params.status;
  if (params.ownerId) where.ownerId = params.ownerId;
  if (params.assetId) where.assetId = params.assetId;
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { threat: { contains: params.search, mode: "insensitive" } },
      { vulnerability: { contains: params.search, mode: "insensitive" } },
    ];
  }
  if (params.due === "vencidos") {
    where.dueDate = { lt: now };
    where.status = { in: ["ABERTO", "EM_TRATAMENTO"] };
  } else if (params.due === "proximos7") {
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    where.dueDate = { gte: now, lte: weekAhead };
    where.status = { in: ["ABERTO", "EM_TRATAMENTO"] };
  } else if (params.due === "sem_prazo") {
    where.dueDate = null;
  }
  return where;
}

const riskInclude = {
  asset: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  assessment: { select: { id: true, title: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.RiskInclude;

export async function listRisks(organizationId: string, params: RiskListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const where = buildRiskWhere(organizationId, params);

  const [items, total] = await Promise.all([
    prisma.risk.findMany({
      where,
      include: riskInclude,
      orderBy: [{ level: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.risk.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Todos os riscos não fechados (para matriz e kanban). */
export async function listOpenRisks(organizationId: string) {
  return prisma.risk.findMany({
    where: { organizationId, status: { notIn: ["FECHADO"] } },
    include: riskInclude,
    orderBy: [{ level: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}

/** Opções de riscos não fechados para selects (ex.: formulário de tarefas). */
export async function listRiskOptions(organizationId: string) {
  return prisma.risk.findMany({
    where: { organizationId, status: { notIn: ["FECHADO"] } },
    select: { id: true, title: true, riskLevel: true },
    orderBy: [{ level: "desc" }, { title: "asc" }],
  });
}

export async function getRisk(organizationId: string, riskId: string) {
  return prisma.risk.findFirst({
    where: { id: riskId, organizationId },
    include: {
      ...riskInclude,
      tasks: {
        include: { assignee: { select: { name: true } } },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
    },
  });
}

async function validateRelations(
  ctx: OrganizationContext,
  input: RiskInput,
): Promise<Result<never> | null> {
  if (input.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: input.assetId }, select: { organizationId: true } });
    if (!asset || asset.organizationId !== ctx.organization.id) return err("VALIDATION", "Ativo associado inválido.");
  }
  if (input.assessmentId) {
    const assessment = await prisma.riskAssessment.findUnique({
      where: { id: input.assessmentId },
      select: { organizationId: true },
    });
    if (!assessment || assessment.organizationId !== ctx.organization.id) {
      return err("VALIDATION", "Avaliação associada inválida.");
    }
  }
  if (input.ownerId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: input.ownerId, organizationId: ctx.organization.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      return err("VALIDATION", "O responsável deve ser membro ativo desta organização.");
    }
  }
  return null;
}

function toData(input: RiskInput) {
  const { level, riskLevel } = computeRiskLevel(input.probability, input.impact);
  return {
    title: input.title,
    description: input.description || null,
    assessmentId: input.assessmentId || null,
    assetId: input.assetId || null,
    threat: input.threat || null,
    vulnerability: input.vulnerability || null,
    probability: input.probability,
    impact: input.impact,
    level,
    riskLevel,
    treatment: input.treatment || null,
    ownerId: input.ownerId || null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    status: input.status,
  };
}

export async function createRisk(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canEditRisks(ctx.role)) return err("FORBIDDEN", "O seu papel não permite registar riscos.");

  const parsed = riskInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const invalid = await validateRelations(ctx, parsed.data);
  if (invalid) return invalid;

  const risk = await prisma.risk.create({
    data: { organizationId: ctx.organization.id, ...toData(parsed.data) },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "risk",
    resourceId: risk.id,
    metadata: { level: risk.level, riskLevel: risk.riskLevel },
  });
  return ok({ id: risk.id });
}

export async function updateRisk(
  ctx: OrganizationContext,
  actorId: string,
  riskId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditRisks(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar riscos.");

  const parsed = riskInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.risk.findUnique({ where: { id: riskId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Risco não encontrado.");

  const invalid = await validateRelations(ctx, parsed.data);
  if (invalid) return invalid;

  const data = toData(parsed.data);
  await prisma.risk.update({ where: { id: riskId }, data });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "risk",
    resourceId: riskId,
    metadata: { level: data.level, riskLevel: data.riskLevel },
  });
  return ok(undefined);
}

export async function setRiskStatus(
  ctx: OrganizationContext,
  actorId: string,
  riskId: string,
  status: RiskStatus,
): Promise<Result> {
  if (!canEditRisks(ctx.role)) return err("FORBIDDEN", "O seu papel não permite alterar riscos.");

  const existing = await prisma.risk.findUnique({ where: { id: riskId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Risco não encontrado.");

  await prisma.risk.update({ where: { id: riskId }, data: { status } });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "risk",
    resourceId: riskId,
    metadata: { status },
  });
  return ok(undefined);
}

/** Contagens por célula da matriz 5×5 (probabilidade × impacto), riscos não fechados. */
export function buildMatrix(risks: { probability: number; impact: number }[]) {
  const matrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const risk of risks) {
    const p = Math.min(5, Math.max(1, risk.probability));
    const i = Math.min(5, Math.max(1, risk.impact));
    matrix[p - 1][i - 1] += 1;
  }
  return matrix;
}
