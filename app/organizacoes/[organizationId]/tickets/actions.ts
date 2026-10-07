"use server";

import { z } from "zod";
import { TicketStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  setTicketStatus,
  updateTicket,
} from "@/lib/services/ticket.service";
import { ticketStatusLabels } from "@/lib/labels";

function readInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    slaHoras: formData.get("slaHoras"),
    assetId: formData.get("assetId"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/tickets`;

async function getTicketContext(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  return { organizationId, session, ctx };
}

export async function createTicketAction(formData: FormData) {
  const { organizationId, session, ctx } = await getTicketContext(formData);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createTicket(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Ticket+criado+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/novo`, result, "");
}

export async function updateTicketAction(formData: FormData) {
  const { organizationId, session, ctx } = await getTicketContext(formData);
  const ticketId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateTicket(ctx, session.user.id, ticketId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${ticketId}`, result, "Ticket atualizado com sucesso.");
}

export async function setTicketStatusAction(formData: FormData) {
  const { organizationId, session, ctx } = await getTicketContext(formData);
  const ticketId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const parsed = z.nativeEnum(TicketStatus).safeParse(formData.get("status"));
  const result = parsed.success
    ? await setTicketStatus(ctx, session.user.id, ticketId, parsed.data, ticketStatusLabels[parsed.data])
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(`${basePath(organizationId)}/${ticketId}`);
  redirectWithResult(`${basePath(organizationId)}/${ticketId}`, result, "Estado do ticket atualizado.");
}

export async function assignTicketAction(formData: FormData) {
  const { organizationId, session, ctx } = await getTicketContext(formData);
  const ticketId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const assigneeRaw = String(formData.get("assigneeId") ?? "");
  const result = await assignTicket(ctx, session.user.id, ticketId, assigneeRaw || null);
  revalidatePath(`${basePath(organizationId)}/${ticketId}`);
  redirectWithResult(`${basePath(organizationId)}/${ticketId}`, result, "Atribuição atualizada.");
}

export async function addTicketCommentAction(formData: FormData) {
  const { organizationId, session, ctx } = await getTicketContext(formData);
  const ticketId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await addTicketComment(ctx, session.user.id, ticketId, { conteudo: formData.get("conteudo") });
  revalidatePath(`${basePath(organizationId)}/${ticketId}`);
  redirectWithResult(`${basePath(organizationId)}/${ticketId}`, result, "Comentário adicionado.");
}
