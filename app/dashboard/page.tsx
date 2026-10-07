import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationSize } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { isGlobalAdmin, requireSession, resolveOrganization } from "@/lib/current-organization";
import { getGlobalAggregates, listOrganizationsWithScores } from "@/lib/services/security-score.service";
import { listOrganizationSectors } from "@/lib/services/organization.service";
import { organizationSizeLabels, scoreCategoryLabels, scoreCategoryTones } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function GlobalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));

  // ?org= → dashboard dessa organização.
  const requestedOrg = str(params.org);
  if (requestedOrg) {
    const ctx = await resolveOrganization(session, requestedOrg);
    if (ctx) redirect(`/organizacoes/${ctx.organization.id}/dashboard`);
  }

  const isAnalyst = roles.includes("ANALISTA_SEGURANCA") || isGlobalAdmin(session);

  // Papéis operacionais vão diretamente para o dashboard da sua organização.
  if (!isAnalyst) {
    const ctx = await resolveOrganization(session);
    if (!ctx) {
      return (
        <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
          <div className="mx-auto max-w-3xl">
            <PageHeader eyebrow="Área de trabalho" title="Dashboard" description="Sem organização associada." />
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              A sua conta não está associada a nenhuma organização ativa. Contacte o administrador.
            </p>
          </div>
        </AppShell>
      );
    }
    redirect(`/organizacoes/${ctx.organization.id}/dashboard`);
  }

  // Vista global: SUPER_ADMIN e ANALISTA_SEGURANCA.
  const sector = str(params.sector);
  const dimensao = str(params.dimensao);
  const categoria = str(params.categoria);

  const [organizations, aggregates, sectors] = await Promise.all([
    listOrganizationsWithScores({
      sector: sector || undefined,
      dimensao: dimensao || undefined,
      categoria: categoria || undefined,
    }),
    getGlobalAggregates(),
    listOrganizationSectors(),
  ]);

  const byCategory = (["CRITICO", "EM_RISCO", "ACEITAVEL", "BOM"] as const).map((category) => ({
    category,
    count: organizations.filter((organization) => organization.categoria === category).length,
  }));

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Visão global"
          title="Dashboard de segurança"
          description="Score atual de todas as organizações ativas da plataforma."
        />

        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {byCategory.map((entry) => (
            <div key={entry.category} className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs text-slate-500">
                <StatusBadge label={scoreCategoryLabels[entry.category]} tone={scoreCategoryTones[entry.category]} />
              </dt>
              <dd className="mt-2 text-2xl font-bold text-slate-900">{entry.count}</dd>
            </div>
          ))}
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <dt className="text-xs text-red-700">Riscos críticos abertos</dt>
            <dd className="mt-2 text-2xl font-bold text-red-800">{aggregates.criticalRisks}</dd>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <dt className="text-xs text-red-700">Incidentes críticos (30 dias)</dt>
            <dd className="mt-2 text-2xl font-bold text-red-800">{aggregates.criticalIncidents}</dd>
          </div>
        </dl>

        <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
          <select name="sector" defaultValue={sector} className={`${inputClass} w-44`}>
            <option value="">Todos os setores</option>
            {sectors.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select name="dimensao" defaultValue={dimensao} className={`${inputClass} w-40`}>
            <option value="">Dimensão</option>
            {Object.values(OrganizationSize).map((value) => (
              <option key={value} value={value}>{organizationSizeLabels[value]}</option>
            ))}
          </select>
          <select name="categoria" defaultValue={categoria} className={`${inputClass} w-40`}>
            <option value="">Score (faixa)</option>
            {(["CRITICO", "EM_RISCO", "ACEITAVEL", "BOM"] as const).map((value) => (
              <option key={value} value={value}>{scoreCategoryLabels[value]}</option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
            Filtrar
          </button>
        </form>

        {organizations.length === 0 ? (
          <EmptyState title="Nenhuma organização encontrada" description="Ajuste os filtros de pesquisa." />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Organização</th>
                  <th className="px-5 py-3 font-semibold">Setor</th>
                  <th className="px-5 py-3 font-semibold">Dimensão</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organizations.map((organization) => (
                  <tr key={organization.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/organizacoes/${organization.id}/dashboard`} className="font-medium text-blue-800 hover:underline">
                        {organization.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{organization.sector ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {organization.dimensao ? organizationSizeLabels[organization.dimensao] : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <span
                            className={`block h-full rounded-full ${
                              organization.score >= 80
                                ? "bg-emerald-500"
                                : organization.score >= 60
                                  ? "bg-blue-500"
                                  : organization.score >= 40
                                    ? "bg-amber-400"
                                    : "bg-red-500"
                            }`}
                            style={{ width: `${organization.score}%` }}
                          />
                        </span>
                        <span className="font-bold text-slate-900">{organization.score}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={scoreCategoryLabels[organization.categoria]}
                        tone={scoreCategoryTones[organization.categoria]}
                      />
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
