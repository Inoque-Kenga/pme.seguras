import Link from "next/link";
import { AssetStatus, AssetType, Criticality } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditAssets, getAssetIndicators, listAssets, type AssetListParams } from "@/lib/services/asset.service";
import {
  assetStatusLabels,
  assetStatusTones,
  assetTypeLabels,
  criticalityLabels,
  criticalityTones,
} from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function OrgAssetsPage({
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
          <PageHeader eyebrow="Organização" title="Inventário de ativos" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const search = str(query.search);
  const type = str(query.type);
  const criticality = str(query.criticality);
  const status = str(query.status);
  const protecao = str(query.protecaoEndpoint);
  const cifragem = str(query.cifragem);
  const page = Number(str(query.page)) || 1;

  const listParams: AssetListParams = {
    search: search || undefined,
    type: (Object.values(AssetType) as string[]).includes(type) ? (type as AssetType) : undefined,
    criticality: (Object.values(Criticality) as string[]).includes(criticality)
      ? (criticality as Criticality)
      : undefined,
    status: (Object.values(AssetStatus) as string[]).includes(status) ? (status as AssetStatus) : undefined,
    protecaoEndpoint: protecao === "" ? undefined : protecao === "true",
    cifragem: cifragem === "" ? undefined : cifragem === "true",
    page,
  };

  const [{ items, total, totalPages }, indicators] = await Promise.all([
    listAssets(ctx.organization.id, listParams),
    getAssetIndicators(ctx.organization.id),
  ]);

  const editable = canEditAssets(ctx.role);
  const basePath = `/organizacoes/${ctx.organization.id}/ativos`;

  const filterParams: Record<string, string> = {};
  if (search) filterParams.search = search;
  if (type) filterParams.type = type;
  if (criticality) filterParams.criticality = criticality;
  if (status) filterParams.status = status;
  if (protecao) filterParams.protecaoEndpoint = protecao;
  if (cifragem) filterParams.cifragem = cifragem;

  const exportQuery = new URLSearchParams(filterParams).toString();

  const cards = [
    { label: "Total de ativos", value: indicators.total, tone: "text-slate-900" },
    { label: "Ativos críticos", value: indicators.critical, tone: "text-red-700" },
    { label: "Sem proteção de endpoint", value: indicators.withoutEndpoint, tone: "text-amber-700" },
    { label: `Sem atualização há +${indicators.staleDays} dias`, value: indicators.stale, tone: "text-amber-700" },
    { label: "Sem cifragem", value: indicators.withoutEncryption, tone: "text-red-700" },
  ];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Inventário de ativos"
          description="Equipamentos, software, dados e serviços da organização, com o respetivo estado de proteção."
        />

        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs leading-4 text-slate-500">{card.label}</dt>
              <dd className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input name="search" placeholder="Pesquisar nome, modelo, série..." defaultValue={search} className={`${inputClass} w-60`} />
            <select name="type" defaultValue={type} className={`${inputClass} w-36`}>
              <option value="">Todos os tipos</option>
              {Object.values(AssetType).map((value) => (
                <option key={value} value={value}>{assetTypeLabels[value]}</option>
              ))}
            </select>
            <select name="criticality" defaultValue={criticality} className={`${inputClass} w-36`}>
              <option value="">Criticidade</option>
              {Object.values(Criticality).map((value) => (
                <option key={value} value={value}>{criticalityLabels[value]}</option>
              ))}
            </select>
            <select name="status" defaultValue={status} className={`${inputClass} w-40`}>
              <option value="">Todos os estados</option>
              {Object.values(AssetStatus).map((value) => (
                <option key={value} value={value}>{assetStatusLabels[value]}</option>
              ))}
            </select>
            <select name="protecaoEndpoint" defaultValue={protecao} className={`${inputClass} w-44`}>
              <option value="">Proteção endpoint</option>
              <option value="true">Com proteção</option>
              <option value="false">Sem proteção</option>
            </select>
            <select name="cifragem" defaultValue={cifragem} className={`${inputClass} w-36`}>
              <option value="">Cifragem</option>
              <option value="true">Cifrado</option>
              <option value="false">Não cifrado</option>
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          <div className="flex gap-3">
            <Link
              href={`${basePath}/exportar${exportQuery ? `?${exportQuery}` : ""}`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Exportar CSV
            </Link>
            {editable && (
              <Link
                href={`${basePath}/novo`}
                className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
              >
                + Novo ativo
              </Link>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhum ativo encontrado"
            description="Ajuste os filtros de pesquisa ou registe o primeiro ativo desta organização."
            actionHref={editable ? `${basePath}/novo` : undefined}
            actionLabel={editable ? "Registar ativo" : undefined}
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nome</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Criticidade</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Proteção</th>
                  <th className="px-5 py-3 font-semibold">Cifrado</th>
                  <th className="px-5 py-3 font-semibold">Últ. atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`${basePath}/${asset.id}`} className="font-medium text-blue-800 hover:underline">
                        {asset.name}
                      </Link>
                      <span className="block text-xs text-slate-500">{asset.marcaModelo ?? asset.owner ?? ""}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{assetTypeLabels[asset.type]}</td>
                    <td className="px-5 py-3">
                      <StatusBadge label={criticalityLabels[asset.criticality]} tone={criticalityTones[asset.criticality]} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={assetStatusLabels[asset.status]} tone={assetStatusTones[asset.status]} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={asset.protecaoEndpoint ? "Sim" : "Não"} tone={asset.protecaoEndpoint ? "green" : "red"} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={asset.cifragem ? "Sim" : "Não"} tone={asset.cifragem ? "green" : "amber"} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(asset.ultimaAtualizacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <Pagination basePath={basePath} params={filterParams} page={page} totalPages={totalPages} total={total} />
      </div>
    </AppShell>
  );
}
