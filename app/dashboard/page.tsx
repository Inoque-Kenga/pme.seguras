import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AssetCriticalityChart, ModuleCountChart } from "@/components/dashboard-charts";
import { FeedbackMessage } from "@/components/feedback-message";
import { OrgSwitcher } from "@/components/org-switcher";
import { loadModulePage } from "@/lib/module-page";
import { getDashboardData } from "@/lib/services/score.service";
import { criticalityLabels } from "@/lib/labels";

const criticalityColors: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#2563eb",
  HIGH: "#d97706",
  CRITICAL: "#dc2626",
};

const levelStyles: Record<string, string> = {
  Bom: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Razoável": "border-blue-200 bg-blue-50 text-blue-900",
  Fraco: "border-amber-200 bg-amber-50 text-amber-900",
  "Crítico": "border-red-200 bg-red-50 text-red-900",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, ctx, organizations, roles, error, success } = await loadModulePage(searchParams);
  const data = ctx ? await getDashboardData(ctx.organization.id) : null;

  const moduleCounts = data
    ? [
        { name: "Ativos", total: data.counts.assets },
        { name: "Riscos", total: data.counts.risks },
        { name: "Tarefas abertas", total: data.counts.openTasks },
        { name: "Tickets abertos", total: data.counts.openTickets },
        { name: "Incidentes ativos", total: data.counts.openIncidents },
        { name: "Campanhas", total: data.counts.campaigns },
      ]
    : [];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-700">Área de trabalho</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Painel de segurança{ctx ? ` — ${ctx.organization.name}` : ""}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Visão geral da postura de segurança da organização, com o score calculado a partir dos dados registados.
          </p>
        </div>
        <OrgSwitcher organizations={organizations} currentId={ctx?.organization.id ?? ""} basePath="/dashboard" />
        <FeedbackMessage error={error} success={success} />

        {!ctx || !data ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            A sua conta não está associada a nenhuma organização ativa. Contacte o administrador.
          </p>
        ) : (
          <>
            <section className={`mb-6 rounded-xl border p-6 ${levelStyles[data.score.level]}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide opacity-80">Score de segurança</p>
                  <p className="mt-1 text-5xl font-bold">{data.score.score}<span className="text-xl font-semibold">/100</span></p>
                  <p className="mt-1 text-sm font-semibold">Nível: {data.score.level}</p>
                </div>
                <ul className="min-w-64 flex-1 space-y-1 text-sm">
                  {data.score.factors.map((factor) => (
                    <li key={factor.key} className="flex items-center justify-between gap-4">
                      <span>
                        {factor.label} — <span className="opacity-75">{factor.detail}</span>
                      </span>
                      <span className="font-semibold">-{factor.deduction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-base font-semibold text-slate-900">Registos por módulo</h2>
                <ModuleCountChart data={moduleCounts} />
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-base font-semibold text-slate-900">Ativos por criticidade</h2>
                <AssetCriticalityChart
                  data={data.assetsByCriticality.map((entry) => ({
                    name: criticalityLabels[entry.criticality as keyof typeof criticalityLabels],
                    value: entry.count,
                    color: criticalityColors[entry.criticality] ?? "#64748b",
                  }))}
                />
              </section>
            </div>

            <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Atalhos para os módulos">
              {(
                [
                  ["/ativos", "Ativos"],
                  ["/riscos", "Riscos"],
                  ["/tarefas", "Tarefas"],
                  ["/backups", "Backups"],
                  ["/tickets", "Tickets"],
                  ["/incidentes", "Incidentes"],
                  ["/phishing", "Phishing"],
                ] as const
              ).map(([href, label]) => (
                <Link
                  key={href}
                  href={`${href}?org=${ctx.organization.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-800"
                >
                  {label} →
                </Link>
              ))}
            </nav>

            <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
              <p className="font-semibold">Ambiente de demonstração</p>
              <p className="mt-1">
                Esta plataforma apoia a gestão de riscos e não substitui uma auditoria formal ou consultoria jurídica.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
