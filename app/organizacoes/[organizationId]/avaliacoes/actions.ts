"use server";

import { z } from "zod";
import { AssessmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import {
  createAssessment,
  setAssessmentStatus,
  updateAssessment,
} from "@/lib/services/risk-assessment.service";

function readInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    domain: formData.get("domain"),
    ownerId: formData.get("ownerId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/avaliacoes`;

export async function createAssessmentAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createAssessment(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Avalia%C3%A7%C3%A3o+criada+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/nova`, result, "");
}

export async function updateAssessmentAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const assessmentId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateAssessment(ctx, session.user.id, assessmentId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${assessmentId}`, result, "Avaliação atualizada com sucesso.");
}

export async function setAssessmentStatusAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const assessmentId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const status = z.nativeEnum(AssessmentStatus).safeParse(formData.get("status"));
  const result = status.success
    ? await setAssessmentStatus(ctx, session.user.id, assessmentId, status.data)
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${assessmentId}`, result, "Estado da avaliação atualizado.");
}
