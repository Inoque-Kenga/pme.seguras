import { z } from "zod";
import { PhishingChannel, PhishingClassification, PhishingReportStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

/** Apenas o analista de segurança faz triagem de reports de phishing. */
export function canTriageReports(role: string): boolean {
  return role === "ANALISTA_SEGURANCA";
}

export const phishingReportSchema = z.object({
  canal: z.nativeEnum(PhishingChannel),
  remetente: z.string().trim().min(2, "Indique o remetente da mensagem.").max(254),
  assunto: z.string().trim().max(254).optional().or(z.literal("")),
  descricao: z.string().trim().min(5, "Descreva brevemente a mensagem suspeita.").max(2000),
  urlSuspeita: z.string().trim().max(500).optional().or(z.literal("")),
  classificacaoInicial: z.nativeEnum(PhishingClassification),
});

export type PhishingReportInput = z.infer<typeof phishingReportSchema>;

export type PhishingReportListParams = {
  estado?: PhishingReportStatus;
  classificacao?: PhishingClassification;
  page?: number;
  pageSize?: number;
};

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export async function listPhishingReports(organizationId: string, params: PhishingReportListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 12));

  const where: Prisma.PhishingReportWhereInput = { organizationId };
  if (params.estado) where.estado = params.estado;
  if (params.classificacao) where.classificacaoInicial = params.classificacao;

  const [items, total] = await Promise.all([
    prisma.phishingReport.findMany({
      where,
      include: { reportante: { select: { id: true, name: true } } },
      orderBy: [{ estado: "asc" }, { classificacaoInicial: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.phishingReport.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPhishingReport(organizationId: string, reportId: string) {
  return prisma.phishingReport.findFirst({
    where: { id: reportId, organizationId },
    include: {
      reportante: { select: { id: true, name: true } },
      tickets: { select: { id: true, title: true, status: true } },
      incidents: { select: { id: true, title: true, status: true } },
    },
  });
}

/** Qualquer membro da organização pode reportar uma mensagem suspeita. */
export async function createPhishingReport(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const limit = await checkRateLimit(
    `report-phish:${ctx.organization.id}:${actorId}`,
    RATE_LIMITS.report.maxAttempts,
    RATE_LIMITS.report.windowMs,
    { actorId, organizationId: ctx.organization.id, resource: "phishing_report" },
  );
  if (!limit.allowed) return err("VALIDATION", rateLimitMessage(limit));

  const parsed = phishingReportSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const report = await prisma.phishingReport.create({
    data: {
      organizationId: ctx.organization.id,
      canal: parsed.data.canal,
      remetente: parsed.data.remetente,
      assunto: parsed.data.assunto || null,
      descricao: parsed.data.descricao,
      urlSuspeita: parsed.data.urlSuspeita || null,
      classificacaoInicial: parsed.data.classificacaoInicial,
      reportanteId: actorId,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "phishing_report",
    resourceId: report.id,
    metadata: { canal: report.canal, classificacao: report.classificacaoInicial },
  });
  return ok({ id: report.id });
}

async function setReportState(
  ctx: OrganizationContext,
  actorId: string,
  reportId: string,
  estado: PhishingReportStatus,
  metadata?: Record<string, string>,
) {
  await prisma.phishingReport.update({ where: { id: reportId }, data: { estado } });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "phishing_report",
    resourceId: reportId,
    metadata: { estado, ...metadata },
  });
}

async function getTriageTarget(ctx: OrganizationContext, actorRole: string, reportId: string) {
  if (!canTriageReports(actorRole)) return { error: err("FORBIDDEN", "Apenas o analista de segurança pode fazer triagem.") };
  const report = await prisma.phishingReport.findUnique({ where: { id: reportId } });
  if (!report || report.organizationId !== ctx.organization.id) {
    return { error: err("NOT_FOUND", "Report não encontrado.") };
  }
  if (report.estado !== "NOVO" && report.estado !== "EM_ANALISE") {
    return { error: err("CONFLICT", "Este report já foi triado.") };
  }
  return { report };
}

export async function markReportInAnalysis(ctx: OrganizationContext, actorId: string, reportId: string): Promise<Result> {
  const { error } = await getTriageTarget(ctx, ctx.role, reportId);
  if (error) return error;
  await setReportState(ctx, actorId, reportId, "EM_ANALISE");
  return ok(undefined);
}

export async function markReportFalsePositive(ctx: OrganizationContext, actorId: string, reportId: string): Promise<Result> {
  const { error } = await getTriageTarget(ctx, ctx.role, reportId);
  if (error) return error;
  await setReportState(ctx, actorId, reportId, "FALSO_POSITIVO");
  return ok(undefined);
}

export async function convertReportToTicket(
  ctx: OrganizationContext,
  actorId: string,
  reportId: string,
): Promise<Result<{ ticketId: string }>> {
  const { report, error } = await getTriageTarget(ctx, ctx.role, reportId);
  if (error) return error;

  const ticket = await prisma.ticket.create({
    data: {
      organizationId: ctx.organization.id,
      title: `[Phishing] Mensagem suspeita de ${report.remetente}`,
      description: `Canal: ${report.canal}\nRemetente: ${report.remetente}\nAssunto: ${report.assunto ?? "—"}\n\n${report.descricao}`,
      category: "SUPORTE",
      priority: report.classificacaoInicial === "ALTA" ? "HIGH" : "MEDIUM",
      createdById: actorId,
      phishingReportId: report.id,
      events: { create: { tipo: "NOTA", descricao: "Ticket criado a partir de um report de phishing.", autorId: actorId } },
    },
  });
  await setReportState(ctx, actorId, report.id, "CONVERTIDO_TICKET", { ticketId: ticket.id });
  return ok({ ticketId: ticket.id });
}

export async function convertReportToIncident(
  ctx: OrganizationContext,
  actorId: string,
  reportId: string,
): Promise<Result<{ incidentId: string }>> {
  const { report, error } = await getTriageTarget(ctx, ctx.role, reportId);
  if (error) return error;

  const incident = await prisma.incident.create({
    data: {
      organizationId: ctx.organization.id,
      title: `Phishing reportado por colaborador (${report.remetente})`,
      description: `Canal: ${report.canal}\nRemetente: ${report.remetente}\nAssunto: ${report.assunto ?? "—"}\n\n${report.descricao}`,
      type: "PHISHING",
      severity: report.classificacaoInicial === "ALTA" ? "HIGH" : report.classificacaoInicial === "MEDIA" ? "MEDIUM" : "LOW",
      responsavelId: actorId,
      phishingReportId: report.id,
      timeline: { create: { tipo: "STATUS_CHANGE", descricao: "Incidente criado a partir de um report de phishing.", autorId: actorId } },
    },
  });
  await setReportState(ctx, actorId, report.id, "CONVERTIDO_INCIDENTE", { incidentId: incident.id });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "incident",
    resourceId: incident.id,
    metadata: { phishingReportId: report.id },
  });
  return ok({ incidentId: incident.id });
}
