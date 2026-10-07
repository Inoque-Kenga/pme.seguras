import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { listMyTrainings } from "@/lib/services/training.service";
import { trainingCompletionStatusLabels, trainingCompletionStatusTones } from "@/lib/labels";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function MyTrainingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);

  if (!ctx) {
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow="Organização" title="Minhas formações" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const completions = await listMyTrainings(ctx.organization.id, session.user.id);
  const pending = completions.filter((completion) => completion.estado !== "CONCLUIDO");

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Minhas formações"
          description="Formações de sensibilização atribuídas a si. Conclua o questionário com pelo menos 70% para ficar válido."
        />

        {pending.length > 0 && (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Tem <strong>{pending.length}</strong> formação(ões) por concluir ou expirada(s).
          </p>
        )}

        {completions.length === 0 ? (
          <EmptyState
            title="Sem formações atribuídas"
            description="Quando a equipa de segurança lhe atribuir uma formação, ela aparece aqui."
          />
        ) : (
          <div className="space-y-4">
            {completions.map((completion) => {
              const trainingModule = completion.trainingAssignment.trainingModule;
              const actionable = completion.estado !== "CONCLUIDO" && completion.estado !== "EXPIRADO";
              return (
                <section key={completion.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-900">{trainingModule.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {trainingModule._count.questions} pergunta(s)
                        {trainingModule.duracaoMinutos ? ` · ~${trainingModule.duracaoMinutos} min` : ""}
                        {completion.trainingAssignment.dataLimite
                          ? ` · limite: ${formatDate(completion.trainingAssignment.dataLimite)}`
                          : ""}
                      </p>
                      {completion.score !== null && (
                        <p className="mt-1 text-xs text-slate-500">Última pontuação: {completion.score}%</p>
                      )}
                      {completion.estado === "CONCLUIDO" && (
                        <p className="mt-1 text-xs text-emerald-700">Válida até {formatDate(completion.validoAte)}</p>
                      )}
                      {completion.estado === "EXPIRADO" && (
                        <p className="mt-1 text-xs text-red-700">
                          A validade terminou. Contacte a equipa de segurança para renovar.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge
                        label={trainingCompletionStatusLabels[completion.estado]}
                        tone={trainingCompletionStatusTones[completion.estado]}
                      />
                      {actionable && (
                        <Link
                          href={`/organizacoes/${ctx.organization.id}/formacoes/${trainingModule.id}?completionId=${completion.id}`}
                          className="inline-flex h-9 items-center rounded-lg bg-blue-800 px-4 text-xs font-semibold text-white hover:bg-blue-900"
                        >
                          {completion.estado === "NAO_INICIADO" ? "Iniciar formação" : "Continuar formação"}
                        </Link>
                      )}
                    </div>
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
