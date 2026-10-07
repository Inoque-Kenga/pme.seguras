"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import {
  convertReportToIncident,
  convertReportToTicket,
  createPhishingReport,
  markReportFalsePositive,
  markReportInAnalysis,
} from "@/lib/services/phishing-report.service";

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/phishing`;

async function getReportContext(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  return { organizationId, session, ctx };
}

export async function createPhishingReportAction(formData: FormData) {
  const { organizationId, session, ctx } = await getReportContext(formData);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createPhishingReport(ctx, session.user.id, {
    canal: formData.get("canal"),
    remetente: formData.get("remetente"),
    assunto: formData.get("assunto"),
    descricao: formData.get("descricao"),
    urlSuspeita: formData.get("urlSuspeita"),
    classificacaoInicial: formData.get("classificacaoInicial"),
  });
  revalidatePath(basePath(organizationId));
  redirectWithResult(basePath(organizationId), result, "Obrigado! A mensagem suspeita foi reportada à equipa de segurança.");
}

async function triage(formData: FormData, action: "analise" | "falso" | "ticket" | "incidente") {
  const { organizationId, session, ctx } = await getReportContext(formData);
  const reportId = String(formData.get("id") ?? "");
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");

  const result =
    action === "analise"
      ? await markReportInAnalysis(ctx, session.user.id, reportId)
      : action === "falso"
        ? await markReportFalsePositive(ctx, session.user.id, reportId)
        : action === "ticket"
          ? await convertReportToTicket(ctx, session.user.id, reportId)
          : await convertReportToIncident(ctx, session.user.id, reportId);

  revalidatePath(basePath(organizationId));
  if (result.ok && "data" in result && result.data && "ticketId" in result.data) {
    redirect(`/organizacoes/${organizationId}/tickets/${result.data.ticketId}?success=Ticket+criado+a+partir+do+report.`);
  }
  if (result.ok && "data" in result && result.data && "incidentId" in result.data) {
    redirect(`/organizacoes/${organizationId}/incidentes/${result.data.incidentId}?success=Incidente+criado+a+partir+do+report.`);
  }
  redirectWithResult(basePath(organizationId), result, "Report atualizado.");
}

export async function markInAnalysisAction(formData: FormData) {
  return triage(formData, "analise");
}

export async function markFalsePositiveAction(formData: FormData) {
  return triage(formData, "falso");
}

export async function convertToTicketAction(formData: FormData) {
  return triage(formData, "ticket");
}

export async function convertToIncidentAction(formData: FormData) {
  return triage(formData, "incidente");
}
