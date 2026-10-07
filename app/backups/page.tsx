import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { OrgSwitcher } from "@/components/org-switcher";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { loadModulePage } from "@/lib/module-page";
import { canEdit } from "@/lib/services/common";
import { listBackups } from "@/lib/services/backups.service";
import { backupStatusLabels, backupStatusTones } from "@/lib/labels";
import { createBackupAction, registerBackupRunAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function BackupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, ctx, organizations, roles, error, success } = await loadModulePage(searchParams);
  const backups = ctx ? await listBackups(ctx.organization.id) : [];
  const editable = ctx ? canEdit(ctx.role) : false;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Continuidade"
          title="Cópias de segurança"
          description="Registe os recursos com backup e acompanhe o estado das últimas execuções."
        />
        <OrgSwitcher organizations={organizations} currentId={ctx?.organization.id ?? ""} basePath="/backups" />
        <FeedbackMessage error={error} success={success} />

        {ctx && editable && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Registar recurso protegido</h2>
            <form action={createBackupAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input required name="resource" placeholder="Recurso (ex.: Servidor de ficheiros) *" className={inputClass} />
              <input required name="frequency" placeholder="Frequência (ex.: diário) *" className={inputClass} />
              <input name="notes" placeholder="Notas" className={inputClass} />
              <button
                type="submit"
                className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
              >
                Registar
              </button>
            </form>
          </section>
        )}

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Recurso</th>
                <th className="px-5 py-3 font-semibold">Frequência</th>
                <th className="px-5 py-3 font-semibold">Última execução</th>
                <th className="px-5 py-3 font-semibold">Próxima execução</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                {editable && <th className="px-5 py-3 font-semibold">Registar execução</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 && (
                <tr>
                  <td colSpan={editable ? 6 : 5} className="px-5 py-8 text-center text-slate-500">
                    Ainda não existem recursos de backup registados.
                  </td>
                </tr>
              )}
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{backup.resource}</td>
                  <td className="px-5 py-3 text-slate-600">{backup.frequency}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDateTime(backup.lastRunAt)}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDateTime(backup.nextRunAt)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge label={backupStatusLabels[backup.status]} tone={backupStatusTones[backup.status]} />
                  </td>
                  {editable && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {(["SUCCESS", "FAILED"] as const).map((status) => (
                          <form key={status} action={registerBackupRunAction}>
                            <input type="hidden" name="org" value={ctx?.organization.id} />
                            <input type="hidden" name="id" value={backup.id} />
                            <input type="hidden" name="status" value={status} />
                            <button
                              type="submit"
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                                status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                              }`}
                            >
                              {status === "SUCCESS" ? "Sucesso" : "Falha"}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
