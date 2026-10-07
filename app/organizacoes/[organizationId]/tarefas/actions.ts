"use server";

import { z } from "zod";
import { TreatmentTaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { addComment, createTask, setTaskStatus, updateTask } from "@/lib/services/treatment-task.service";

function readInput(formData: FormData) {
  return {
    riskId: formData.get("riskId"),
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
  };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/tarefas`;

export async function createTaskAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createTask(ctx, session.user.id, readInput(formData));
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Tarefa+criada+com+sucesso.`);
  redirectWithResult(`${basePath(organizationId)}/nova`, result, "");
}

export async function updateTaskAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const taskId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await updateTask(ctx, session.user.id, taskId, readInput(formData));
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${taskId}`, result, "Tarefa atualizada com sucesso.");
}

export async function setTaskStatusAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const taskId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const status = z.nativeEnum(TreatmentTaskStatus).safeParse(formData.get("status"));
  const result = status.success
    ? await setTaskStatus(ctx, session.user.id, taskId, status.data)
    : err("VALIDATION", "Estado inválido.");
  revalidatePath(basePath(organizationId));
  redirectWithResult(`${basePath(organizationId)}/${taskId}`, result, "Estado da tarefa atualizado.");
}

export async function addCommentAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const taskId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await addComment(ctx, session.user.id, taskId, { body: formData.get("body") });
  revalidatePath(`${basePath(organizationId)}/${taskId}`);
  redirectWithResult(`${basePath(organizationId)}/${taskId}`, result, "Comentário adicionado.");
}
