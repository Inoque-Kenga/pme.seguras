import { z } from "zod";
import { Prisma, Priority, TreatmentTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

/** Papéis que podem gerir tarefas de tratamento. */
export const TASK_EDITOR_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canEditTasks(role: string): boolean {
  return TASK_EDITOR_ROLES.includes(role);
}

export const taskInputSchema = z.object({
  riskId: z.string().min(1, "Selecione o risco associado."),
  title: z.string().trim().min(3, "Indique o título da tarefa.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  assigneeId: z.string().optional().or(z.literal("")),
  priority: z.nativeEnum(Priority),
  status: z.nativeEnum(TreatmentTaskStatus),
  dueDate: z.string().optional().or(z.literal("")),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const commentInputSchema = z.object({
  body: z.string().trim().min(2, "Escreva um comentário.").max(2000),
});

export type TaskListParams = {
  status?: TreatmentTaskStatus;
  priority?: Priority;
  assigneeId?: string;
  riskId?: string;
  due?: "vencidas" | "proximas7" | "sem_prazo";
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 12;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export async function listTasks(organizationId: string, params: TaskListParams = {}, now = new Date()) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.RiskTreatmentTaskWhereInput = { organizationId };
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.assigneeId) where.assigneeId = params.assigneeId;
  if (params.riskId) where.riskId = params.riskId;
  if (params.due === "vencidas") {
    where.dueDate = { lt: now };
    where.status = { in: ["NAO_INICIADA", "EM_ANDAMENTO"] };
  } else if (params.due === "proximas7") {
    where.dueDate = { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
    where.status = { in: ["NAO_INICIADA", "EM_ANDAMENTO"] };
  } else if (params.due === "sem_prazo") {
    where.dueDate = null;
  }

  const [items, total] = await Promise.all([
    prisma.riskTreatmentTask.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        risk: { select: { id: true, title: true, riskLevel: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.riskTreatmentTask.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Indicadores: tarefas vencidas e tarefas de prioridade alta/urgente ainda abertas. */
export async function getTaskIndicators(organizationId: string, now = new Date()) {
  const openStatuses: TreatmentTaskStatus[] = ["NAO_INICIADA", "EM_ANDAMENTO"];
  const [overdue, highPriorityOpen] = await Promise.all([
    prisma.riskTreatmentTask.count({
      where: { organizationId, status: { in: openStatuses }, dueDate: { lt: now } },
    }),
    prisma.riskTreatmentTask.count({
      where: { organizationId, status: { in: openStatuses }, priority: { in: ["HIGH", "URGENT"] } },
    }),
  ]);
  return { overdue, highPriorityOpen };
}

export async function getTask(organizationId: string, taskId: string) {
  return prisma.riskTreatmentTask.findFirst({
    where: { id: taskId, organizationId },
    include: {
      assignee: { select: { id: true, name: true } },
      risk: { select: { id: true, title: true, riskLevel: true, status: true } },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function validateTaskRelations(ctx: OrganizationContext, input: TaskInput): Promise<Result<never> | null> {
  const risk = await prisma.risk.findUnique({ where: { id: input.riskId }, select: { organizationId: true } });
  if (!risk || risk.organizationId !== ctx.organization.id) return err("VALIDATION", "Risco associado inválido.");

  if (input.assigneeId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: input.assigneeId, organizationId: ctx.organization.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      return err("VALIDATION", "O responsável deve ser membro ativo desta organização.");
    }
  }
  return null;
}

function toData(input: TaskInput) {
  return {
    riskId: input.riskId,
    title: input.title,
    description: input.description || null,
    assigneeId: input.assigneeId || null,
    priority: input.priority,
    status: input.status,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
  };
}

export async function createTask(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canEditTasks(ctx.role)) return err("FORBIDDEN", "O seu papel não permite criar tarefas.");

  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const invalid = await validateTaskRelations(ctx, parsed.data);
  if (invalid) return invalid;

  const task = await prisma.riskTreatmentTask.create({
    data: { organizationId: ctx.organization.id, ...toData(parsed.data) },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "treatment_task",
    resourceId: task.id,
    metadata: { riskId: task.riskId },
  });
  return ok({ id: task.id });
}

export async function updateTask(
  ctx: OrganizationContext,
  actorId: string,
  taskId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditTasks(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar tarefas.");

  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.riskTreatmentTask.findUnique({
    where: { id: taskId },
    select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Tarefa não encontrada.");

  const invalid = await validateTaskRelations(ctx, parsed.data);
  if (invalid) return invalid;

  await prisma.riskTreatmentTask.update({ where: { id: taskId }, data: toData(parsed.data) });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "treatment_task",
    resourceId: taskId,
  });
  return ok(undefined);
}

export async function setTaskStatus(
  ctx: OrganizationContext,
  actorId: string,
  taskId: string,
  status: TreatmentTaskStatus,
): Promise<Result> {
  if (!canEditTasks(ctx.role)) return err("FORBIDDEN", "O seu papel não permite alterar tarefas.");

  const existing = await prisma.riskTreatmentTask.findUnique({
    where: { id: taskId },
    select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Tarefa não encontrada.");

  await prisma.riskTreatmentTask.update({ where: { id: taskId }, data: { status } });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "treatment_task",
    resourceId: taskId,
    metadata: { status },
  });
  return ok(undefined);
}

/** Qualquer membro da organização pode comentar uma tarefa. */
export async function addComment(
  ctx: OrganizationContext,
  actorId: string,
  taskId: string,
  input: unknown,
): Promise<Result> {
  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const task = await prisma.riskTreatmentTask.findUnique({
    where: { id: taskId },
    select: { organizationId: true },
  });
  if (!task || task.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Tarefa não encontrada.");

  await prisma.taskComment.create({
    data: { taskId, authorId: actorId, body: parsed.data.body },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "task_comment",
    resourceId: taskId,
  });
  return ok(undefined);
}
