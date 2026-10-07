import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CategoryScoreChart, ScoreEvolutionChart, ScoreRadial } from "@/components/score-charts";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import {
  computeAndStoreSnapshot,
  getPreviousMonthScore,
  getScoreHistory,
} from "@/lib/services/security-score.service";
import { getOrgDashboardData } from "@/lib/services/dashboard.service";
import {
  incidentSeverityLabels,
  incidentSeverityTones,
  incidentStatusLabels,
  incidentStatusTones,
  priorityLabels,
  priorityTones,
  riskLevelLabels,
  riskLevelTones,
  riskStatusLabels,
  riskStatusTones,
  scoreCategoryLabels,
  scoreCategoryTones,
} from "@/lib/labels";

const semaphoreDots = { verde: "bg-emerald-500", amarelo: "bg-amber-400", vermelho: "bg-red-500" } as const;

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);

  if (!ctx) {
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow="Organização" title="Dashboard de segurança" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  // Calcula o score atual e guarda snapshot se o último tiver mais de 24h (auditado).
  const [score, history, previous, widgets] = await Promise.all([
    computeAndStoreSnapshot(ctx.organization.id, session.user.id),
    getScoreHistory(ctx.organization.id, 6),
    getPreviousMonthScore(ctx.organization.id),
    getOrgDashboardData(ctx.organization.id),
  ]);

  const basePath = `/organizacoes/${ctx.organization.id}`;
  const variation = previous ? score.total - previous.score : null;
  const historyData = [
    ...history.map((point) => ({
      data: new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(point.dataReferencia),
      score: point.score,
    })),
  ];
  // Garante que o ponto atual aparece no fim da linha.
  const nowLabel = new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(new Date());
  if (historyData.length === 0 || historyData[historyData.length - 1].data !== nowLabel) {
    historyData.push({ data: nowLabel, score: score.total });
  } else {
    historyData[historyData.length - 1] = { data: nowLabel, score: score.total };
  }

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Dashboard de segurança"
          description="Score calculado a partir dos dados reais registados na plataforma. Indicadores sem dados recebem pontuação conservadora."
        />

        <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-xs leading-5 text-blue-950">
          <strong>Ambiente de demonstração:</strong> os dados são fictícios e/ou introduzidos manualmente.
          {score.incompleteCount > 0 &&
            ` ${score.incompleteCount} categoria(s) com dados incompletos (marcadas ⚠︎) — pontuação conservadora aplicada.`}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Score geral */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Score geral</h2>
            <div className="mt-2">
              <ScoreRadial score={score.total} categoria={score.categoria} />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <StatusBadge label={scoreCategoryLabels[score.categoria]} tone={scoreCategoryTones[score.categoria]} />
              {variation !== null && (
                <span
                  className={`text-xs font-semibold ${variation >= 0 ? "text-emerald-700" : "text-red-700"}`}
                  title="Variação face ao mês anterior"
                >
                  {variation >= 0 ? "▲" : "▼"} {Math.abs(variation)} pts vs. mês anterior
                </span>
              )}
            </div>
          </section>

          {/* Score por categoria */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Score por categoria <span className="font-normal text-slate-400">(⚠︎ = dados incompletos)</span>
            </h2>
            <div className="mt-4">
              <CategoryScoreChart
                data={score.categories.map((category) => ({
                  label: category.label,
                  score: category.score,
                  weight: category.weight,
                  incomplete: category.incomplete,
                }))}
              />
            </div>
          </section>
        </div>

        {/* Evolução */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Evolução nos últimos 6 meses</h2>
          <ScoreEvolutionChart data={historyData} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Fatores de redução */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Principais fatores que reduzem o score</h2>
            <ul className="mt-4 space-y-3">
              {score.factors.map((factor) => (
                <li key={factor.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    <span className="font-medium text-slate-900">{factor.label}</span> — {factor.detail}
                  </span>
                  <span className="shrink-0 font-semibold text-red-700">-{factor.weight - factor.score}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Ações recomendadas */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Ações recomendadas para os próximos 30 dias</h2>
            {score.recommendations.length === 0 ? (
              <p className="mt-4 text-sm text-emerald-700">Excelente trabalho — sem ações urgentes. 🎉</p>
            ) : (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                {score.recommendations.map((recommendation) => (
                  <li key={recommendation}>{recommendation}</li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Riscos críticos/altos */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Riscos críticos e altos abertos</h2>
              <Link href={`${basePath}/riscos`} className="text-xs font-semibold text-blue-700 hover:underline">
                Ver todos →
              </Link>
            </div>
            {widgets.topRisks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Sem riscos altos ou críticos abertos. Bom sinal!</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {widgets.topRisks.map((risk) => (
                  <li key={risk.id}>
                    <Link
                      href={`${basePath}/riscos/${risk.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm transition hover:border-blue-300"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-800">⚠️ {risk.title}</span>
                      <span className="flex shrink-0 gap-1.5">
                        <StatusBadge label={`${risk.level} · ${riskLevelLabels[risk.riskLevel as keyof typeof riskLevelLabels]}`} tone={riskLevelTones[risk.riskLevel as keyof typeof riskLevelTones]} />
                        <StatusBadge label={riskStatusLabels[risk.status as keyof typeof riskStatusLabels]} tone={riskStatusTones[risk.status as keyof typeof riskStatusTones]} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Estado dos backups */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Estado dos backups</h2>
              <Link href={`${basePath}/backups`} className="text-xs font-semibold text-blue-700 hover:underline">
                Gerir backups →
              </Link>
            </div>
            {widgets.backups.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Nenhum backup registado.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {widgets.backups.map((backup) => (
                  <li key={backup.id}>
                    <Link href={`${basePath}/backups/${backup.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 transition hover:border-blue-300">
                      <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-800">
                        <span aria-hidden="true" className={`inline-block size-3 shrink-0 rounded-full ${semaphoreDots[backup.semaphore]}`} />
                        <span className="truncate">{backup.sistemaAtivo}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{formatDate(backup.ultimaExecucao)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mb-6 mt-6 grid gap-6 lg:grid-cols-2">
          {/* Tickets abertos por prioridade */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Tickets abertos por prioridade</h2>
              <Link href={`${basePath}/tickets`} className="text-xs font-semibold text-blue-700 hover:underline">
                Ver tickets →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {widgets.ticketsByPriority.map((entry) => (
                <div key={entry.priority} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{entry.count}</p>
                  <StatusBadge label={priorityLabels[entry.priority]} tone={priorityTones[entry.priority]} />
                </div>
              ))}
            </div>
          </section>

          {/* Incidentes recentes */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Incidentes dos últimos 30 dias</h2>
              <Link href={`${basePath}/incidentes`} className="text-xs font-semibold text-blue-700 hover:underline">
                Ver incidentes →
              </Link>
            </div>
            {widgets.recentIncidents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Sem incidentes nos últimos 30 dias. Bom sinal!</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {widgets.recentIncidents.map((incident) => (
                  <li key={incident.id}>
                    <Link
                      href={`${basePath}/incidentes/${incident.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm transition hover:border-blue-300"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-800">
                        {incident.severity === "CRITICAL" ? "🚨 " : ""}
                        {incident.title}
                      </span>
                      <span className="flex shrink-0 gap-1.5">
                        <StatusBadge
                          label={incidentSeverityLabels[incident.severity as keyof typeof incidentSeverityLabels]}
                          tone={incidentSeverityTones[incident.severity as keyof typeof incidentSeverityTones]}
                        />
                        <StatusBadge
                          label={incidentStatusLabels[incident.status as keyof typeof incidentStatusLabels]}
                          tone={incidentStatusTones[incident.status as keyof typeof incidentStatusTones]}
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
