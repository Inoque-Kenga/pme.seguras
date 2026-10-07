import Link from "next/link";
import { PhishingClassification, PhishingReportStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canTriageReports, listPhishingReports } from "@/lib/services/phishing-report.service";
import {
  phishingChannelLabels,
  phishingClassificationLabels,
  phishingClassificationTones,
  phishingReportStatusLabels,
  phishingReportStatusTones,
} from "@/lib/labels";
import {
  convertToIncidentAction,
  convertToTicketAction,
  markFalsePositiveAction,
  markInAnalysisAction,
} from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function PhishingReportsPage({
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
          <PageHeader eyebrow="Organização" title="Reporte de phishing" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const estado = str(query.estado);
  const classificacao = str(query.classificacao);
  const page = Number(str(query.page)) || 1;

  const { items, total, totalPages } = await listPhishingReports(ctx.organization.id, {
    estado: (Object.values(PhishingReportStatus) as string[]).includes(estado)
      ? (estado as PhishingReportStatus)
      : undefined,
    classificacao: (Object.values(PhishingClassification) as string[]).includes(classificacao)
      ? (classificacao as PhishingClassification)
      : undefined,
    page,
  });

  const basePath = `/organizacoes/${ctx.organization.id}/phishing`;
  const triage = canTriageReports(ctx.role);
  const filterParams: Record<string, string> = {};
  if (estado) filterParams.estado = estado;
  if (classificacao) filterParams.classificacao = classificacao;

  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Reporte de phishing"
          description="Mensagens suspeitas reportadas pelos colaboradores e a respetiva triagem pela equipa de segurança."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="estado" defaultValue={estado} className={`${inputClass} w-52`}>
              <option value="">Todos os estados</option>
              {Object.values(PhishingReportStatus).map((value) => (
                <option key={value} value={value}>{phishingReportStatusLabels[value]}</option>
              ))}
            </select>
            <select name="classificacao" defaultValue={classificacao} className={`${inputClass} w-40`}>
              <option value="">Classificação</option>
              {Object.values(PhishingClassification).map((value) => (
                <option key={value} value={value}>{phishingClassificationLabels[value]}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          <Link
            href={`${basePath}/novo`}
            className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
          >
            + Reportar mensagem suspeita
          </Link>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma mensagem reportada"
            description="Quando um colaborador receber uma mensagem suspeita, pode reportá-la aqui em segundos."
            actionHref={`${basePath}/novo`}
            actionLabel="Reportar mensagem"
          />
        ) : (
          <div className="space-y-4">
            {items.map((report) => {
              const triageable = triage && (report.estado === "NOVO" || report.estado === "EM_ANALISE");
              return (
                <section key={report.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {report.assunto ?? "(sem assunto)"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {phishingChannelLabels[report.canal]} · de {report.remetente} · reportado por{" "}
                        {report.reportante?.name ?? "—"} em {formatDate(report.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        label={phishingClassificationLabels[report.classificacaoInicial]}
                        tone={phishingClassificationTones[report.classificacaoInicial]}
                      />
                      <StatusBadge label={phishingReportStatusLabels[report.estado]} tone={phishingReportStatusTones[report.estado]} />
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{report.descricao}</p>
                  {report.urlSuspeita && (
                    <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                      {report.urlSuspeita}
                    </p>
                  )}
                  {triageable && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {report.estado === "NOVO" && (
                        <form action={markInAnalysisAction}>
                          <input type="hidden" name="org" value={ctx.organization.id} />
                          <input type="hidden" name="id" value={report.id} />
                          <button type="submit" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                            Em análise
                          </button>
                        </form>
                      )}
                      <form action={convertToTicketAction}>
                        <input type="hidden" name="org" value={ctx.organization.id} />
                        <input type="hidden" name="id" value={report.id} />
                        <button type="submit" className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200">
                          Converter em ticket
                        </button>
                      </form>
                      <form action={convertToIncidentAction}>
                        <input type="hidden" name="org" value={ctx.organization.id} />
                        <input type="hidden" name="id" value={report.id} />
                        <button type="submit" className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200">
                          Converter em incidente
                        </button>
                      </form>
                      <form action={markFalsePositiveAction}>
                        <input type="hidden" name="org" value={ctx.organization.id} />
                        <input type="hidden" name="id" value={report.id} />
                        <button type="submit" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200">
                          Falso positivo
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
        <Pagination basePath={basePath} params={filterParams} page={page} totalPages={totalPages} total={total} />
      </div>
    </AppShell>
  );
}
