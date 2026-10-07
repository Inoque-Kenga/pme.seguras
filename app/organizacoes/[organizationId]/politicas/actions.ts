"use server";

import { z } from "zod";
import { PolicyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { createPolicy, setPolicyStatus, updatePolicy } from "@/lib/services/policy.service";

function readInput(formData: FormData) {
  return {
    title: formData.get("title"),
    content: formData.get("content"),
    category: formData.get("category"),
    status: formData.get("status"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/politicas`;

export async function createPolicyAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createPolicy(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Pol%C3%ADtica+criada+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/nova`, result, "");
}

export async function updatePolicyAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const policyId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updatePolicy(ctx, session.user.id, policyId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${policyId}`, result, "Política atualizada com sucesso.");
}

export async function setPolicyStatusAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const policyId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const parsed = z.nativeEnum(PolicyStatus).safeParse(formData.get("status"));
  const result = parsed.success
    ? await setPolicyStatus(ctx, session.user.id, policyId, parsed.data)
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${policyId}`, result, "Estado da política atualizado.");
}
