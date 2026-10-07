import Link from "next/link";
import { Priority, TreatmentTaskStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditTasks, getTaskIndicators, listTasks } from "@/lib/services/treatment-task.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  priorityLabels,
  priorityTones,
  riskLevelLabels,
  riskLevelTones,
  treatmentTaskStatusLabels,
  treatmentTaskStatusTones,
} from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

function isOverdue(status: TreatmentTaskStatus, dueDate: Date | null) {
  return (status === "NAO_INICIADA" || status === "EM_ANDAMENTO") && dueDate !== null && dueDate < new Date();
}

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);

  if (!ctx) {
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow="Organização" title="Tarefas de tratamento" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const status = str(query.status);
  const priority = str(query.priority);
  const assigneeId = str(query.assigneeId);
  const due = str(query.due);
  const page = Number(str(query.page)) || 1;

  const [{ items, total, totalPages }, indicators, members] = await Promise.all([
    listTasks(ctx.organization.id, {
      status: (Object.values(TreatmentTaskStatus) as string[]).includes(status)
        ? (status as TreatmentTaskStatus)
        : undefined,
      priority: (Object.values(Priority) as string[]).includes(priority) ? (priority as Priority) : undefined,
      assigneeId: assigneeId || undefined,
      due: (["vencidas", "proximas7", "sem_prazo"] as const).find((value) => value === due),
      page,
    }),
    getTaskIndicators(ctx.organization.id),
    listOrganizationMembers(ctx.organization.id),
  ]);

  const basePath = `/organizacoes/${ctx.organization.id}/tarefas`;
  const editable = canEditTasks(ctx.role);
  const filterParams: Record<string, string> = {};
  if (status) filterParams.status = status;
  if (priority) filterParams.priority = priority;
  if (assigneeId) filterParams.assigneeId = assigneeId;
  if (due) filterParams.due = due;

  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Tarefas de tratamento"
          description="Ações concretas para tratar os riscos identificados, com responsável, prioridade e prazo."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Tarefas vencidas</p>
            <p className={`mt-1 text-2xl font-bold ${indicators.overdue > 0 ? "text-red-700" : "text-slate-900"}`}>
              {indicators.overdue}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Prioridade alta/urgente abertas</p>
            <p className={`mt-1 text-2xl font-bold ${indicators.highPriorityOpen > 0 ? "text-amber-700" : "text-slate-900"}`}>
              {indicators.highPriorityOpen}
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="status" defaultValue={status} className={`${inputClass} w-44`}>
              <option value="">Todos os estados</option>
              {Object.values(TreatmentTaskStatus).map((value) => (
                <option key={value} value={value}>{treatmentTaskStatusLabels[value]}</option>
              ))}
            </select>
            <select name="priority" defaultValue={priority} className={`${inputClass} w-40`}>
              <option value="">Prioridade</option>
              {Object.values(Priority).map((value) => (
                <option key={value} value={value}>{priorityLabels[value]}</option>
              ))}
            </select>
            <select name="assigneeId" defaultValue={assigneeId} className={`${inputClass} w-44`}>
              <option value="">Responsável</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>{member.user.name}</option>
              ))}
            </select>
            <select name="due" defaultValue={due} className={`${inputClass} w-40`}>
              <option value="">Prazo</option>
              <option value="vencidas">Vencidas</option>
              <option value="proximas7">Próximos 7 dias</option>
              <option value="sem_prazo">Sem prazo</option>
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {editable && (
            <Link
              href={`${basePath}/nova`}
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Nova tarefa
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma tarefa encontrada"
            description="Ajuste os filtros ou crie a primeira tarefa de tratamento associada a um risco."
            actionHref={editable ? `${basePath}/nova` : undefined}
            actionLabel={editable ? "Criar tarefa" : undefined}
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tarefa</th>
                  <th className="px-5 py-3 font-semibold">Risco</th>
                  <th className="px-5 py-3 font-semibold">Prioridade</th>
                  <th className="px-5 py-3 font-semibold">Responsável</th>
                  <th className="px-5 py-3 font-semibold">Prazo</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Comentários</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`${basePath}/${task.id}`} className="font-medium text-blue-800 hover:underline">
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/organizacoes/${ctx.organization.id}/riscos/${task.risk.id}`}
                        className="text-slate-600 hover:text-blue-800"
                      >
                        {task.risk.title}
                      </Link>
                      <StatusBadge label={riskLevelLabels[task.risk.riskLevel]} tone={riskLevelTones[task.risk.riskLevel]} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={priorityLabels[task.priority]} tone={priorityTones[task.priority]} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{task.assignee?.name ?? "—"}</td>
                    <td className={`px-5 py-3 ${isOverdue(task.status, task.dueDate) ? "font-semibold text-red-700" : "text-slate-600"}`}>
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={treatmentTaskStatusLabels[task.status]}
                        tone={treatmentTaskStatusTones[task.status]}
                      />
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{task._count.comments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <Pagination basePath={basePath} params={filterParams} page={page} totalPages={totalPages} total={total} />
      </div>
    </AppShell>
  );
}
