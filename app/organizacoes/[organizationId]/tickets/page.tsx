import Link from "next/link";
import { Priority, TicketCategory, TicketStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import {
  canManageTickets,
  getAnalystPanel,
  isTicketOverdue,
  listTickets,
} from "@/lib/services/ticket.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  priorityLabels,
  priorityTones,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketStatusTones,
} from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function TicketsPage({
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
          <PageHeader eyebrow="Organização" title="Tickets e suporte" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const status = str(query.status);
  const priority = str(query.priority);
  const category = str(query.category);
  const assigneeId = str(query.assigneeId);
  const page = Number(str(query.page)) || 1;

  const [{ items, total, totalPages }, members, analystPanel] = await Promise.all([
    listTickets(ctx.organization.id, {
      status: (Object.values(TicketStatus) as string[]).includes(status) ? (status as TicketStatus) : undefined,
      priority: (Object.values(Priority) as string[]).includes(priority) ? (priority as Priority) : undefined,
      category: (Object.values(TicketCategory) as string[]).includes(category) ? (category as TicketCategory) : undefined,
      assigneeId: assigneeId || undefined,
      page,
    }),
    listOrganizationMembers(ctx.organization.id),
    canManageTickets(ctx.role) ? getAnalystPanel(ctx.organization.id, session.user.id) : null,
  ]);

  const basePath = `/organizacoes/${ctx.organization.id}/tickets`;
  const filterParams: Record<string, string> = {};
  if (status) filterParams.status = status;
  if (priority) filterParams.priority = priority;
  if (category) filterParams.category = category;
  if (assigneeId) filterParams.assigneeId = assigneeId;

  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Tickets e suporte"
          description="Qualquer colaborador pode pedir ajuda ou reportar um problema à equipa de segurança."
        />
        <FeedbackMessage error={error} success={success} />

        {analystPanel && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              O meu painel de analista — {analystPanel.assigned.length} atribuído(s),{" "}
              <span className={analystPanel.overdue.length > 0 ? "font-bold text-red-700" : ""}>
                {analystPanel.overdue.length} vencido(s)
              </span>
            </h2>
            {analystPanel.assigned.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {analystPanel.assigned.slice(0, 8).map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`${basePath}/${ticket.id}`}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-medium transition ${
                        isTicketOverdue(ticket)
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300"
                      }`}
                    >
                      {isTicketOverdue(ticket) && <span aria-label="Vencido" title="SLA ultrapassado">⏰</span>}
                      {ticket.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="status" defaultValue={status} className={`${inputClass} w-44`}>
              <option value="">Todos os estados</option>
              {Object.values(TicketStatus).map((value) => (
                <option key={value} value={value}>{ticketStatusLabels[value]}</option>
              ))}
            </select>
            <select name="priority" defaultValue={priority} className={`${inputClass} w-36`}>
              <option value="">Prioridade</option>
              {Object.values(Priority).map((value) => (
                <option key={value} value={value}>{priorityLabels[value]}</option>
              ))}
            </select>
            <select name="category" defaultValue={category} className={`${inputClass} w-40`}>
              <option value="">Categoria</option>
              {Object.values(TicketCategory).map((value) => (
                <option key={value} value={value}>{ticketCategoryLabels[value]}</option>
              ))}
            </select>
            <select name="assigneeId" defaultValue={assigneeId} className={`${inputClass} w-44`}>
              <option value="">Analista</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>{member.user.name}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          <Link
            href={`${basePath}/novo`}
            className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
          >
            + Novo ticket
          </Link>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhum ticket encontrado"
            description="Ajuste os filtros ou abra um novo pedido à equipa de segurança."
            actionHref={`${basePath}/novo`}
            actionLabel="Abrir ticket"
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Assunto</th>
                  <th className="px-5 py-3 font-semibold">Categoria</th>
                  <th className="px-5 py-3 font-semibold">Prioridade</th>
                  <th className="px-5 py-3 font-semibold">Solicitante</th>
                  <th className="px-5 py-3 font-semibold">Analista</th>
                  <th className="px-5 py-3 font-semibold">Criado</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((ticket) => {
                  const overdue = isTicketOverdue(ticket);
                  return (
                    <tr key={ticket.id} className={overdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50"}>
                      <td className="px-5 py-3">
                        <Link href={`${basePath}/${ticket.id}`} className="font-medium text-blue-800 hover:underline">
                          {overdue && <span aria-label="SLA ultrapassado" title="SLA ultrapassado">⏰ </span>}
                          {ticket.title}
                        </Link>
                        {ticket.slaHoras && <span className="block text-xs text-slate-500">SLA: {ticket.slaHoras}h</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{ticketCategoryLabels[ticket.category]}</td>
                      <td className="px-5 py-3">
                        <StatusBadge label={priorityLabels[ticket.priority]} tone={priorityTones[ticket.priority]} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{ticket.createdBy?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{ticket.assignee?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(ticket.createdAt)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticketStatusTones[ticket.status]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
        <Pagination basePath={basePath} params={filterParams} page={page} totalPages={totalPages} total={total} />
      </div>
    </AppShell>
  );
}
