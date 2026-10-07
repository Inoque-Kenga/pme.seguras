import { z } from "zod";
import { Priority, TicketCategory, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import type { OrganizationContext } from "@/lib/current-organization";
import { fail, ok, requireEditor, sameOrganization, type ServiceResult } from "@/lib/services/common";

const createTicketSchema = z.object({
  title: z.string().trim().min(3, "Indique o assunto do ticket.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(Priority),
});

export async function listTickets(organizationId: string) {
  return prisma.ticket.findMany({
    where: { organizationId },
    include: {
      createdBy: { select: { name: true } },
      assignee: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });
}

/** Qualquer membro ativo da organização pode abrir um ticket. */
export async function createTicket(ctx: OrganizationContext, actorId: string, input: unknown): Promise<ServiceResult> {
  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const ticket = await prisma.ticket.create({
    data: {
      organizationId: ctx.organization.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priority: parsed.data.priority,
      createdById: actorId,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "ticket",
    resourceId: ticket.id,
  });
  return ok;
}

export async function setTicketStatus(
  ctx: OrganizationContext,
  actorId: string,
  ticketId: string,
  status: TicketStatus,
): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { organizationId: true } });
  if (!ticket) return fail("Ticket não encontrado.");
  const wrongOrg = sameOrganization(ticket.organizationId, ctx);
  if (wrongOrg) return wrongOrg;

  await prisma.ticket.update({ where: { id: ticketId }, data: { status } });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "ticket",
    resourceId: ticketId,
    metadata: { status },
  });
  return ok;
}
