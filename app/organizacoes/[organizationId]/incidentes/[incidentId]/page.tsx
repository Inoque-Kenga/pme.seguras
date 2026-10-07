import Link from "next/link";
import { notFound } from "next/navigation";
import { IncidentStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditIncidents, getIncident } from "@/lib/services/incident.service";
import { listAssetOptions } from "@/lib/services/asset.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  incidentSeverityLabels,
  incidentSeverityTones,
  incidentStatusLabels,
  incidentStatusTones,
  incidentTypeLabels,
  ticketStatusLabels,
  ticketStatusTones,
} from "@/lib/labels";
import { IncidentForm } from "../incident-form";
import {
  addTimelineEventAction,
  convertToTicketAction,
  setIncidentStatusAction,
  updateIncidentAction,
} from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

const RESPONSE_CHECKLIST = [
  "Isolar o equipamento da rede (não desligar, se possível)",
  "Preservar evidências (e-mails, ficheiros, registos)",
  "Avaliar o estado das cópias de segurança",
  "Contactar apoio técnico / autoridades, se necessário",
  "Registar ações na linha do tempo",
];

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; incidentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, incidentId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const incident = await getIncident(ctx.organization.id, incidentId);
  if (!incident) notFound();

  const editable = canEditIncidents(ctx.role);
  const [members, assets] = editable
    ? await Promise.all([listOrganizationMembers(ctx.organization.id), listAssetOptions(ctx.organization.id)])
    : [[], []];

  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;
  const critical = incident.severity === "CRITICAL";
  const isRansomware = incident.type === "RANSOMWARE";

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow={ctx.organization.name} title={incident.title} description="Detalhe do incidente, linha do tempo e resposta." />
        <FeedbackMessage error={error} success={success} />

        {isRansomware && (
          <section className="mb-6 rounded-xl border border-red-300 bg-red-50 p-5 text-sm leading-6 text-red-900">
            <p className="font-bold">🚨 Orientação para ransomware</p>
            <ul className="mt-1 list-inside list-disc">
              <li>
                <strong>Não pagar resgate</strong> — o pagamento não garante a recuperação e financia criminosos.
              </li>
              <li>Isolar imediatamente os equipamentos afetados da rede.</li>
              <li>Preservar evidências para investigação.</li>
              <li>Avaliar as cópias de segurança antes de qualquer restauro.</li>
              <li>Contactar apoio técnico especializado e as autoridades.</li>
            </ul>
          </section>
        )}

        <section className={`mb-6 rounded-xl border bg-white p-6 ${critical ? "border-red-200" : "border-slate-200"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {critical && <span className="text-lg" aria-label="Incidente crítico" title="Incidente crítico">🚨</span>}
              <StatusBadge label={incidentSeverityLabels[incident.severity]} tone={incidentSeverityTones[incident.severity]} />
              <StatusBadge label={incidentTypeLabels[incident.type]} tone="slate" />
              <StatusBadge label={incidentStatusLabels[incident.status]} tone={incidentStatusTones[incident.status]} />
            </div>
            {editable && (
              <div className="flex flex-wrap items-center gap-3">
                <form action={setIncidentStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="org" value={ctx.organization.id} />
                  <input type="hidden" name="id" value={incident.id} />
                  <select name="status" defaultValue={incident.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                    {Object.values(IncidentStatus).map((value) => (
                      <option key={value} value={value}>{incidentStatusLabels[value]}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                    Atualizar estado
                  </button>
                </form>
                <form action={convertToTicketAction}>
                  <input type="hidden" name="org" value={ctx.organization.id} />
                  <input type="hidden" name="id" value={incident.id} />
                  <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                    Converter em ticket →
                  </button>
                </form>
                <Link
                  href={`/organizacoes/${ctx.organization.id}/riscos/novo`}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  Registar como risco →
                </Link>
              </div>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Ocorrência</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(incident.detectedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{incident.responsavel?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ativo</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{incident.asset?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Encerrado em</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(incident.resolvedAt)}</dd>
            </div>
          </dl>
          {incident.sistemasAfetados && (
            <p className="mt-4 text-sm">
              <span className="font-medium text-slate-700">Sistemas afetados: </span>
              <span className="text-slate-600">{incident.sistemasAfetados}</span>
            </p>
          )}
          {incident.description && (
            <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{incident.description}</p>
          )}
          {incident.acoesImediatas && (
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-950">
              <strong>Ações imediatas:</strong> {incident.acoesImediatas}
            </p>
          )}
          {incident.licoesAprendidas && (
            <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
              <strong>Lições aprendidas:</strong> {incident.licoesAprendidas}
            </p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Checklist de resposta</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {RESPONSE_CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5 inline-block size-4 rounded border border-slate-300" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Tickets ligados ({incident.tickets.length})</h2>
            {incident.tickets.length === 0 ? (
              <p className="text-sm text-slate-500">Sem tickets criados a partir deste incidente.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {incident.tickets.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/organizacoes/${ctx.organization.id}/tickets/${ticket.id}`}
                      className="min-w-0 truncate font-medium text-blue-800 hover:underline"
                    >
                      {ticket.title}
                    </Link>
                    <StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticketStatusTones[ticket.status]} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Linha do tempo ({incident.timeline.length})</h2>
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
            {incident.timeline.map((event) => (
              <li key={event.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[27px] top-1 inline-block size-3 rounded-full ${
                    event.tipo === "STATUS_CHANGE" ? "bg-blue-500" : event.tipo === "ACAO" ? "bg-amber-500" : "bg-slate-400"
                  }`}
                />
                <p className="text-sm text-slate-800">{event.descricao}</p>
                <p className="text-xs text-slate-400">
                  {event.autor?.name ?? "Sistema"} · {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
          {editable && (
            <form action={addTimelineEventAction} className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input type="hidden" name="id" value={incident.id} />
              <select name="tipo" defaultValue="ACAO" className={`${inputClass} w-36`}>
                <option value="ACAO">Ação</option>
                <option value="NOTA">Nota</option>
              </select>
              <input required name="descricao" placeholder="Descreva a ação ou nota..." className={`${inputClass} min-w-52 flex-1`} />
              <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
                Registar
              </button>
            </form>
          )}
        </section>

        {editable && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar incidente</h2>
            <IncidentForm
              action={updateIncidentAction}
              members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
              assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: incident.id }}
              values={{
                title: incident.title,
                description: incident.description,
                type: incident.type,
                severity: incident.severity,
                detectedAt: incident.detectedAt,
                sistemasAfetados: incident.sistemasAfetados,
                acoesImediatas: incident.acoesImediatas,
                licoesAprendidas: incident.licoesAprendidas,
                responsavelId: incident.responsavelId,
                assetId: incident.assetId,
                status: incident.status,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
