import Link from "next/link";
import { RiskLevel, RiskStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import {
  buildMatrix,
  canEditRisks,
  listOpenRisks,
  listRisks,
  type DueDateFilter,
} from "@/lib/services/risk.service";
import { listAssetOptions } from "@/lib/services/asset.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import { riskLevelCellStyles } from "@/lib/risk-level";
import {
  riskLevelLabels,
  riskLevelTones,
  riskStatusLabels,
  riskStatusTones,
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

const KANBAN_STATUSES: RiskStatus[] = ["ABERTO", "EM_TRATAMENTO", "ACEITE", "MITIGADO", "FECHADO"];

export default async function RisksPage({
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
          <PageHeader eyebrow="Organização" title="Riscos" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const basePath = `/organizacoes/${ctx.organization.id}/riscos`;
  const editable = canEditRisks(ctx.role);
  const vista = str(query.vista) || "lista";

  const riskLevel = str(query.riskLevel);
  const status = str(query.status);
  const ownerId = str(query.ownerId);
  const assetId = str(query.assetId);
  const due = str(query.due);
  const search = str(query.search);
  const page = Number(str(query.page)) || 1;

  const [{ items, total, totalPages }, assets, members] = await Promise.all([
    listRisks(ctx.organization.id, {
      riskLevel: (Object.values(RiskLevel) as string[]).includes(riskLevel) ? (riskLevel as RiskLevel) : undefined,
      status: (Object.values(RiskStatus) as string[]).includes(status) ? (status as RiskStatus) : undefined,
      ownerId: ownerId || undefined,
      assetId: assetId || undefined,
      due: (["vencidos", "proximos7", "sem_prazo"] as const).includes(due as DueDateFilter)
        ? (due as DueDateFilter)
        : undefined,
      search: search || undefined,
      page,
    }),
    listAssetOptions(ctx.organization.id),
    listOrganizationMembers(ctx.organization.id),
  ]);

  // Dados para matriz e kanban (riscos não fechados, sem paginação).
  const openRisks = vista === "lista" ? [] : await listOpenRisks(ctx.organization.id);

  const filterParams: Record<string, string> = {};
  if (riskLevel) filterParams.riskLevel = riskLevel;
  if (status) filterParams.status = status;
  if (ownerId) filterParams.ownerId = ownerId;
  if (assetId) filterParams.assetId = assetId;
  if (due) filterParams.due = due;
  if (search) filterParams.search = search;

  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Riscos"
          description="Identifique e trate riscos. O nível = probabilidade (1-5) × impacto (1-5): 1-4 Baixo · 5-9 Médio · 10-16 Alto · 17-25 Crítico."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-2" aria-label="Vista">
            {(
              [
                ["lista", "Lista"],
                ["matriz", "Matriz 5×5"],
                ["kanban", "Kanban"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`${basePath}?vista=${value}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  vista === value ? "bg-blue-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {editable && (
            <Link
              href={`${basePath}/novo`}
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Novo risco
            </Link>
          )}
        </div>

        {vista === "lista" && (
          <>
            <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
              <input type="hidden" name="vista" value="lista" />
              <input name="search" placeholder="Pesquisar risco, ameaça..." defaultValue={search} className={`${inputClass} w-52`} />
              <select name="riskLevel" defaultValue={riskLevel} className={`${inputClass} w-36`}>
                <option value="">Nível</option>
                {Object.values(RiskLevel).map((value) => (
                  <option key={value} value={value}>{riskLevelLabels[value]}</option>
                ))}
              </select>
              <select name="status" defaultValue={status} className={`${inputClass} w-40`}>
                <option value="">Estado</option>
                {Object.values(RiskStatus).map((value) => (
                  <option key={value} value={value}>{riskStatusLabels[value]}</option>
                ))}
              </select>
              <select name="ownerId" defaultValue={ownerId} className={`${inputClass} w-44`}>
                <option value="">Responsável</option>
                {members.map((member) => (
                  <option key={member.user.id} value={member.user.id}>{member.user.name}</option>
                ))}
              </select>
              <select name="assetId" defaultValue={assetId} className={`${inputClass} w-44`}>
                <option value="">Ativo</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </select>
              <select name="due" defaultValue={due} className={`${inputClass} w-40`}>
                <option value="">Prazo</option>
                <option value="vencidos">Vencidos</option>
                <option value="proximos7">Próximos 7 dias</option>
                <option value="sem_prazo">Sem prazo</option>
              </select>
              <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
                Filtrar
              </button>
            </form>

            {items.length === 0 ? (
              <EmptyState
                title="Nenhum risco encontrado"
                description="Ajuste os filtros ou registe o primeiro risco desta organização."
                actionHref={editable ? `${basePath}/novo` : undefined}
                actionLabel={editable ? "Registar risco" : undefined}
              />
            ) : (
              <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Risco</th>
                      <th className="px-5 py-3 font-semibold">Nível</th>
                      <th className="px-5 py-3 font-semibold">Ativo</th>
                      <th className="px-5 py-3 font-semibold">Responsável</th>
                      <th className="px-5 py-3 font-semibold">Prazo</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                      <th className="px-5 py-3 text-right font-semibold">Tarefas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((risk) => {
                      const highlight = risk.riskLevel === "CRITICO" || risk.riskLevel === "ALTO";
                      return (
                        <tr key={risk.id} className={highlight ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50"}>
                          <td className="px-5 py-3">
                            <Link href={`${basePath}/${risk.id}`} className="font-medium text-blue-800 hover:underline">
                              {highlight && <span aria-label="Risco elevado" title="Risco elevado">⚠️ </span>}
                              {risk.title}
                            </Link>
                            <span className="block text-xs text-slate-500">
                              P{risk.probability} × I{risk.impact}
                              {risk.assessment ? ` · ${risk.assessment.title}` : ""}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge label={`${risk.level} · ${riskLevelLabels[risk.riskLevel]}`} tone={riskLevelTones[risk.riskLevel]} />
                          </td>
                          <td className="px-5 py-3 text-slate-600">{risk.asset?.name ?? "—"}</td>
                          <td className="px-5 py-3 text-slate-600">{risk.owner?.name ?? "—"}</td>
                          <td className="px-5 py-3 text-slate-600">{formatDate(risk.dueDate)}</td>
                          <td className="px-5 py-3">
                            <StatusBadge label={riskStatusLabels[risk.status]} tone={riskStatusTones[risk.status]} />
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">{risk._count.tasks}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
            <Pagination basePath={basePath} params={{ ...filterParams, vista: "lista" }} page={page} totalPages={totalPages} total={total} />
          </>
        )}

        {vista === "matriz" && <RiskMatrix risks={openRisks} basePath={basePath} />}

        {vista === "kanban" && (
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {KANBAN_STATUSES.map((columnStatus) => {
              const columnRisks = openRisks.filter((risk) => risk.status === columnStatus);
              return (
                <section key={columnStatus} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h2 className="mb-3 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {riskStatusLabels[columnStatus]}
                    <span className="rounded-full bg-white px-2 py-0.5 text-slate-500 ring-1 ring-slate-200">
                      {columnRisks.length}
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {columnRisks.length === 0 && <p className="px-1 text-xs text-slate-400">Sem riscos.</p>}
                    {columnRisks.map((risk) => (
                      <Link
                        key={risk.id}
                        href={`${basePath}/${risk.id}`}
                        className="block rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-blue-300"
                      >
                        <p className="font-medium text-slate-900">{risk.title}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <StatusBadge
                            label={`${risk.level} · ${riskLevelLabels[risk.riskLevel]}`}
                            tone={riskLevelTones[risk.riskLevel]}
                          />
                          <span className="text-xs text-slate-400">{risk.owner?.name?.split(" ")[0] ?? ""}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RiskMatrix({
  risks,
  basePath,
}: {
  risks: { id: string; title: string; probability: number; impact: number }[];
  basePath: string;
}) {
  const matrix = buildMatrix(risks);
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Matriz de risco (riscos não fechados)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Probabilidade: quão provável é ocorrer (1 raro → 5 quase certo). Impacto: gravidade das consequências (1
        insignificante → 5 catastrófico). Cada célula mostra quantos riscos estão nessa combinação.
      </p>
      <div className="mt-4 inline-block">
        <div className="mb-1 grid grid-cols-[110px_repeat(5,64px)] gap-1 text-center text-xs font-semibold text-slate-500">
          <span />
          {[1, 2, 3, 4, 5].map((impact) => (
            <span key={impact}>Impacto {impact}</span>
          ))}
        </div>
        {[5, 4, 3, 2, 1].map((probability) => (
          <div key={probability} className="mb-1 grid grid-cols-[110px_repeat(5,64px)] gap-1">
            <span className="flex items-center text-xs font-semibold text-slate-500">
              Probabilidade {probability}
            </span>
            {[1, 2, 3, 4, 5].map((impact) => {
              const count = matrix[probability - 1][impact - 1];
              const level = probability * impact;
              const band = level >= 17 ? "CRITICO" : level >= 10 ? "ALTO" : level >= 5 ? "MEDIO" : "BAIXO";
              return (
                <span
                  key={impact}
                  title={`${count} risco(s) · nível ${level}`}
                  className={`flex h-14 items-center justify-center rounded-lg text-sm font-bold ${riskLevelCellStyles[band]} ${
                    count === 0 ? "opacity-40" : ""
                  }`}
                >
                  {count > 0 ? count : "·"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {risks.length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          <Link href={`${basePath}?vista=lista`} className="font-semibold text-blue-700 hover:underline">
            Ver a lista completa →
          </Link>
        </p>
      )}
    </section>
  );
}
