import Link from "next/link";
import { BackupFrequency, BackupJobStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import {
  backupSemaphore,
  canEditBackups,
  getBackupIndicators,
  listBackups,
} from "@/lib/services/backup.service";
import { backupFrequencyLabels, backupJobStatusLabels, backupJobStatusTones } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

const semaphoreStyles = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-400",
  vermelho: "bg-red-500",
} as const;

const semaphoreLabels = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Problema",
} as const;

export default async function BackupsPage({
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
          <PageHeader eyebrow="Organização" title="Backups e recuperação" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const estado = str(query.estado);
  const fornecedor = str(query.fornecedor);
  const frequencia = str(query.frequencia);
  const page = Number(str(query.page)) || 1;

  const [{ items, total, totalPages }, indicators] = await Promise.all([
    listBackups(ctx.organization.id, {
      estado: (Object.values(BackupJobStatus) as string[]).includes(estado) ? (estado as BackupJobStatus) : undefined,
      fornecedor: fornecedor || undefined,
      frequencia: (Object.values(BackupFrequency) as string[]).includes(frequencia)
        ? (frequencia as BackupFrequency)
        : undefined,
      page,
    }),
    getBackupIndicators(ctx.organization.id),
  ]);

  const basePath = `/organizacoes/${ctx.organization.id}/backups`;
  const editable = canEditBackups(ctx.role);
  const filterParams: Record<string, string> = {};
  if (estado) filterParams.estado = estado;
  if (fornecedor) filterParams.fornecedor = fornecedor;
  if (frequencia) filterParams.frequencia = frequencia;

  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  const cards = [
    { label: "Falhas nos últimos 7 dias", value: indicators.recentFailures, alert: indicators.recentFailures > 0 },
    { label: "Sem teste de restauração há +30 dias", value: indicators.untested, alert: indicators.untested > 0 },
    { label: "Estado desconhecido", value: indicators.unknown, alert: indicators.unknown > 0 },
  ];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Backups e recuperação"
          description="Controle as cópias de segurança, os tempos de recuperação (RTO/RPO) e os testes de restauração."
        />
        <FeedbackMessage error={error} success={success} />

        <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs leading-4 text-slate-500">{card.label}</dt>
              <dd className={`mt-1 text-2xl font-bold ${card.alert ? "text-red-700" : "text-slate-900"}`}>{card.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="estado" defaultValue={estado} className={`${inputClass} w-44`}>
              <option value="">Todos os estados</option>
              {Object.values(BackupJobStatus).map((value) => (
                <option key={value} value={value}>{backupJobStatusLabels[value]}</option>
              ))}
            </select>
            <input name="fornecedor" placeholder="Fornecedor" defaultValue={fornecedor} className={`${inputClass} w-44`} />
            <select name="frequencia" defaultValue={frequencia} className={`${inputClass} w-40`}>
              <option value="">Frequência</option>
              {Object.values(BackupFrequency).map((value) => (
                <option key={value} value={value}>{backupFrequencyLabels[value]}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {editable && (
            <Link
              href={`${basePath}/novo`}
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Novo backup
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhum backup registado"
            description="Registe os sistemas com cópia de segurança para acompanhar a sua saúde e testes de restauração."
            actionHref={editable ? `${basePath}/novo` : undefined}
            actionLabel={editable ? "Registar backup" : undefined}
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Semáforo</th>
                  <th className="px-5 py-3 font-semibold">Sistema</th>
                  <th className="px-5 py-3 font-semibold">Fornecedor</th>
                  <th className="px-5 py-3 font-semibold">Frequência</th>
                  <th className="px-5 py-3 font-semibold">Última execução</th>
                  <th className="px-5 py-3 font-semibold">Último teste</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((backup) => {
                  const semaphore = backupSemaphore(backup);
                  return (
                    <tr key={backup.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                          <span aria-hidden="true" className={`inline-block size-3 rounded-full ${semaphoreStyles[semaphore]}`} />
                          {semaphoreLabels[semaphore]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`${basePath}/${backup.id}`} className="font-medium text-blue-800 hover:underline">
                          {backup.sistemaAtivo}
                        </Link>
                        <span className="block text-xs text-slate-500">{backup.localizacao ?? ""}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{backup.fornecedor ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{backupFrequencyLabels[backup.frequencia]}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(backup.ultimaExecucao)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(backup.ultimoTesteRestauracao)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge label={backupJobStatusLabels[backup.estado]} tone={backupJobStatusTones[backup.estado]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
        <Pagination basePath={basePath} params={filterParams} page={page} totalPages={totalPages} total={total} />
      </div>
    </AppShell>
  );
}
