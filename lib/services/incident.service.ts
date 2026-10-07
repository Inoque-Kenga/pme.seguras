import { z } from "zod";
import { IncidentSeverity, IncidentStatus, IncidentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

export const INCIDENT_EDITOR_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canEditIncidents(role: string): boolean {
  return INCIDENT_EDITOR_ROLES.includes(role);
}

export const incidentInputSchema = z.object({
  title: z.string().trim().min(3, "Indique o título do incidente.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  type: z.nativeEnum(IncidentType),
  severity: z.nativeEnum(IncidentSeverity),
  detectedAt: z.string().min(1, "Indique a data e hora da ocorrência."),
  sistemasAfetados: z.string().trim().max(2000).optional().or(z.literal("")),
  acoesImediatas: z.string().trim().max(4000).optional().or(z.literal("")),
  licoesAprendidas: z.string().trim().max(4000).optional().or(z.literal("")),
  responsavelId: z.string().optional().or(z.literal("")),
  assetId: z.string().optional().or(z.literal("")),
  status: z.nativeEnum(IncidentStatus),
});

export type IncidentInput = z.infer<typeof incidentInputSchema>;

export const timelineEventSchema = z.object({
  tipo: z.enum(["ACAO", "NOTA"]),
  descricao: z.string().trim().min(2, "Descreva o evento.").max(2000),
});

export type IncidentListParams = {
  type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  page?: number;
  pageSize?: number;
};

export const OPEN_INCIDENT_STATUSES: IncidentStatus[] = ["REPORTADO", "EM_ANALISE", "CONTIDO", "ERRADICADO"];

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export async function listIncidents(organizationId: string, params: IncidentListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 12));

  const where: Prisma.IncidentWhereInput = { organizationId };
  if (params.type) where.type = params.type;
  if (params.severity) where.severity = params.severity;
  if (params.status) where.status = params.status;

  const [items, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: { responsavel: { select: { id: true, name: true } }, _count: { select: { timeline: true, tickets: true } } },
      orderBy: [{ status: "asc" }, { severity: "desc" }, { detectedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.incident.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getIncident(organizationId: string, incidentId: string) {
  return prisma.incident.findFirst({
    where: { id: incidentId, organizationId },
    include: {
      responsavel: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true } },
      phishingReport: { select: { id: true, remetente: true } },
      timeline: {
        include: { autor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      tickets: {
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

async function validateRelations(ctx: OrganizationContext, input: IncidentInput): Promise<Result<never> | null> {
  if (input.responsavelId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: input.responsavelId, organizationId: ctx.organization.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      return err("VALIDATION", "O responsável deve ser membro ativo desta organização.");
    }
  }
  if (input.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: input.assetId }, select: { organizationId: true } });
    if (!asset || asset.organizationId !== ctx.organization.id) return err("VALIDATION", "Ativo associado inválido.");
  }
  return null;
}

function toData(input: IncidentInput) {
  return {
    title: input.title,
    description: input.description || null,
    type: input.type,
    severity: input.severity,
    detectedAt: new Date(input.detectedAt),
    sistemasAfetados: input.sistemasAfetados || null,
    acoesImediatas: input.acoesImediatas || null,
    licoesAprendidas: input.licoesAprendidas || null,
    responsavelId: input.responsavelId || null,
    assetId: input.assetId || null,
    status: input.status,
  };
}

export async function createIncident(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canEditIncidents(ctx.role)) return err("FORBIDDEN", "O seu papel não permite registar incidentes.");

  const limit = await checkRateLimit(
    `report-incident:${ctx.organization.id}:${actorId}`,
    RATE_LIMITS.report.maxAttempts,
    RATE_LIMITS.report.windowMs,
    { actorId, organizationId: ctx.organization.id, resource: "incident" },
  );
  if (!limit.allowed) return err("VALIDATION", rateLimitMessage(limit));

  const parsed = incidentInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const invalid = await validateRelations(ctx, parsed.data);
  if (invalid) return invalid;

  const incident = await prisma.incident.create({
    data: {
      organizationId: ctx.organization.id,
      ...toData(parsed.data),
      timeline: { create: { tipo: "STATUS_CHANGE", descricao: "Incidente reportado.", autorId: actorId } },
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "incident",
    resourceId: incident.id,
    metadata: { type: incident.type, severity: incident.severity },
  });
  return ok({ id: incident.id });
}

export async function updateIncident(
  ctx: OrganizationContext,
  actorId: string,
  incidentId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditIncidents(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar incidentes.");

  const parsed = incidentInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.incident.findUnique({ where: { id: incidentId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Incidente não encontrado.");

  const invalid = await validateRelations(ctx, parsed.data);
  if (invalid) return invalid;

  await prisma.incident.update({ where: { id: incidentId }, data: toData(parsed.data) });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "incident",
    resourceId: incidentId,
  });
  return ok(undefined);
}

export async function setIncidentStatus(
  ctx: OrganizationContext,
  actorId: string,
  incidentId: string,
  status: IncidentStatus,
  statusLabel: string,
): Promise<Result> {
  if (!canEditIncidents(ctx.role)) return err("FORBIDDEN", "O seu papel não permite alterar incidentes.");

  const existing = await prisma.incident.findUnique({ where: { id: incidentId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Incidente não encontrado.");

  const closed = status === "RECUPERADO" || status === "ENCERRADO";
  await prisma.$transaction([
    prisma.incident.update({
      where: { id: incidentId },
      data: { status, resolvedAt: closed ? new Date() : null },
    }),
    prisma.incidentTimelineEvent.create({
      data: { incidentId, tipo: "STATUS_CHANGE", descricao: `Estado alterado para ${statusLabel}.`, autorId: actorId },
    }),
  ]);
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "incident",
    resourceId: incidentId,
    metadata: { status },
  });
  return ok(undefined);
}

/** Adiciona um evento manual (ação ou nota) à linha do tempo. */
export async function addTimelineEvent(
  ctx: OrganizationContext,
  actorId: string,
  incidentId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditIncidents(ctx.role)) return err("FORBIDDEN", "O seu papel não permite registar eventos.");

  const parsed = timelineEventSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.incident.findUnique({ where: { id: incidentId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Incidente não encontrado.");

  await prisma.incidentTimelineEvent.create({
    data: { incidentId, tipo: parsed.data.tipo, descricao: parsed.data.descricao, autorId: actorId },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "incident_event",
    resourceId: incidentId,
    metadata: { tipo: parsed.data.tipo },
  });
  return ok(undefined);
}

/** Converte o incidente num ticket de acompanhamento ligado. */
export async function convertIncidentToTicket(
  ctx: OrganizationContext,
  actorId: string,
  incidentId: string,
): Promise<Result<{ ticketId: string }>> {
  if (!canEditIncidents(ctx.role)) return err("FORBIDDEN", "O seu papel não permite converter incidentes.");

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Incidente não encontrado.");

  const ticket = await prisma.ticket.create({
    data: {
      organizationId: ctx.organization.id,
      title: `[Incidente] ${incident.title}`,
      description: incident.description,
      category: "INCIDENTE",
      priority: incident.severity === "CRITICAL" ? "URGENT" : incident.severity === "HIGH" ? "HIGH" : "MEDIUM",
      createdById: actorId,
      assetId: incident.assetId,
      incidentId: incident.id,
      events: { create: { tipo: "NOTA", descricao: `Ticket criado a partir do incidente "${incident.title}".`, autorId: actorId } },
    },
  });
  await prisma.incidentTimelineEvent.create({
    data: { incidentId, tipo: "ACAO", descricao: `Incidente convertido em ticket (${ticket.title}).`, autorId: actorId },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "ticket",
    resourceId: ticket.id,
    metadata: { incidentId },
  });
  return ok({ ticketId: ticket.id });
}
