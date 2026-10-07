import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditAssets, getAssetDetail } from "@/lib/services/asset.service";
import {
  assetStatusLabels,
  assetStatusTones,
  assetTypeLabels,
  criticalityLabels,
  criticalityTones,
  incidentSeverityLabels,
  incidentSeverityTones,
  incidentStatusLabels,
  incidentStatusTones,
  riskStatusLabels,
  riskStatusTones,
  ticketStatusLabels,
  ticketStatusTones,
} from "@/lib/labels";
import { AssetForm } from "../asset-form";
import { archiveAssetAction, updateAssetAction } from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assetId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, assetId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const asset = await getAssetDetail(ctx.organization.id, assetId);
  if (!asset) notFound();

  const editable = canEditAssets(ctx.role) && !asset.archivedAt;
  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  const info: [string, React.ReactNode][] = [
    ["Tipo", assetTypeLabels[asset.type]],
    ["Marca / Modelo", asset.marcaModelo ?? "—"],
    ["Número de série", asset.numeroSerie ?? "—"],
    ["Sistema operativo", asset.sistemaOperativo ?? "—"],
    ["Endereço IP", asset.ip ?? "—"],
    ["Localização", asset.location ?? "—"],
    ["Proprietário", asset.owner ?? "—"],
    ["Última atualização", formatDate(asset.ultimaAtualizacao)],
    ["Proteção de endpoint", asset.protecaoEndpoint ? "Sim" : "Não"],
    ["MFA aplicável", asset.mfaAplicavel ? "Sim" : "Não"],
    ["Cifragem", asset.cifragem ? "Sim" : "Não"],
  ];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-5xl">
        <PageHeader eyebrow={ctx.organization.name} title={asset.name} description="Detalhe completo do ativo e registos associados." />
        <FeedbackMessage error={error} success={success} />

        {asset.archivedAt && (
          <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            Este ativo está arquivado e é apresentado apenas para consulta histórica.
          </p>
        )}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={criticalityLabels[asset.criticality]} tone={criticalityTones[asset.criticality]} />
              <StatusBadge label={assetStatusLabels[asset.status]} tone={assetStatusTones[asset.status]} />
            </div>
            {editable && (
              <ConfirmAction
                triggerLabel="Arquivar ativo"
                title="Arquivar ativo?"
                description={`O ativo "${asset.name}" deixará de aparecer nas listagens e indicadores. Os dados são mantidos.`}
                confirmLabel="Sim, arquivar"
                action={archiveAssetAction}
                fields={{ org: ctx.organization.id, id: asset.id }}
              />
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            {info.map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {asset.description && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{asset.description}</p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Riscos associados ({asset.risks.length})</h2>
            {asset.risks.length === 0 ? (
              <p className="text-sm text-slate-500">Sem riscos associados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {asset.risks.map((risk) => (
                  <li key={risk.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-700">{risk.title}</span>
                    <StatusBadge label={riskStatusLabels[risk.status]} tone={riskStatusTones[risk.status]} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Tickets associados ({asset.tickets.length})</h2>
            {asset.tickets.length === 0 ? (
              <p className="text-sm text-slate-500">Sem tickets associados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {asset.tickets.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-700">{ticket.title}</span>
                    <StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticketStatusTones[ticket.status]} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Incidentes associados ({asset.incidents.length})</h2>
            {asset.incidents.length === 0 ? (
              <p className="text-sm text-slate-500">Sem incidentes associados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {asset.incidents.map((incident) => (
                  <li key={incident.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-slate-700">{incident.title}</span>
                      <StatusBadge
                        label={incidentSeverityLabels[incident.severity]}
                        tone={incidentSeverityTones[incident.severity]}
                      />
                    </div>
                    <StatusBadge
                      label={incidentStatusLabels[incident.status]}
                      tone={incidentStatusTones[incident.status]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {editable && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar ativo</h2>
            <AssetForm
              action={updateAssetAction}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: asset.id }}
              values={{
                name: asset.name,
                type: asset.type,
                marcaModelo: asset.marcaModelo,
                numeroSerie: asset.numeroSerie,
                sistemaOperativo: asset.sistemaOperativo,
                ip: asset.ip,
                location: asset.location,
                owner: asset.owner,
                criticality: asset.criticality,
                status: asset.status,
                protecaoEndpoint: asset.protecaoEndpoint,
                ultimaAtualizacao: asset.ultimaAtualizacao,
                mfaAplicavel: asset.mfaAplicavel,
                cifragem: asset.cifragem,
                description: asset.description,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
