"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { archiveAsset, createAsset, updateAsset } from "@/lib/services/asset.service";

function readAssetInput(formData: FormData) {
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    marcaModelo: formData.get("marcaModelo"),
    numeroSerie: formData.get("numeroSerie"),
    sistemaOperativo: formData.get("sistemaOperativo"),
    ip: formData.get("ip"),
    location: formData.get("location"),
    owner: formData.get("owner"),
    criticality: formData.get("criticality"),
    status: formData.get("status"),
    protecaoEndpoint: formData.get("protecaoEndpoint") === "on",
    ultimaAtualizacao: formData.get("ultimaAtualizacao"),
    mfaAplicavel: formData.get("mfaAplicavel") === "on",
    cifragem: formData.get("cifragem") === "on",
    description: formData.get("description"),
  };
}

const listPath = (organizationId: string) => `/organizacoes/${organizationId}/ativos`;

async function getAssetContext(organizationId: string) {
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  return { session, ctx };
}

export async function createAssetAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const { session, ctx } = await getAssetContext(organizationId);
  if (!ctx) redirectWithResult(listPath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createAsset(ctx, session.user.id, readAssetInput(formData));
  revalidatePath(listPath(organizationId));
  if (result.ok) {
    redirect(`/organizacoes/${organizationId}/ativos/${result.data.id}?success=Ativo+registado+com+sucesso.`);
  }
  redirectWithResult(`/organizacoes/${organizationId}/ativos/novo`, result, "");
}

export async function updateAssetAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const assetId = String(formData.get("id") ?? "");
  const { session, ctx } = await getAssetContext(organizationId);
  if (!ctx) redirectWithResult(listPath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateAsset(ctx, session.user.id, assetId, readAssetInput(formData));
  revalidatePath(listPath(organizationId));
  redirectWithResult(`/organizacoes/${organizationId}/ativos/${assetId}`, result, "Ativo atualizado com sucesso.");
}

export async function archiveAssetAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const assetId = String(formData.get("id") ?? "");
  const { session, ctx } = await getAssetContext(organizationId);
  if (!ctx) redirectWithResult(listPath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await archiveAsset(ctx, session.user.id, assetId);
  revalidatePath(listPath(organizationId));
  redirectWithResult(listPath(organizationId), result, "Ativo arquivado com sucesso.");
}
