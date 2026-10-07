import { notFound } from "next/navigation";
import { ReportStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageReports, getReport } from "@/lib/services/report.service";
import {
  incidentTypeLabels,
  priorityLabels,
  reportStatusLabels,
  reportStatusTones,
  riskLevelLabels,
  riskLevelTones,
  riskStatusLabels,
  scoreCategoryLabels,
  scoreCategoryTones,
} from "@/lib/labels";
import { setReportStatusAction } from "../actions";
import { PrintButton } from "../print-button";

type RiskRow = { title: string; level: number; riskLevel: keyof typeof riskLevelLabels; status: keyof typeof riskStatusLabels; owner: string | null; dueDate: string | null };
type BackupsSection = {
  total: number;
  sucesso: number;
  falha: number;
  aviso: number;
  desconhecido: number;
  semTesteRecente: number;
  semaforos: { sistemaAtivo: string; semaforo: "verde" | "amarelo" | "vermelho"; ultimaExecucao: string | null }[];
};
type TicketsSection = {
  tickets: {
    abertos: number;
    vencidos: number;
    resolvidosNoMes: number;
    porPrioridade: { priority: keyof typeof priorityLabels; count: number }[];
  };
  incidentes: {
    totalNoMes: number;
    criticos: number;
    encerrados: number;
    porTipo: { type: keyof typeof incidentTypeLabels; count: number }[];
  };
};
type TrainingPoliciesSection = {
  validPercent: number | null;
  validUsers: number;
  totalMembers: number;
  keyPolicies: number;
};

const semaphoreDots = { verde: "bg-emerald-500", amarelo: "bg-amber-400", vermelho: "bg-red-500" } as const;

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeStyle: "short" }).format(date);
}

