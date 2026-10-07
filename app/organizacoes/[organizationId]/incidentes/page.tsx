import Link from "next/link";
import { IncidentSeverity, IncidentStatus, IncidentType } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditIncidents, listIncidents } from "@/lib/services/incident.service";
import {
  incidentSeverityLabels,
  incidentSeverityTones,
  incidentStatusLabels,
  incidentStatusTones,
  incidentTypeLabels,
} from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function IncidentsPage({
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
          <PageHeader eyebrow="Organização" title="Incidentes de segurança" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const type = str(query.type);
  const severity = str(query.severity);
  const status = str(query.status);
  const page = Number(str(query.page)) || 1;

  const { items, total, totalPages } = await listIncidents(ctx.organization.id, {
    type: (Object.values(IncidentType) as string[]).includes(type) ? (type as IncidentType) : undefined,
    severity: (Object.values(IncidentSeverity) as string[]).includes(severity)
      ? (severity as IncidentSeverity)
      : undefined,
    status: (Object.values(IncidentStatus) as string[]).includes(status) ? (status as IncidentStatus) : undefined,
    page,
  });

  const basePath = `/organizacoes/${ctx.organization.id}/incidentes`;
  const editable = canEditIncidents(ctx.role);
  const filterParams: Record<string, string> = {};
  if (type) filterParams.type = type;
  if (severity) filterParams.severity = severity;
  if (status) filterParams.status = status;

  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Incidentes de segurança"
          description="Registe e acompanhe incidentes desde o reporte até ao encerramento, com linha do tempo e lições aprendidas."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="type" defaultValue={type} className={`${inputClass} w-52`}>
              <option value="">Todos os tipos</option>
              {Object.values(IncidentType).map((value) => (
                <option key={value} value={value}>{incidentTypeLabels[value]}</option>
              ))}
            </select>
            <select name="severity" defaultValue={severity} className={`${inputClass} w-40`}>
              <option value="">Severidade</option>
              {Object.values(IncidentSeverity).map((value) => (
                <option key={value} value={value}>{incidentSeverityLabels[value]}</option>
              ))}
            </select>
            <select name="status" defaultValue={status} className={`${inputClass} w-40`}>
              <option value="">Estado</option>
              {Object.values(IncidentStatus).map((value) => (
                <option key={value} value={value}>{incidentStatusLabels[value]}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {editable && (
            <Link
              href={`${basePath}/novo`}
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Registar incidente
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhum incidente registado"
            description="Bom sinal! Quando houver um incidente, registe-o aqui para coordenar a resposta."
            actionHref={editable ? `${basePath}/novo` : undefined}
            actionLabel={editable ? "Registar incidente" : undefined}
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Incidente</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Severidade</th>
                  <th className="px-5 py-3 font-semibold">Ocorrência</th>
                  <th className="px-5 py-3 font-semibold">Responsável</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((incident) => {
                  const critical = incident.severity === "CRITICAL";
                  return (
                    <tr key={incident.id} className={critical ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50"}>
                      <td className="px-5 py-3">
                        <Link href={`${basePath}/${incident.id}`} className="font-medium text-blue-800 hover:underline">
                          {critical && <span aria-label="Incidente crítico" title="Incidente crítico">🚨 </span>}
                          {incident.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{incidentTypeLabels[incident.type]}</td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          label={incidentSeverityLabels[incident.severity]}
                          tone={incidentSeverityTones[incident.severity]}
                        />
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDateTime(incident.detectedAt)}</td>
                      <td className="px-5 py-3 text-slate-600">{incident.responsavel?.name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <StatusBadge label={incidentStatusLabels[incident.status]} tone={incidentStatusTones[incident.status]} />
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
