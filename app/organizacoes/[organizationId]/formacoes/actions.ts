"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import { addQuestion, assignTraining, createTrainingModule, submitQuiz } from "@/lib/services/training.service";
import type { Result } from "@/lib/services/errors";

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/formacoes`;

export async function createModuleAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  const result = await createTrainingModule(ctx, session.user.id, {
    title: formData.get("title"),
    description: formData.get("description"),
    content: formData.get("content"),
    duracaoMinutos: formData.get("duracaoMinutos"),
    validadeMeses: formData.get("validadeMeses"),
  });
  revalidatePath(basePath(organizationId));
  if (result.ok) redirect(`${basePath(organizationId)}/${result.data.id}?success=Forma%C3%A7%C3%A3o+criada.+Adicione+as+perguntas.`);
  redirectWithResult(basePath(organizationId), result, "");
}

export async function addQuestionAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const moduleId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");

  const opcoes = [0, 1, 2, 3, 4, 5]
    .map((index) => String(formData.get(`opcao${index}`) ?? "").trim())
    .filter((opcao) => opcao.length > 0);

  // O formulário usa índice 1-based; o serviço espera 0-based.
  const rawIndex = Number(formData.get("respostaCorretaIndex"));
  const result = await addQuestion(ctx, session.user.id, moduleId, {
    pergunta: formData.get("pergunta"),
    opcoes,
    respostaCorretaIndex: Number.isFinite(rawIndex) ? rawIndex - 1 : -1,
  });
  revalidatePath(`${basePath(organizationId)}/${moduleId}`);
  redirectWithResult(`${basePath(organizationId)}/${moduleId}`, result, "Pergunta adicionada.");
}

export async function assignTrainingAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const moduleId = String(formData.get("id") ?? "");
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");

  const atribuicaoGlobal = formData.get("atribuicaoGlobal") === "true";
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  const result = await assignTraining(ctx, session.user.id, {
    trainingModuleId: moduleId,
    atribuicaoGlobal,
    userIds,
    dataLimite: String(formData.get("dataLimite") ?? "") || undefined,
  });
  revalidatePath(`${basePath(organizationId)}/${moduleId}`);
  redirectWithResult(`${basePath(organizationId)}/${moduleId}`, result, "Formação atribuída com sucesso.");
}

/** Submissão do questionário (chamada pelo componente cliente). */
export async function submitQuizAction(input: {
  organizationId: string;
  completionId: string;
  answers: number[];
}): Promise<Result<{ score: number; passed: boolean; validoAte: Date | null }>> {
  const session = await requireSession();
  const ctx = await resolveOrganization(session, input.organizationId);
  if (!ctx) return err("NOT_FOUND", "Organização não encontrada.");
  const result = await submitQuiz(ctx, session.user.id, {
    completionId: input.completionId,
    answers: input.answers,
  });
  if (result.ok) revalidatePath(`/organizacoes/${input.organizationId}/minhas-formacoes`);
  return result;
}
