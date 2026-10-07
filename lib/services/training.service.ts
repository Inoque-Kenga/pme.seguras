import { z } from "zod";
import { TrainingCompletionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

export const TRAINING_MANAGER_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canManageTrainings(role: string): boolean {
  return TRAINING_MANAGER_ROLES.includes(role);
}

/** Nota mínima para aprovação no questionário (percentagem). */
export const PASS_THRESHOLD = 70;

export const trainingModuleSchema = z.object({
  title: z.string().trim().min(3, "Indique o título da formação.").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  content: z.string().trim().min(20, "O conteúdo deve ter pelo menos 20 caracteres.").max(50000),
  duracaoMinutos: z.coerce.number().int().min(1).max(480).optional().or(z.literal("")),
  validadeMeses: z.coerce.number().int().min(1, "Mínimo 1 mês.").max(60, "Máximo 60 meses."),
});

export const trainingQuestionSchema = z.object({
  pergunta: z.string().trim().min(5, "Escreva a pergunta.").max(500),
  opcoes: z
    .array(z.string().trim().min(1, "Opção vazia.").max(200))
    .min(2, "São necessárias pelo menos 2 opções.")
    .max(6, "Máximo 6 opções."),
  respostaCorretaIndex: z.coerce.number().int().min(0),
});

export const quizSubmissionSchema = z.object({
  completionId: z.string().min(1),
  answers: z.array(z.coerce.number().int().min(0)).min(1, "Responda às perguntas."),
});

/** validoAte = dataConclusao + validadeMeses (função pura). */
export function computeValidUntil(dataConclusao: Date, validadeMeses: number): Date {
  const valid = new Date(dataConclusao);
  valid.setMonth(valid.getMonth() + validadeMeses);
  return valid;
}

/** Estado efetivo de uma conclusão tendo em conta a data de validade. */
export function effectiveCompletionState(
  completion: { estado: TrainingCompletionStatus; validoAte: Date | null },
  now = new Date(),
): TrainingCompletionStatus {
  if (completion.estado === "CONCLUIDO" && completion.validoAte && completion.validoAte < now) {
    return "EXPIRADO";
  }
  return completion.estado;
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

export async function listTrainingModules(organizationId: string) {
  return prisma.trainingModule.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], ativo: true },
    include: {
      _count: { select: { questions: true, assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainingModule(organizationId: string, moduleId: string) {
  return prisma.trainingModule.findFirst({
    where: { id: moduleId, OR: [{ organizationId }, { organizationId: null }] },
    include: {
      questions: { orderBy: { createdAt: "asc" } },
      assignments: {
        where: { organizationId },
        include: { _count: { select: { completions: true } } },
      },
    },
  });
}

export async function createTrainingModule(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canManageTrainings(ctx.role)) return err("FORBIDDEN", "O seu papel não permite criar formações.");

  const parsed = trainingModuleSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const trainingModule = await prisma.trainingModule.create({
    data: {
      organizationId: ctx.organization.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      content: parsed.data.content,
      duracaoMinutos: typeof parsed.data.duracaoMinutos === "number" ? parsed.data.duracaoMinutos : null,
      validadeMeses: parsed.data.validadeMeses,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "training_module",
    resourceId: trainingModule.id,
  });
  return ok({ id: trainingModule.id });
}

export async function addQuestion(
  ctx: OrganizationContext,
  actorId: string,
  moduleId: string,
  input: unknown,
): Promise<Result> {
  if (!canManageTrainings(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar formações.");

  const trainingModule = await prisma.trainingModule.findFirst({
    where: { id: moduleId, organizationId: ctx.organization.id },
    include: { _count: { select: { questions: true } } },
  });
  if (!trainingModule) return err("NOT_FOUND", "Formação não encontrada nesta organização.");
  if (trainingModule._count.questions >= 5) return err("CONFLICT", "Cada módulo tem no máximo 5 perguntas.");

  const parsed = trainingQuestionSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));
  if (parsed.data.respostaCorretaIndex >= parsed.data.opcoes.length) {
    return err("VALIDATION", "O índice da resposta correta não corresponde a nenhuma opção.");
  }

  await prisma.trainingQuestion.create({
    data: {
      trainingModuleId: moduleId,
      pergunta: parsed.data.pergunta,
      opcoes: parsed.data.opcoes,
      respostaCorretaIndex: parsed.data.respostaCorretaIndex,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "training_question",
    resourceId: moduleId,
  });
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Atribuições
// ---------------------------------------------------------------------------

export async function assignTraining(
  ctx: OrganizationContext,
  actorId: string,
  input: { trainingModuleId: string; atribuicaoGlobal: boolean; userIds?: string[]; dataLimite?: string },
): Promise<Result<{ id: string }>> {
  if (!canManageTrainings(ctx.role)) return err("FORBIDDEN", "O seu papel não permite atribuir formações.");

  const trainingModule = await prisma.trainingModule.findFirst({
    where: { id: input.trainingModuleId, OR: [{ organizationId: ctx.organization.id }, { organizationId: null }] },
    include: { _count: { select: { questions: true } } },
  });
  if (!trainingModule) return err("NOT_FOUND", "Formação não encontrada.");
  if (trainingModule._count.questions === 0) return err("CONFLICT", "Adicione perguntas antes de atribuir a formação.");

  // Destinatários: todos os membros ativos ou a lista escolhida.
  let targetUserIds: string[] = [];
  if (input.atribuicaoGlobal) {
    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: ctx.organization.id, status: "ACTIVE", user: { isActive: true } },
      select: { userId: true },
    });
    targetUserIds = members.map((member) => member.userId);
  } else {
    const ids = [...new Set(input.userIds ?? [])];
    if (ids.length === 0) return err("VALIDATION", "Selecione pelo menos um utilizador.");
    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: ctx.organization.id, status: "ACTIVE", userId: { in: ids } },
      select: { userId: true },
    });
    if (members.length !== ids.length) return err("VALIDATION", "Há utilizadores inválidos na seleção.");
    targetUserIds = ids;
  }

  const assignment = await prisma.trainingAssignment.create({
    data: {
      organizationId: ctx.organization.id,
      trainingModuleId: trainingModule.id,
      atribuicaoGlobal: input.atribuicaoGlobal,
      dataLimite: input.dataLimite ? new Date(input.dataLimite) : null,
      completions: {
        create: targetUserIds.map((userId) => ({ userId })),
      },
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "ASSIGN",
    resource: "training_assignment",
    resourceId: assignment.id,
    metadata: { global: input.atribuicaoGlobal, destinatarios: targetUserIds.length },
  });
  return ok({ id: assignment.id });
}

/** Garante que o utilizador tem completions para atribuições globais novas da organização. */
async function ensureGlobalCompletions(organizationId: string, userId: string) {
  const globalAssignments = await prisma.trainingAssignment.findMany({
    where: { organizationId, atribuicaoGlobal: true },
    select: { id: true },
  });
  for (const assignment of globalAssignments) {
    await prisma.trainingCompletion.upsert({
      where: { trainingAssignmentId_userId: { trainingAssignmentId: assignment.id, userId } },
      update: {},
      create: { trainingAssignmentId: assignment.id, userId },
    });
  }
}

/** "Minhas formações": atribuídas a mim ou globais da organização. */
export async function listMyTrainings(organizationId: string, userId: string) {
  await ensureGlobalCompletions(organizationId, userId);

  const completions = await prisma.trainingCompletion.findMany({
    where: { userId, trainingAssignment: { organizationId } },
    include: {
      trainingAssignment: {
        include: { trainingModule: { include: { _count: { select: { questions: true } } } } },
      },
    },
    orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
  });

  const now = new Date();
  // Expiração lazy: marca como EXPIRADO as conclusões fora de validade.
  const expired = completions.filter((completion) => effectiveCompletionState(completion, now) === "EXPIRADO" && completion.estado === "CONCLUIDO");
  if (expired.length > 0) {
    await prisma.trainingCompletion.updateMany({
      where: { id: { in: expired.map((completion) => completion.id) } },
      data: { estado: "EXPIRADO" },
    });
  }

  return completions.map((completion) => ({
    ...completion,
    estado: effectiveCompletionState(completion, now),
  }));
}

/** Painel de gestão: taxa de conclusão válida e utilizadores pendentes. */
export async function getTrainingPanel(organizationId: string, now = new Date()) {
  const [members, completions] = await Promise.all([
    prisma.organizationMembership.count({
      where: { organizationId, status: "ACTIVE", user: { isActive: true } },
    }),
    prisma.trainingCompletion.findMany({
      where: { trainingAssignment: { organizationId } },
      select: { userId: true, estado: true, validoAte: true },
    }),
  ]);

  const validUsers = new Set(
    completions
      .filter((completion) => effectiveCompletionState(completion, now) === "CONCLUIDO")
      .map((completion) => completion.userId),
  );
  const expiredCount = completions.filter(
    (completion) => effectiveCompletionState(completion, now) === "EXPIRADO",
  ).length;
  const pendingCount = completions.filter((completion) =>
    ["NAO_INICIADO", "EM_ANDAMENTO"].includes(completion.estado),
  ).length;

  return {
    totalMembers: members,
    validUsers: validUsers.size,
    validPercent: members > 0 ? Math.round((validUsers.size / members) * 100) : 0,
    expiredCount,
    pendingCount,
  };
}

// ---------------------------------------------------------------------------
// Questionário
// ---------------------------------------------------------------------------

/** Dados do questionário para o utilizador (sem a resposta correta). */
export async function getQuizForUser(organizationId: string, userId: string, completionId: string) {
  const completion = await prisma.trainingCompletion.findFirst({
    where: { id: completionId, userId, trainingAssignment: { organizationId } },
    include: {
      trainingAssignment: {
        include: {
          trainingModule: {
            include: { questions: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
  if (!completion) return null;

  const trainingModule = completion.trainingAssignment.trainingModule;
  return {
    completion: { ...completion, estado: effectiveCompletionState(completion) },
    trainingModule: {
      id: trainingModule.id,
      title: trainingModule.title,
      description: trainingModule.description,
      content: trainingModule.content,
      duracaoMinutos: trainingModule.duracaoMinutos,
    },
    questions: trainingModule.questions.map((question) => ({
      id: question.id,
      pergunta: question.pergunta,
      opcoes: question.opcoes as string[],
    })),
  };
}

/** Submete as respostas: calcula o score, aprova/reprova e regista validade. */
export async function submitQuiz(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ score: number; passed: boolean; validoAte: Date | null }>> {
  const parsed = quizSubmissionSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const completion = await prisma.trainingCompletion.findFirst({
    where: { id: parsed.data.completionId, userId: actorId, trainingAssignment: { organizationId: ctx.organization.id } },
    include: { trainingAssignment: { include: { trainingModule: { include: { questions: true } } } } },
  });
  if (!completion) return err("NOT_FOUND", "Formação não encontrada nas suas atribuições.");
  if (effectiveCompletionState(completion) === "EXPIRADO") {
    return err("CONFLICT", "Esta formação expirou. Contacte a equipa de segurança para nova atribuição.");
  }

  const questions = completion.trainingAssignment.trainingModule.questions;
  if (questions.length === 0) return err("CONFLICT", "Este módulo não tem perguntas.");
  if (parsed.data.answers.length !== questions.length) {
    return err("VALIDATION", "Responda a todas as perguntas antes de submeter.");
  }

  const correct = questions.filter(
    (question, index) => parsed.data.answers[index] === question.respostaCorretaIndex,
  ).length;
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= PASS_THRESHOLD;
  const now = new Date();
  const validoAte = passed ? computeValidUntil(now, completion.trainingAssignment.trainingModule.validadeMeses) : null;

  await prisma.trainingCompletion.update({
    where: { id: completion.id },
    data: {
      dataInicio: completion.dataInicio ?? now,
      dataConclusao: passed ? now : null,
      score,
      validoAte,
      estado: passed ? "CONCLUIDO" : "EM_ANDAMENTO",
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: passed ? "STATUS_CHANGE" : "UPDATE",
    resource: "training_completion",
    resourceId: completion.id,
    metadata: { score, passed },
  });
  return ok({ score, passed, validoAte });
}
