"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { addVerification, createBackup, updateBackup } from "@/lib/services/backup.service";

function readInput(formData: FormData) {
  return {
    sistemaAtivo: formData.get("sistemaAtivo"),
    fornecedor: formData.get("fornecedor"),
    frequencia: formData.get("frequencia"),
    ultimaExecucao: formData.get("ultimaExecucao"),
    estado: formData.get("estado"),
    tamanhoGB: formData.get("tamanhoGB"),
    localizacao: formData.get("localizacao"),
    retencaoDias: formData.get("retencaoDias"),
    rtoHoras: formData.get("rtoHoras"),
    rpoHoras: formData.get("rpoHoras"),
    ultimoTesteRestauracao: formData.get("ultimoTesteRestauracao"),
    notas: formData.get("notas"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/backups`;

export async function createBackupAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createBackup(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Backup+registado+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/novo`, result, "");
}

export async function updateBackupAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const backupId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateBackup(ctx, session.user.id, backupId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${backupId}`, result, "Backup atualizado com sucesso.");
}

export async function addVerificationAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const backupId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await addVerification(ctx, session.user.id, backupId, {
    dataTeste: formData.get("dataTeste"),
    resultado: formData.get("resultado"),
    detalhes: formData.get("detalhes"),
  });
  revalidatePath(`${basePath(organizationId)}/${backupId}`);
  redirectWithResult(`${basePath(organizationId)}/${backupId}`, result, "Teste de restauração registado.");
}
