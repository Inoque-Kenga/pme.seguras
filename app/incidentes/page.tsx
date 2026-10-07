import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { OrgSwitcher } from "@/components/org-switcher";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { loadModulePage } from "@/lib/module-page";
import { canEdit } from "@/lib/services/common";
import { listIncidents } from "@/lib/services/incidents.service";
import {
  incidentSeverityLabels,
  incidentSeverityTones,
  incidentStatusLabels,
  incidentStatusTones,
} from "@/lib/labels";
import { createIncidentAction, setIncidentStatusAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, ctx, organizations, roles, error, success } = await loadModulePage(searchParams);
  const incidents = ctx ? await listIncidents(ctx.organization.id) : [];
  const editable = ctx ? canEdit(ctx.role) : false;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Resposta a incidentes"
          title="Incidentes"
          description="Registe e acompanhe incidentes de segurança desde a deteção até à resolução."
        />
        <OrgSwitcher organizations={organizations} currentId={ctx?.organization.id ?? ""} basePath="/incidentes" />
        <FeedbackMessage error={error} success={success} />

        {ctx && editable && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Registar novo incidente</h2>
            <form action={createIncidentAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input required name="title" placeholder="Título do incidente *" className={inputClass} />
              <select name="severity" className={inputClass} defaultValue="MEDIUM">
                {Object.values(IncidentSeverity).map((severity) => (
                  <option key={severity} value={severity}>{incidentSeverityLabels[severity]}</option>
                ))}
              </select>
              <input name="description" placeholder="Descrição" className={inputClass} />
              <button
                type="submit"
                className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
              >
                Registar incidente
              </button>
            </form>
          </section>
        )}

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Incidente</th>
                <th className="px-5 py-3 font-semibold">Gravidade</th>
                <th className="px-5 py-3 font-semibold">Detetado em</th>
                <th className="px-5 py-3 font-semibold">Resolvido em</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                {editable && <th className="px-5 py-3 font-semibold">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={editable ? 6 : 5} className="px-5 py-8 text-center text-slate-500">
                    Nenhum incidente registado. Bom sinal!
                  </td>
                </tr>
              )}
              {incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{incident.title}</td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      label={incidentSeverityLabels[incident.severity]}
                      tone={incidentSeverityTones[incident.severity]}
                    />
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDateTime(incident.detectedAt)}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDateTime(incident.resolvedAt)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge label={incidentStatusLabels[incident.status]} tone={incidentStatusTones[incident.status]} />
                  </td>
                  {editable && (
                    <td className="px-5 py-3">
                      <form action={setIncidentStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="org" value={ctx?.organization.id} />
                        <input type="hidden" name="id" value={incident.id} />
                        <select name="status" defaultValue={incident.status} className="h-8 rounded-md border border-slate-300 px-2 text-xs">
                          {Object.values(IncidentStatus).map((status) => (
                            <option key={status} value={status}>{incidentStatusLabels[status]}</option>
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
