import { PhishingCampaignStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { OrgSwitcher } from "@/components/org-switcher";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { loadModulePage } from "@/lib/module-page";
import { canEdit } from "@/lib/services/common";
import { listCampaigns } from "@/lib/services/phishing.service";
import { phishingStatusLabels, phishingStatusTones } from "@/lib/labels";
import { createCampaignAction, setCampaignStatusAction, updateCampaignCountersAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function percent(part: number, total: number) {
  if (total <= 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function PhishingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, ctx, organizations, roles, error, success } = await loadModulePage(searchParams);
  const campaigns = ctx ? await listCampaigns(ctx.organization.id) : [];
  const editable = ctx ? canEdit(ctx.role) : false;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Sensibilização"
          title="Simulações de phishing"
          description="Campanhas simuladas para medir a prontidão dos colaboradores. Nesta fase não há envio real de e-mails."
        />
        <OrgSwitcher organizations={organizations} currentId={ctx?.organization.id ?? ""} basePath="/phishing" />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          Os contadores são registados manualmente ou por integrações futuras. Nenhum e-mail é enviado pela plataforma
          nesta fase.
        </section>

        {ctx && editable && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Nova campanha de simulação</h2>
            <form action={createCampaignAction} className="mt-4 grid gap-4 sm:grid-cols-3">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input required name="name" placeholder="Nome da campanha *" className={inputClass} />
              <input
                required
                name="targetCount"
                type="number"
                min={0}
                placeholder="Destinatários previstos *"
                className={inputClass}
              />
              <button
                type="submit"
                className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
              >
                Criar campanha
              </button>
            </form>
          </section>
        )}

        <div className="space-y-4">
          {campaigns.length === 0 && (
            <section className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
              Ainda não existem campanhas de simulação nesta organização.
            </section>
          )}
          {campaigns.map((campaign) => (
            <section key={campaign.id} className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{campaign.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {campaign.targetCount} destinatários previstos
                    {campaign.launchedAt &&
                      ` · lançada em ${new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(campaign.launchedAt)}`}
                  </p>
                </div>
                <StatusBadge label={phishingStatusLabels[campaign.status]} tone={phishingStatusTones[campaign.status]} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Enviados</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">{campaign.sentCount}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Cliques</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">
                    {campaign.clickedCount}
                    <span className="ml-1 text-xs font-medium text-red-700">
                      {percent(campaign.clickedCount, campaign.sentCount)}
                    </span>
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Reportados</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">
                    {campaign.reportedCount}
                    <span className="ml-1 text-xs font-medium text-emerald-700">
                      {percent(campaign.reportedCount, campaign.sentCount)}
                    </span>
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Taxa de clique</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">
                    {percent(campaign.clickedCount, campaign.sentCount)}
                  </dd>
                </div>
              </dl>

              {editable && (
                <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
                  <form action={updateCampaignCountersAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="org" value={ctx?.organization.id} />
                    <input type="hidden" name="id" value={campaign.id} />
                    {(
                      [
                        ["sentCount", "Enviados", campaign.sentCount],
                        ["clickedCount", "Cliques", campaign.clickedCount],
                        ["reportedCount", "Reportados", campaign.reportedCount],
                      ] as const
                    ).map(([field, label, value]) => (
                      <label key={field} className="text-xs font-medium text-slate-500">
                        {label}
                        <input
                          name={field}
                          type="number"
                          min={0}
                          defaultValue={value}
                          className="mt-1 block h-9 w-24 rounded-md border border-slate-300 px-2 text-sm"
                        />
                      </label>
                    ))}
                    <button type="submit" className="h-9 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900">
                      Guardar contadores
                    </button>
                  </form>
                  <form action={setCampaignStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="org" value={ctx?.organization.id} />
                    <input type="hidden" name="id" value={campaign.id} />
                    <select name="status" defaultValue={campaign.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                      {Object.values(PhishingCampaignStatus).map((status) => (
                        <option key={status} value={status}>{phishingStatusLabels[status]}</option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                      Atualizar estado
                    </button>
                  </form>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
