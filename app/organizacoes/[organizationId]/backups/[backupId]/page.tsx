import { notFound } from "next/navigation";
import { VerificationResult } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { backupSemaphore, canEditBackups, getBackup } from "@/lib/services/backup.service";
import { backupFrequencyLabels, backupJobStatusLabels, backupJobStatusTones } from "@/lib/labels";
import { BackupForm } from "../backup-form";
import { addVerificationAction, updateBackupAction } from "../actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function BackupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; backupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, backupId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const backup = await getBackup(ctx.organization.id, backupId);
  if (!backup) notFound();

  const editable = canEditBackups(ctx.role);
  const semaphore = backupSemaphore(backup);
  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  const info: [string, React.ReactNode][] = [
    ["Fornecedor", backup.fornecedor ?? "—"],
    ["Frequência", backupFrequencyLabels[backup.frequencia]],
    ["Localização", backup.localizacao ?? "—"],
    ["Tamanho", backup.tamanhoGB !== null ? `${backup.tamanhoGB} GB` : "—"],
    ["Retenção", backup.retencaoDias !== null ? `${backup.retencaoDias} dias` : "—"],
    ["RTO / RPO", `${backup.rtoHoras ?? "—"} h / ${backup.rpoHoras ?? "—"} h`],
    ["Última execução", formatDate(backup.ultimaExecucao)],
    ["Último teste de restauração", formatDate(backup.ultimoTesteRestauracao)],
  ];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow={ctx.organization.name} title={backup.sistemaAtivo} description="Detalhe do backup e histórico de testes de restauração." />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={backupJobStatusLabels[backup.estado]} tone={backupJobStatusTones[backup.estado]} />
            <StatusBadge
              label={semaphore === "verde" ? "Saudável" : semaphore === "amarelo" ? "Atenção" : "Problema"}
              tone={semaphore === "verde" ? "green" : semaphore === "amarelo" ? "amber" : "red"}
            />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
            {info.map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {backup.notas && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{backup.notas}</p>}
        </section>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Testes de restauração ({backup.verifications.length})</h2>
          {backup.verifications.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum teste de restauração registado. Um backup nunca testado pode falhar quando for preciso.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {backup.verifications.map((verification) => (
                <li key={verification.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                  <span className="text-slate-700">
                    {formatDate(verification.dataTeste)}
                    {verification.detalhes ? ` — ${verification.detalhes}` : ""}
                  </span>
                  <StatusBadge
                    label={verification.resultado === "SUCESSO" ? "Sucesso" : "Falha"}
                    tone={verification.resultado === "SUCESSO" ? "green" : "red"}
                  />
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addVerificationAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input type="hidden" name="id" value={backup.id} />
              <label className="text-xs font-medium text-slate-500">
                Data
                <input required name="dataTeste" type="date" className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Resultado
                <select name="resultado" defaultValue="SUCESSO" className={`${inputClass} mt-1 w-36`}>
                  {Object.values(VerificationResult).map((value) => (
                    <option key={value} value={value}>{value === "SUCESSO" ? "Sucesso" : "Falha"}</option>
                  ))}
                </select>
              </label>
              <input name="detalhes" placeholder="Detalhes do teste" className={`${inputClass} min-w-52 flex-1`} />
              <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
                Registar teste
              </button>
            </form>
          )}
        </section>

        {editable && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar backup</h2>
            <BackupForm
              action={updateBackupAction}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: backup.id }}
              values={{
                sistemaAtivo: backup.sistemaAtivo,
                fornecedor: backup.fornecedor,
                frequencia: backup.frequencia,
                ultimaExecucao: backup.ultimaExecucao,
                estado: backup.estado,
                tamanhoGB: backup.tamanhoGB,
                localizacao: backup.localizacao,
                retencaoDias: backup.retencaoDias,
                rtoHoras: backup.rtoHoras,
                rpoHoras: backup.rpoHoras,
                ultimoTesteRestauracao: backup.ultimoTesteRestauracao,
                notas: backup.notas,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
