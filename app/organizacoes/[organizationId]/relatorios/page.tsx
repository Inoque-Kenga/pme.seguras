import Link from "next/link";
import { ReportStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageReports, listReports } from "@/lib/services/report.service";
import { reportStatusLabels, reportStatusTones, scoreCategoryLabels, scoreCategoryTones } from "@/lib/labels";
import { generateReportAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(date);
}

export default async function ReportsPage({
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
          <PageHeader eyebrow="Organização" title="Relatórios mensais" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const mes = str(query.mes);
  const status = str(query.status);
  const manageable = canManageReports(ctx.role);

  const reports = await listReports(ctx.organization.id, {
    mes: /^\d{4}-\d{2}$/.test(mes) ? mes : undefined,
    status: (Object.values(ReportStatus) as string[]).includes(status) ? (status as ReportStatus) : undefined,
  });

  const basePath = `/organizacoes/${ctx.organization.id}/relatorios`;
  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Relatórios mensais de segurança"
          description="Resumo executivo mensal com score, riscos, backups, incidentes, formações e ações recomendadas — pronto para imprimir ou guardar como PDF."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-500">
              Mês
              <input name="mes" type="month" defaultValue={mes} className={`${inputClass} mt-1`} />
            </label>
            <select name="status" defaultValue={status} className={`${inputClass} w-40`}>
              <option value="">Todos os estados</option>
              {Object.values(ReportStatus).map((value) => (
                <option key={value} value={value}>{reportStatusLabels[value]}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {manageable && (
            <div className="flex gap-2">
              <form action={generateReportAction}>
                <input type="hidden" name="org" value={ctx.organization.id} />
                <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900">
                  Gerar relatório do mês atual
                </button>
              </form>
              <Link
                href={`${basePath}/novo`}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Outro mês…
              </Link>
            </div>
          )}
        </div>

        {reports.length === 0 ? (
          <EmptyState
            title="Nenhum relatório gerado"
            description="Gere o primeiro relatório mensal para partilhar o estado de segurança com a direção."
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Mês de referência</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Categoria</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Gerado por</th>
                  <th className="px-5 py-3 font-semibold">Data de geração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`${basePath}/${report.id}`} className="font-medium capitalize text-blue-800 hover:underline">
                        {monthLabel(report.mesReferencia)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900">{report.scoreGlobal}/100</td>
                    <td className="px-5 py-3">
                      <StatusBadge label={scoreCategoryLabels[report.categoria]} tone={scoreCategoryTones[report.categoria]} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={reportStatusLabels[report.status]} tone={reportStatusTones[report.status]} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{report.geradoPor?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(report.dataGeracao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  );
}
