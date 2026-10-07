"use server";

import { z } from "zod";
import { RiskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { createRisk, setRiskStatus, updateRisk } from "@/lib/services/risk.service";

function readInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    assessmentId: formData.get("assessmentId"),
    assetId: formData.get("assetId"),
    threat: formData.get("threat"),
    vulnerability: formData.get("vulnerability"),
    probability: formData.get("probability"),
    impact: formData.get("impact"),
    treatment: formData.get("treatment"),
    ownerId: formData.get("ownerId"),
    dueDate: formData.get("dueDate"),
    status: formData.get("status"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/riscos`;

export async function createRiskAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createRisk(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Risco+registado+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/novo`, result, "");
}

export async function updateRiskAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const riskId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateRisk(ctx, session.user.id, riskId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${riskId}`, result, "Risco atualizado com sucesso.");
}

export async function setRiskStatusAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const riskId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const status = z.nativeEnum(RiskStatus).safeParse(formData.get("status"));
  const result = status.success
    ? await setRiskStatus(ctx, session.user.id, riskId, status.data)
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${riskId}`, result, "Estado do risco atualizado.");
}
