"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { generateReport, setReportStatus } from "@/lib/services/report.service";

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/relatorios`;

export async function generateReportAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");

  const mesReferencia =
    String(formData.get("mesReferencia") ?? "") ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const result = await generateReport(ctx, session.user.id, { mesReferencia });
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Relat%C3%B3rio+gerado+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/novo`, result, "");
}

export async function setReportStatusAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const reportId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");

  const status = String(formData.get("status") ?? "");
  const parsed = status === "PUBLICADO" || status === "ARQUIVADO" || status === "GERADO";
  const result = parsed
    ? await setReportStatus(ctx, session.user.id, reportId, status as "PUBLICADO" | "ARQUIVADO" | "GERADO")
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${reportId}`, result, "Estado do relatório atualizado.");
}
