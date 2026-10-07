import { z } from "zod";
import { Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import { computeOrganizationScore, getPreviousMonthScore } from "@/lib/services/security-score.service";
import { backupSemaphore } from "@/lib/services/backup.service";
import { effectiveCompletionState } from "@/lib/services/training.service";
import { KEY_POLICY_CATEGORIES } from "@/lib/services/policy.service";
import {
  buildExecutiveSummary,
  buildRecommendedActions,
  type ReportContentInput,
} from "@/lib/report-content";
import type { OrganizationContext } from "@/lib/current-organization";

export const REPORT_MANAGER_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canManageReports(role: string): boolean {
  return REPORT_MANAGER_ROLES.includes(role);
}

export const generateReportSchema = z.object({
  mesReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Indique o mês no formato AAAA-MM.")
    .refine((value) => {
      const [year, month] = value.split("-").map(Number);
      return month >= 1 && month <= 12 && year >= 2020 && year <= 2100;
    }, "Mês inválido."),
});

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export function firstDayOfMonth(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthRange(mesReferencia: Date) {
  const start = new Date(mesReferencia);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export async function listReports(
  organizationId: string,
  params: { mes?: string; status?: ReportStatus } = {},
) {
  const where: Prisma.SecurityReportWhereInput = { organizationId };
  if (params.mes) where.mesReferencia = firstDayOfMonth(params.mes);
  if (params.status) where.status = params.status;

  return prisma.securityReport.findMany({
    where,
    include: { geradoPor: { select: { name: true } } },
    orderBy: { mesReferencia: "desc" },
    take: 36,
  });
}

export async function getReport(organizationId: string, reportId: string) {
  return prisma.securityReport.findFirst({
    where: { id: reportId, organizationId },
    include: {
      geradoPor: { select: { name: true } },
      organization: { select: { name: true, sector: true, city: true } },
    },
  });
}

/** Gera (ou regenera) o relatório mensal da organização. */
export async function generateReport(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canManageReports(ctx.role)) return err("FORBIDDEN", "O seu papel não permite gerar relatórios.");

  const parsed = generateReportSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const mesReferencia = firstDayOfMonth(parsed.data.mesReferencia);
  const { start, end } = monthRange(mesReferencia);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const organizationId = ctx.organization.id;

  const [score, previous, risks, backupJobs, tickets, incidents, completions, members, keyPolicies] =
    await Promise.all([
      computeOrganizationScore(organizationId),
      getPreviousMonthScore(organizationId),
      prisma.risk.findMany({
        where: { organizationId, riskLevel: { in: ["CRITICO", "ALTO"] }, status: { in: ["ABERTO", "EM_TRATAMENTO"] } },
        include: { owner: { select: { name: true } } },
        orderBy: { level: "desc" },
        take: 15,
      }),
      prisma.backupJob.findMany({ where: { organizationId } }),
      prisma.ticket.findMany({
        where: { organizationId, createdAt: { lt: end } },
        select: { status: true, priority: true, createdAt: true, slaHoras: true },
      }),
      prisma.incident.findMany({
        where: { organizationId, detectedAt: { gte: start, lt: end } },
        select: { type: true, severity: true, status: true },
      }),
      prisma.trainingCompletion.findMany({
        where: { trainingAssignment: { organizationId } },
        select: { userId: true, estado: true, validoAte: true },
      }),
      prisma.organizationMembership.count({
        where: { organizationId, status: "ACTIVE", user: { isActive: true } },
      }),
      prisma.securityPolicy.count({
        where: { organizationId, status: "PUBLICADA", category: { in: KEY_POLICY_CATEGORIES } },
      }),
    ]);

  // Backups
  const backupSummary = {
    total: backupJobs.length,
    sucesso: backupJobs.filter((job) => job.estado === "SUCESSO").length,
    falha: backupJobs.filter((job) => job.estado === "FALHA").length,
    aviso: backupJobs.filter((job) => job.estado === "AVISO").length,
    desconhecido: backupJobs.filter((job) => job.estado === "DESCONHECIDO").length,
    semTesteRecente: backupJobs.filter(
      (job) => !job.ultimoTesteRestauracao || job.ultimoTesteRestauracao < thirtyDaysAgo,
    ).length,
    semaforos: backupJobs.map((job) => ({
      sistemaAtivo: job.sistemaAtivo,
      semaforo: backupSemaphore(job, now),
      ultimaExecucao: job.ultimaExecucao,
    })),
  };

  // Tickets
  const openStatuses = ["ABERTO", "EM_ANALISE", "EM_ANDAMENTO", "AGUARDA_CLIENTE"];
  const openTickets = tickets.filter((ticket) => openStatuses.includes(ticket.status));
  const overdueTickets = openTickets.filter(
    (ticket) => ticket.slaHoras && now.getTime() > ticket.createdAt.getTime() + ticket.slaHoras * 60 * 60 * 1000,
  );
  const ticketSummary = {
    abertos: openTickets.length,
    vencidos: overdueTickets.length,
    resolvidosNoMes: tickets.filter(
      (ticket) => ["RESOLVIDO", "FECHADO"].includes(ticket.status) && ticket.createdAt >= start && ticket.createdAt < end,
    ).length,
    porPrioridade: ["URGENT", "HIGH", "MEDIUM", "LOW"].map((priority) => ({
      priority,
      count: openTickets.filter((ticket) => ticket.priority === priority).length,
    })),
  };

  // Incidentes
  const incidentSummary = {
    totalNoMes: incidents.length,
    criticos: incidents.filter((incident) => incident.severity === "CRITICAL").length,
    encerrados: incidents.filter((incident) => ["RECUPERADO", "ENCERRADO"].includes(incident.status)).length,
    porTipo: Object.entries(
      incidents.reduce<Record<string, number>>((acc, incident) => {
        acc[incident.type] = (acc[incident.type] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([type, count]) => ({ type, count })),
  };

  // Formações e políticas
  const validUsers = new Set(
    completions
      .filter((completion) => effectiveCompletionState(completion, now) === "CONCLUIDO")
      .map((completion) => completion.userId),
  ).size;
  const hasAssignments = await prisma.trainingAssignment.count({ where: { organizationId } });
  const trainingPolicies = {
    validPercent: hasAssignments === 0 || members === 0 ? null : Math.round((validUsers / members) * 100),
    validUsers,
    totalMembers: members,
    keyPolicies,
  };

  const contentInput: ReportContentInput = {
    organizationName: ctx.organization.name,
    mesReferencia,
    scoreGlobal: score.total,
    categoria: score.categoria,
    scoreVariation: previous ? score.total - previous.score : null,
    risks: risks.map((risk) => ({
      level: risk.level,
      riskLevel: risk.riskLevel,
      title: risk.title,
      status: risk.status,
      owner: risk.owner?.name ?? null,
      dueDate: risk.dueDate,
    })),
    backups: backupSummary,
    tickets: ticketSummary,
    incidents: incidentSummary,
    trainingPolicies,
  };

  const data = {
    scoreGlobal: score.total,
    categoria: score.categoria,
    resumoExecutivo: buildExecutiveSummary(contentInput),
    riscosCriticosAltos: contentInput.risks as unknown as Prisma.InputJsonValue,
    estadoBackups: {
      total: backupSummary.total,
      sucesso: backupSummary.sucesso,
      falha: backupSummary.falha,
      aviso: backupSummary.aviso,
      desconhecido: backupSummary.desconhecido,
      semTesteRecente: backupSummary.semTesteRecente,
      semaforos: backupSummary.semaforos.map((entry) => ({
        sistemaAtivo: entry.sistemaAtivo,
        semaforo: entry.semaforo,
        ultimaExecucao: entry.ultimaExecucao,
      })),
    } as unknown as Prisma.InputJsonValue,
    ticketsIncidentes: { tickets: ticketSummary, incidentes: incidentSummary } as unknown as Prisma.InputJsonValue,
    formacoesPoliticas: trainingPolicies as unknown as Prisma.InputJsonValue,
    acoesRecomendadas: buildRecommendedActions(contentInput) as unknown as Prisma.InputJsonValue,
  };

  const report = await prisma.securityReport.upsert({
    where: { organizationId_mesReferencia: { organizationId, mesReferencia } },
    update: { ...data, geradoPorId: actorId, dataGeracao: now },
    create: { organizationId, mesReferencia, ...data, geradoPorId: actorId },
  });

  await writeAuditLog({
    actorId,
    organizationId,
    action: "CREATE",
    resource: "security_report",
    resourceId: report.id,
    metadata: { mesReferencia: mesReferencia.toISOString().slice(0, 7), score: score.total },
  });
  return ok({ id: report.id });
}

export async function setReportStatus(
  ctx: OrganizationContext,
  actorId: string,
  reportId: string,
  status: Extract<ReportStatus, "PUBLICADO" | "ARQUIVADO" | "GERADO">,
): Promise<Result> {
  if (!canManageReports(ctx.role)) return err("FORBIDDEN", "O seu papel não permite gerir relatórios.");

  const existing = await prisma.securityReport.findUnique({ where: { id: reportId } });
  if (!existing || existing.organizationId !== ctx.organization.id) {
    return err("NOT_FOUND", "Relatório não encontrado.");
  }

  await prisma.securityReport.update({ where: { id: reportId }, data: { status } });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "security_report",
    resourceId: reportId,
    metadata: { status },
  });
  return ok(undefined);
}