export default async function ReportViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, reportId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const report = await getReport(ctx.organization.id, reportId);
  if (!report) notFound();

  const manageable = canManageReports(ctx.role);
  const success = typeof query.success === "string" ? query.success : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;

  const risks = report.riscosCriticosAltos as unknown as RiskRow[];
  const backups = report.estadoBackups as unknown as BackupsSection;
  const ticketsIncidentes = report.ticketsIncidentes as unknown as TicketsSection;
  const trainingPolicies = report.formacoesPoliticas as unknown as TrainingPoliciesSection;
  const actions = report.acoesRecomendadas as unknown as string[];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <FeedbackMessage error={error} success={success} />
          <div className="flex flex-wrap items-center gap-3">
            <PrintButton />
            {manageable && (
              <form action={setReportStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={report.id} />
                <select name="status" defaultValue={report.status} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
                  {(["GERADO", "PUBLICADO", "ARQUIVADO"] as ReportStatus[]).map((value) => (
                    <option key={value} value={value}>{reportStatusLabels[value]}</option>
                  ))}
                </select>
                <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
                  Atualizar estado
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Documento do relatório (área imprimível) */}
        <article className="rounded-xl border border-slate-200 bg-white print:border-0 print:shadow-none">
          {/* Cabeçalho */}
          <header className="border-b-2 border-blue-800 px-8 py-6">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-800">CyberPME — Relatório mensal de segurança</p>
            <h1 className="mt-2 text-2xl font-bold capitalize text-slate-900">{monthLabel(report.mesReferencia)}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {report.organization.name}
              {report.organization.sector ? ` · ${report.organization.sector}` : ""}
              {report.organization.city ? ` · ${report.organization.city}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Gerado por {report.geradoPor?.name ?? "—"} em {formatDateTime(report.dataGeracao)} ·{" "}
              <StatusBadge label={reportStatusLabels[report.status]} tone={reportStatusTones[report.status]} />
            </p>
          </header>

          {/* 1. Resumo executivo */}
          <section className="border-b border-slate-100 px-8 py-6">
            <h2 className="text-base font-bold text-slate-900">1. Resumo executivo</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{report.resumoExecutivo}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-3xl font-bold text-slate-900">{report.scoreGlobal}<span className="text-base font-semibold text-slate-400">/100</span></span>
              <StatusBadge label={scoreCategoryLabels[report.categoria]} tone={scoreCategoryTones[report.categoria]} />
            </div>
          </section>

          {/* 2. Riscos críticos e altos */}
          <section className="border-b border-slate-100 px-8 py-6">
            <h2 className="text-base font-bold text-slate-900">2. Riscos críticos e altos em aberto ({risks.length})</h2>
            {risks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Não existem riscos de nível alto ou crítico por tratar.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Risco</th>
                    <th className="py-2 pr-4 font-semibold">Nível</th>
                    <th className="py-2 pr-4 font-semibold">Responsável</th>
                    <th className="py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {risks.map((risk, index) => (
                    <tr key={index}>
                      <td className="py-2 pr-4 text-slate-800">{risk.title}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge label={`${risk.level} · ${riskLevelLabels[risk.riskLevel]}`} tone={riskLevelTones[risk.riskLevel]} />
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{risk.owner ?? "—"}</td>
                      <td className="py-2 text-slate-600">{riskStatusLabels[risk.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* 3. Estado dos backups */}
          <section className="border-b border-slate-100 px-8 py-6">
            <h2 className="text-base font-bold text-slate-900">3. Estado dos backups (últimos 30 dias)</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {backups.total} backup(s) registado(s): {backups.sucesso} com sucesso, {backups.falha} com falha,{" "}
              {backups.aviso} com aviso e {backups.desconhecido} em estado desconhecido.{" "}
              {backups.semTesteRecente > 0 && `${backups.semTesteRecente} sem teste de restauração há mais de 30 dias.`}
            </p>
            {backups.semaforos.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {backups.semaforos.map((entry, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span aria-hidden="true" className={`inline-block size-3 rounded-full ${semaphoreDots[entry.semaforo]}`} />
                    <span className="text-slate-700">{entry.sistemaAtivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. Tickets e incidentes */}
          <section className="border-b border-slate-100 px-8 py-6">
            <h2 className="text-base font-bold text-slate-900">4. Tickets e incidentes no período</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Tickets</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {ticketsIncidentes.tickets.abertos} aberto(s), {ticketsIncidentes.tickets.vencidos} vencido(s) por SLA,{" "}
                  {ticketsIncidentes.tickets.resolvidosNoMes} resolvido(s) no mês.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {ticketsIncidentes.tickets.porPrioridade.map((entry) => (
                    <li key={entry.priority}>
                      {priorityLabels[entry.priority]}: {entry.count}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Incidentes</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {ticketsIncidentes.incidentes.totalNoMes} registado(s) no mês, {ticketsIncidentes.incidentes.criticos} crítico(s),{" "}
                  {ticketsIncidentes.incidentes.encerrados} encerrado(s).
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {ticketsIncidentes.incidentes.porTipo.map((entry) => (
                    <li key={entry.type}>
                      {incidentTypeLabels[entry.type]}: {entry.count}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 5. Formações e políticas */}
          <section className="border-b border-slate-100 px-8 py-6">
            <h2 className="text-base font-bold text-slate-900">5. Formações e políticas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {trainingPolicies.validPercent === null
                ? "Sem formações atribuídas nesta organização."
                : `${trainingPolicies.validPercent}% dos utilizadores (${trainingPolicies.validUsers}/${trainingPolicies.totalMembers}) têm formação válida.`}{" "}
              {trainingPolicies.keyPolicies > 0
                ? `${trainingPolicies.keyPolicies} política(s) publicada(s) nas categorias chave.`
                : "Nenhuma política publicada nas categorias chave (passwords, resposta a incidentes, uso aceitável)."}
            </p>
          </section>

          {/* 6. Ações recomendadas */}
          <section className="px-8 py-6">
            <h2 className="text-base font-bold text-slate-900">6. Ações recomendadas para os próximos 30 dias</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </section>

          <footer className="border-t border-slate-100 px-8 py-4">
            <p className="text-xs leading-5 text-slate-400">
              Documento gerado automaticamente pela plataforma CyberPME com dados de demonstração. Este relatório apoia
              a gestão de riscos e não substitui uma auditoria formal ou consultoria jurídica.
            </p>
          </footer>
        </article>
      </div>
    </AppShell>
  );
}
