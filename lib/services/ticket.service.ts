import { z } from "zod";
import { Prisma, Priority, TicketCategory, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

/** Apenas ANALISTA_SEGURANCA atribui/assume tickets (regra da fase). */
export function canAssignTickets(role: string): boolean {
  return role === "ANALISTA_SEGURANCA";
}

/** Papéis que gerem o ciclo de vida dos tickets (estado, edição, fecho). */
export const TICKET_MANAGER_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canManageTickets(role: string): boolean {
  return TICKET_MANAGER_ROLES.includes(role);
}

export const OPEN_TICKET_STATUSES: TicketStatus[] = ["ABERTO", "EM_ANALISE", "EM_ANDAMENTO", "AGUARDA_CLIENTE"];

export const ticketInputSchema = z.object({
  title: z.string().trim().min(3, "Indique o assunto do ticket.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(Priority),
  slaHoras: z.coerce.number().int().min(1).max(2160).optional().or(z.literal("")),
  assetId: z.string().optional().or(z.literal("")),
});

export type TicketInput = z.infer<typeof ticketInputSchema>;

export const ticketCommentSchema = z.object({
  conteudo: z.string().trim().min(2, "Escreva um comentário.").max(2000),
});

export type TicketListParams = {
  status?: TicketStatus;
  priority?: Priority;
  category?: TicketCategory;
  assigneeId?: string;
  createdById?: string;
  page?: number;
  pageSize?: number;
};

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** Um ticket está vencido se ultrapassou o SLA (createdAt + slaHoras) estando aberto. */
export function isTicketOverdue(
  ticket: { status: TicketStatus; createdAt: Date; slaHoras: number | null },
  now = new Date(),
): boolean {
  if (!ticket.slaHoras || !OPEN_TICKET_STATUSES.includes(ticket.status)) return false;
  return now.getTime() > ticket.createdAt.getTime() + ticket.slaHoras * 60 * 60 * 1000;
}

export async function listTickets(organizationId: string, params: TicketListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 12));

  const where: Prisma.TicketWhereInput = { organizationId };
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.category) where.category = params.category;
  if (params.assigneeId) where.assigneeId = params.assigneeId;
  if (params.createdById) where.createdById = params.createdById;

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Painel do analista: tickets atribuídos ao utilizador e vencidos (SLA). */
export async function getAnalystPanel(organizationId: string, analystId: string, now = new Date()) {
  const assigned = await prisma.ticket.findMany({
    where: { organizationId, assigneeId: analystId, status: { in: OPEN_TICKET_STATUSES } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 50,
  });
  const overdue = assigned.filter((ticket) => isTicketOverdue(ticket, now));
  return { assigned, overdue };
}

export async function getTicket(organizationId: string, ticketId: string) {
  return prisma.ticket.findFirst({
    where: { id: ticketId, organizationId },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true } },
      incident: { select: { id: true, title: true } },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      events: {
        include: { autor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Qualquer membro da organização pode criar um ticket. */
export async function createTicket(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = ticketInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  if (parsed.data.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId }, select: { organizationId: true } });
    if (!asset || asset.organizationId !== ctx.organization.id) return err("VALIDATION", "Ativo associado inválido.");
  }

  const ticket = await prisma.ticket.create({
    data: {
      organizationId: ctx.organization.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priority: parsed.data.priority,
      slaHoras: typeof parsed.data.slaHoras === "number" ? parsed.data.slaHoras : null,
      assetId: parsed.data.assetId || null,
      createdById: actorId,
      events: { create: { tipo: "STATUS_CHANGE", descricao: "Ticket criado (Aberto).", autorId: actorId } },
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "ticket",
    resourceId: ticket.id,
  });
  return ok({ id: ticket.id });
}

export async function updateTicket(
  ctx: OrganizationContext,
  actorId: string,
  ticketId: string,
  input: unknown,
): Promise<Result> {
  if (!canManageTickets(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar tickets.");

  const parsed = ticketInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Ticket não encontrado.");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priority: parsed.data.priority,
      slaHoras: typeof parsed.data.slaHoras === "number" ? parsed.data.slaHoras : null,
      assetId: parsed.data.assetId || null,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "ticket",
    resourceId: ticketId,
  });
  return ok(undefined);
}

export async function setTicketStatus(
  ctx: OrganizationContext,
  actorId: string,
  ticketId: string,
  status: TicketStatus,
  statusLabel: string,
): Promise<Result> {
  if (!canManageTickets(ctx.role)) return err("FORBIDDEN", "O seu papel não permite alterar o estado de tickets.");

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Ticket não encontrado.");

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { status } }),
    prisma.ticketEvent.create({
      data: { ticketId, tipo: "STATUS_CHANGE", descricao: `Estado alterado para ${statusLabel}.`, autorId: actorId },
    }),
  ]);
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "ticket",
    resourceId: ticketId,
    metadata: { status },
  });
  return ok(undefined);
}

/** Apenas ANALISTA_SEGURANCA pode atribuir/assumir tickets. */
export async function assignTicket(
  ctx: OrganizationContext,
  actorId: string,
  ticketId: string,
  assigneeId: string | null,
): Promise<Result> {
  if (!canAssignTickets(ctx.role)) return err("FORBIDDEN", "Apenas o analista de segurança pode atribuir tickets.");

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Ticket não encontrado.");

  let descricao = "Atribuição removida.";
  if (assigneeId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: assigneeId, organizationId: ctx.organization.id } },
      include: { user: { select: { name: true } } },
    });
    if (!membership || membership.status !== "ACTIVE") return err("VALIDATION", "Analista inválido para esta organização.");
    descricao = `Ticket atribuído a ${membership.user.name}.`;
  }

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId } }),
    prisma.ticketEvent.create({ data: { ticketId, tipo: "ATRIBUICAO", descricao, autorId: actorId } }),
  ]);
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "ASSIGN",
    resource: "ticket",
    resourceId: ticketId,
    metadata: { assigneeId },
  });
  return ok(undefined);
}

/** Comentar: analistas/gestores em qualquer ticket; colaborador apenas nos seus. */
export async function addTicketComment(
  ctx: OrganizationContext,
  actorId: string,
  ticketId: string,
  input: unknown,
): Promise<Result> {
  const parsed = ticketCommentSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { organizationId: true, createdById: true },
  });
  if (!ticket || ticket.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Ticket não encontrado.");

  const isManager = canManageTickets(ctx.role);
  if (!isManager && ticket.createdById !== actorId) {
    return err("FORBIDDEN", "Só pode comentar nos seus próprios tickets.");
  }

  await prisma.ticketComment.create({
    data: { ticketId, authorId: actorId, conteudo: parsed.data.conteudo },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "ticket_comment",
    resourceId: ticketId,
  });
  return ok(undefined);
}
