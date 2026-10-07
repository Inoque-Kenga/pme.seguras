import Link from "next/link";
import { OrganizationStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, isGlobalAdmin } from "@/lib/current-organization";
import { listOrganizations, listOrganizationSectors } from "@/lib/services/organization.service";
import { organizationSizeLabels, organizationStatusLabels, organizationStatusTones } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const superAdmin = isGlobalAdmin(session);

  if (!superAdmin && !roles.includes("ANALISTA_SEGURANCA")) {
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow="Administração" title="Organizações" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            O seu papel não tem acesso à gestão de organizações.
          </p>
        </div>
      </AppShell>
    );
  }

  const search = str(params.search);
  const status = str(params.status);
  const sector = str(params.sector);
  const page = Number(str(params.page)) || 1;

  const [{ items, total, totalPages }, sectors] = await Promise.all([
    listOrganizations({
      search: search || undefined,
      status: (Object.values(OrganizationStatus) as string[]).includes(status)
        ? (status as OrganizationStatus)
        : undefined,
      sector: sector || undefined,
      page,
    }),
    listOrganizationSectors(),
  ]);

  const filterParams: Record<string, string> = {};
  if (search) filterParams.search = search;
  if (status) filterParams.status = status;
  if (sector) filterParams.sector = sector;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Administração"
          title="Organizações"
          description="Empresas clientes geridas pela plataforma. Arquivar não apaga dados — apenas suspende o acesso."
        />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input name="search" placeholder="Pesquisar por nome, slug ou NIF" defaultValue={search} className={`${inputClass} w-64`} />
            <select name="status" defaultValue={status} className={`${inputClass} w-40`}>
              <option value="">Todos os estados</option>
              {Object.values(OrganizationStatus).map((value) => (
                <option key={value} value={value}>{organizationStatusLabels[value]}</option>
              ))}
            </select>
            <select name="sector" defaultValue={sector} className={`${inputClass} w-44`}>
              <option value="">Todos os setores</option>
              {sectors.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {superAdmin && (
            <Link
              href="/admin/organizacoes/nova"
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Nova organização
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma organização encontrada"
            description="Ajuste os filtros de pesquisa ou crie uma nova organização cliente."
            actionHref={superAdmin ? "/admin/organizacoes/nova" : undefined}
            actionLabel={superAdmin ? "Criar organização" : undefined}
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Organização</th>
                  <th className="px-5 py-3 font-semibold">NIF</th>
                  <th className="px-5 py-3 font-semibold">Setor</th>
                  <th className="px-5 py-3 font-semibold">Dimensão</th>
                  <th className="px-5 py-3 font-semibold">Plano</th>
                  <th className="px-5 py-3 text-right font-semibold">Membros</th>
                  <th className="px-5 py-3 text-right font-semibold">Ativos</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((organization) => (
                  <tr key={organization.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/organizacoes/${organization.id}`} className="font-medium text-blue-800 hover:underline">
                        {organization.name}
                      </Link>
                      <span className="block text-xs text-slate-500">{organization.city ?? organization.slug}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{organization.nif ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{organization.sector ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {organization.dimensao ? organizationSizeLabels[organization.dimensao] : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{organization.plano?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{organization._count.memberships}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{organization._count.assets}</td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={organizationStatusLabels[organization.status]}
                        tone={organizationStatusTones[organization.status]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <Pagination basePath="/admin/organizacoes" params={filterParams} page={page} totalPages={totalPages} total={total} />
      </div>
    </AppShell>
  );
}
