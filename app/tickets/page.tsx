import { Priority, TicketCategory, TicketStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { OrgSwitcher } from "@/components/org-switcher";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { loadModulePage } from "@/lib/module-page";
import { canEdit } from "@/lib/services/common";
import { listTickets } from "@/lib/services/tickets.service";
import {
  priorityLabels,
  priorityTones,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketStatusTones,
} from "@/lib/labels";
import { createTicketAction, setTicketStatusAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, ctx, organizations, roles, error, success } = await loadModulePage(searchParams);
  const tickets = ctx ? await listTickets(ctx.organization.id) : [];
  const editable = ctx ? canEdit(ctx.role) : false;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Suporte"
          title="Tickets"
          description="Qualquer colaborador pode abrir um pedido ou reportar um problema à equipa de segurança."
        />
        <OrgSwitcher organizations={organizations} currentId={ctx?.organization.id ?? ""} basePath="/tickets" />
        <FeedbackMessage error={error} success={success} />

        {ctx && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Abrir novo ticket</h2>
            <form action={createTicketAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input required name="title" placeholder="Assunto *" className={inputClass} />
              <select name="category" className={inputClass} defaultValue="REQUEST">
                {Object.values(TicketCategory).map((category) => (
                  <option key={category} value={category}>{ticketCategoryLabels[category]}</option>
                ))}
              </select>
              <select name="priority" className={inputClass} defaultValue="MEDIUM">
                {Object.values(Priority).map((priority) => (
                  <option key={priority} value={priority}>{priorityLabels[priority]}</option>
                ))}
              </select>
              <input name="description" placeholder="Descrição" className={inputClass} />
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
                >
                  Abrir ticket
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Assunto</th>
                <th className="px-5 py-3 font-semibold">Categoria</th>
                <th className="px-5 py-3 font-semibold">Prioridade</th>
                <th className="px-5 py-3 font-semibold">Criado por</th>
                <th className="px-5 py-3 font-semibold">Data</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                {editable && <th className="px-5 py-3 font-semibold">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={editable ? 7 : 6} className="px-5 py-8 text-center text-slate-500">
                    Ainda não existem tickets nesta organização.
                  </td>
                </tr>
              )}
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{ticket.title}</td>
                  <td className="px-5 py-3 text-slate-600">{ticketCategoryLabels[ticket.category]}</td>
                  <td className="px-5 py-3">
                    <StatusBadge label={priorityLabels[ticket.priority]} tone={priorityTones[ticket.priority]} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">{ticket.createdBy?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(ticket.createdAt)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticketStatusTones[ticket.status]} />
                  </td>
                  {editable && (
                    <td className="px-5 py-3">
                      <form action={setTicketStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="org" value={ctx?.organization.id} />
                        <input type="hidden" name="id" value={ticket.id} />
                        <select name="status" defaultValue={ticket.status} className="h-8 rounded-md border border-slate-300 px-2 text-xs">
                          {Object.values(TicketStatus).map((status) => (
                            <option key={status} value={status}>{ticketStatusLabels[status]}</option>
                          ))}
                        </select>
                        <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                          Atualizar
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
