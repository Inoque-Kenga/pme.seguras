import Link from "next/link";
import { notFound } from "next/navigation";
import { TreatmentTaskStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditTasks, getTask } from "@/lib/services/treatment-task.service";
import { listRiskOptions } from "@/lib/services/risk.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  priorityLabels,
  priorityTones,
  riskLevelLabels,
  riskLevelTones,
  riskStatusLabels,
  riskStatusTones,
  treatmentTaskStatusLabels,
  treatmentTaskStatusTones,
} from "@/lib/labels";
import { TaskForm } from "../task-form";
import { addCommentAction, setTaskStatusAction, updateTaskAction } from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; taskId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, taskId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const task = await getTask(ctx.organization.id, taskId);
  if (!task) notFound();

  const editable = canEditTasks(ctx.role);
  const [members, risks] = editable
    ? await Promise.all([listOrganizationMembers(ctx.organization.id), listRiskOptions(ctx.organization.id)])
    : [[], []];

  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow={ctx.organization.name} title={task.title} description="Detalhe da tarefa de tratamento e respetivos comentários." />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={priorityLabels[task.priority]} tone={priorityTones[task.priority]} />
              <StatusBadge
                label={treatmentTaskStatusLabels[task.status]}
                tone={treatmentTaskStatusTones[task.status]}
              />
            </div>
            {editable && (
              <form action={setTaskStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={task.id} />
                <select name="status" defaultValue={task.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                  {Object.values(TreatmentTaskStatus).map((status) => (
                    <option key={status} value={status}>{treatmentTaskStatusLabels[status]}</option>
                  ))}
                </select>
                <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Atualizar estado
                </button>
              </form>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{task.assignee?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Prazo</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(task.dueDate)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Risco associado</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                <Link
                  href={`/organizacoes/${ctx.organization.id}/riscos/${task.risk.id}`}
                  className="text-blue-800 hover:underline"
                >
                  {task.risk.title}
                </Link>{" "}
                <StatusBadge label={riskLevelLabels[task.risk.riskLevel]} tone={riskLevelTones[task.risk.riskLevel]} />{" "}
                <StatusBadge label={riskStatusLabels[task.risk.status]} tone={riskStatusTones[task.risk.status]} />
              </dd>
            </div>
          </dl>
          {task.description && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{task.description}</p>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Comentários ({task.comments.length})</h2>
          {task.comments.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há comentários. Registe o progresso ou notas da tarefa.</p>
          ) : (
            <ul className="space-y-3">
              {task.comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{comment.author?.name ?? "Utilizador removido"}</span>
                    {" · "}
                    {formatDateTime(comment.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}
          <form action={addCommentAction} className="mt-4 flex gap-2">
            <input type="hidden" name="org" value={ctx.organization.id} />
            <input type="hidden" name="id" value={task.id} />
            <input required name="body" placeholder="Escreva um comentário..." className={inputClass} />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Comentar
            </button>
          </form>
        </section>

        {editable && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar tarefa</h2>
            <TaskForm
              action={updateTaskAction}
              members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
              risks={risks.map((risk) => ({ id: risk.id, title: risk.title, riskLevel: risk.riskLevel }))}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: task.id }}
              values={{
                riskId: task.riskId,
                title: task.title,
                description: task.description,
                assigneeId: task.assigneeId,
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
