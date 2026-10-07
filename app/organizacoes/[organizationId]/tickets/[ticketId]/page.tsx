import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canAssignTickets, canManageTickets, getTicket, isTicketOverdue } from "@/lib/services/ticket.service";
import { listAssetOptions } from "@/lib/services/asset.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  priorityLabels,
  priorityTones,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketStatusTones,
} from "@/lib/labels";
import { TicketForm } from "../ticket-form";
import { addTicketCommentAction, assignTicketAction, setTicketStatusAction, updateTicketAction } from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; ticketId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, ticketId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const ticket = await getTicket(ctx.organization.id, ticketId);
  if (!ticket) notFound();

  const manageable = canManageTickets(ctx.role);
  const assignable = canAssignTickets(ctx.role);
  const isRequester = ticket.createdById === session.user.id;
  const canComment = manageable || isRequester;

  const [members, assets] = manageable
    ? await Promise.all([listOrganizationMembers(ctx.organization.id), listAssetOptions(ctx.organization.id)])
    : [[], []];
  const analysts = members.filter((member) => member.role === "ANALISTA_SEGURANCA" || member.role === "SUPER_ADMIN");

  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;
  const overdue = isTicketOverdue(ticket);

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow={ctx.organization.name} title={ticket.title} description="Detalhe do ticket, comentários e histórico." />
        <FeedbackMessage error={error} success={success} />

        {overdue && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            ⏰ Este ticket ultrapassou o SLA de {ticket.slaHoras} horas e continua por resolver.
          </p>
        )}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticketStatusTones[ticket.status]} />
              <StatusBadge label={priorityLabels[ticket.priority]} tone={priorityTones[ticket.priority]} />
              <StatusBadge label={ticketCategoryLabels[ticket.category]} tone="slate" />
            </div>
            {manageable && (
              <form action={setTicketStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={ticket.id} />
                <select name="status" defaultValue={ticket.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                  {Object.values(TicketStatus).map((value) => (
                    <option key={value} value={value}>{ticketStatusLabels[value]}</option>
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
              <dt className="text-slate-500">Solicitante</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{ticket.createdBy?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Analista</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {assignable ? (
                  <form action={assignTicketAction} className="flex items-center gap-2">
                    <input type="hidden" name="org" value={ctx.organization.id} />
                    <input type="hidden" name="id" value={ticket.id} />
                    <select name="assigneeId" defaultValue={ticket.assigneeId ?? ""} className="h-8 rounded-md border border-slate-300 px-2 text-xs">
                      <option value="">Por atribuir</option>
                      {analysts.map((member) => (
                        <option key={member.user.id} value={member.user.id}>{member.user.name}</option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">Atribuir</button>
                  </form>
                ) : (
                  (ticket.assignee?.name ?? "Por atribuir")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Ativo</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{ticket.asset?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">SLA</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{ticket.slaHoras ? `${ticket.slaHoras} horas` : "—"}</dd>
            </div>
          </dl>
          {ticket.incident && (
            <p className="mt-4 text-sm">
              <span className="text-slate-500">Incidente relacionado: </span>
              <Link
                href={`/organizacoes/${ctx.organization.id}/incidentes/${ticket.incident.id}`}
                className="font-medium text-blue-800 hover:underline"
              >
                {ticket.incident.title}
              </Link>
            </p>
          )}
          {ticket.description && (
            <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{ticket.description}</p>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Comentários ({ticket.comments.length})</h2>
          {ticket.comments.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há comentários neste ticket.</p>
          ) : (
            <ul className="space-y-3">
              {ticket.comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{comment.author?.name ?? "Utilizador removido"}</span>
                    {" · "}
                    {formatDateTime(comment.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{comment.conteudo}</p>
                </li>
              ))}
            </ul>
          )}
          {canComment && (
            <form action={addTicketCommentAction} className="mt-4 flex gap-2">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input type="hidden" name="id" value={ticket.id} />
              <input required name="conteudo" placeholder="Escreva um comentário..." className={inputClass} />
              <button type="submit" className="h-10 shrink-0 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
                Comentar
              </button>
            </form>
          )}
        </section>

        {ticket.events.length > 0 && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Histórico</h2>
            <ul className="space-y-2 text-sm">
              {ticket.events.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-2 last:border-0">
                  <span className="text-slate-700">{event.descricao}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {event.autor?.name ?? "Sistema"} · {formatDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {manageable && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar ticket</h2>
            <TicketForm
              action={updateTicketAction}
              assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: ticket.id }}
              values={{
                title: ticket.title,
                description: ticket.description,
                category: ticket.category,
                priority: ticket.priority,
                slaHoras: ticket.slaHoras,
                assetId: ticket.assetId,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
