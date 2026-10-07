import { z } from "zod";
import { AssessmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

/** Papéis que podem criar/gerir avaliações de risco. */
export const ASSESSMENT_MANAGER_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canManageAssessments(role: string): boolean {
  return ASSESSMENT_MANAGER_ROLES.includes(role);
}

export const assessmentInputSchema = z.object({
  title: z.string().trim().min(3, "Indique o título da avaliação.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  domain: z.string().trim().max(120).optional().or(z.literal("")),
  ownerId: z.string().optional().or(z.literal("")),
  startDate: z.string().min(1, "Indique a data de início."),
  endDate: z.string().optional().or(z.literal("")),
  status: z.nativeEnum(AssessmentStatus),
});

export type AssessmentInput = z.infer<typeof assessmentInputSchema>;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

async function assertMember(userId: string, organizationId: string): Promise<boolean> {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return membership?.status === "ACTIVE";
}

export async function listAssessments(organizationId: string, status?: AssessmentStatus) {
  return prisma.riskAssessment.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    include: {
      owner: { select: { name: true } },
      _count: { select: { risks: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
}

export async function getAssessment(organizationId: string, assessmentId: string) {
  return prisma.riskAssessment.findFirst({
    where: { id: assessmentId, organizationId },
    include: {
      owner: { select: { id: true, name: true } },
      risks: {
        include: { asset: { select: { name: true } } },
        orderBy: [{ level: "desc" }, { createdAt: "desc" }],
      },
    },
  });
}

function toData(input: AssessmentInput) {
  return {
    title: input.title,
    description: input.description || null,
    domain: input.domain || null,
    ownerId: input.ownerId || null,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    status: input.status,
  };
}

export async function createAssessment(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canManageAssessments(ctx.role)) return err("FORBIDDEN", "O seu papel não permite gerir avaliações.");

  const parsed = assessmentInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  if (parsed.data.ownerId && !(await assertMember(parsed.data.ownerId, ctx.organization.id))) {
    return err("VALIDATION", "O responsável deve ser membro ativo desta organização.");
  }

  const assessment = await prisma.riskAssessment.create({
    data: { organizationId: ctx.organization.id, ...toData(parsed.data) },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "risk_assessment",
    resourceId: assessment.id,
  });
  return ok({ id: assessment.id });
}

export async function updateAssessment(
  ctx: OrganizationContext,
  actorId: string,
  assessmentId: string,
  input: unknown,
): Promise<Result> {
  if (!canManageAssessments(ctx.role)) return err("FORBIDDEN", "O seu papel não permite gerir avaliações.");

  const parsed = assessmentInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.riskAssessment.findUnique({
    where: { id: assessmentId },
    select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== ctx.organization.id) {
    return err("NOT_FOUND", "Avaliação não encontrada.");
  }

  if (parsed.data.ownerId && !(await assertMember(parsed.data.ownerId, ctx.organization.id))) {
    return err("VALIDATION", "O responsável deve ser membro ativo desta organização.");
  }

  await prisma.riskAssessment.update({ where: { id: assessmentId }, data: toData(parsed.data) });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "risk_assessment",
    resourceId: assessmentId,
  });
  return ok(undefined);
}

export async function setAssessmentStatus(
  ctx: OrganizationContext,
  actorId: string,
  assessmentId: string,
  status: AssessmentStatus,
): Promise<Result> {
  if (!canManageAssessments(ctx.role)) return err("FORBIDDEN", "O seu papel não permite gerir avaliações.");

  const existing = await prisma.riskAssessment.findUnique({
    where: { id: assessmentId },
    select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== ctx.organization.id) {
    return err("NOT_FOUND", "Avaliação não encontrada.");
  }

  await prisma.riskAssessment.update({
    where: { id: assessmentId },
    data: { status, endDate: status === "CONCLUIDA" ? new Date() : undefined },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "risk_assessment",
    resourceId: assessmentId,
    metadata: { status },
  });
  return ok(undefined);
}
