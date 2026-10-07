"use server";

import { z } from "zod";
import { IncidentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import {
  addTimelineEvent,
  convertIncidentToTicket,
  createIncident,
  setIncidentStatus,
  updateIncident,
} from "@/lib/services/incident.service";
import { incidentStatusLabels } from "@/lib/labels";

function readInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    severity: formData.get("severity"),
    detectedAt: formData.get("detectedAt"),
    sistemasAfetados: formData.get("sistemasAfetados"),
    acoesImediatas: formData.get("acoesImediatas"),
    licoesAprendidas: formData.get("licoesAprendidas"),
    responsavelId: formData.get("responsavelId"),
    assetId: formData.get("assetId"),
    status: formData.get("status"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/incidentes`;

async function getIncidentContext(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  return { organizationId, session, ctx };
}

export async function createIncidentAction(formData: FormData) {
  const { organizationId, session, ctx } = await getIncidentContext(formData);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createIncident(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Incidente+registado+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/novo`, result, "");
}

export async function updateIncidentAction(formData: FormData) {
  const { organizationId, session, ctx } = await getIncidentContext(formData);
  const incidentId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateIncident(ctx, session.user.id, incidentId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${incidentId}`, result, "Incidente atualizado com sucesso.");
}

export async function setIncidentStatusAction(formData: FormData) {
  const { organizationId, session, ctx } = await getIncidentContext(formData);
  const incidentId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const parsed = z.nativeEnum(IncidentStatus).safeParse(formData.get("status"));
  const result = parsed.success
    ? await setIncidentStatus(ctx, session.user.id, incidentId, parsed.data, incidentStatusLabels[parsed.data])
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(`${basePath(organizationId)}/${incidentId}`);
  redirectWithResult(`${basePath(organizationId)}/${incidentId}`, result, "Estado do incidente atualizado.");
}

export async function addTimelineEventAction(formData: FormData) {
  const { organizationId, session, ctx } = await getIncidentContext(formData);
  const incidentId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await addTimelineEvent(ctx, session.user.id, incidentId, {
    tipo: formData.get("tipo"),
    descricao: formData.get("descricao"),
  });
  revalidatePath(`${basePath(organizationId)}/${incidentId}`);
  redirectWithResult(`${basePath(organizationId)}/${incidentId}`, result, "Evento registado na linha do tempo.");
}

export async function convertToTicketAction(formData: FormData) {
  const { organizationId, session, ctx } = await getIncidentContext(formData);
  const incidentId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await convertIncidentToTicket(ctx, session.user.id, incidentId);
  revalidatePath(`${basePath(organizationId)}/${incidentId}`);
  if (result.ok) {
    redirect(`/organizacoes/${organizationId}/tickets/${result.data.ticketId}?success=Ticket+criado+a+partir+do+incidente.`);
  }
  redirectWithResult(`${basePath(organizationId)}/${incidentId}`, result, "");
}
