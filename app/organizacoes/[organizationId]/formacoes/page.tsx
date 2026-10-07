import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageTrainings, getTrainingPanel, listTrainingModules } from "@/lib/services/training.service";
import { createModuleAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function TrainingsPage({
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
          <PageHeader eyebrow="Organização" title="Formações" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const manageable = canManageTrainings(ctx.role);
  const [modules, panel] = await Promise.all([
    listTrainingModules(ctx.organization.id),
    getTrainingPanel(ctx.organization.id),
  ]);

  const basePath = `/organizacoes/${ctx.organization.id}/formacoes`;
  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  if (!manageable) {
    // Colaboradores são encaminhados para "Minhas formações".
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow={ctx.organization.name} title="Formações" description="Formações de sensibilização atribuídas a si." />
          <p className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-950">
            As suas formações estão em{" "}
            <Link href={`/organizacoes/${ctx.organization.id}/minhas-formacoes`} className="font-semibold underline">
              Minhas formações
            </Link>
            .
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Formações e sensibilização"
          description="Pessoas formadas clicam menos em phishing. Atribua formações curtas com questionário e acompanhe a conclusão."
        />
        <FeedbackMessage error={error} success={success} />

        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">Membros com formação válida</dt>
            <dd className={`mt-1 text-2xl font-bold ${panel.validPercent >= 70 ? "text-emerald-700" : "text-amber-700"}`}>
              {panel.validPercent}%
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">Utilizadores válidos</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">
              {panel.validUsers}/{panel.totalMembers}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">Atribuições pendentes</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">{panel.pendingCount}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">Formações expiradas</dt>
            <dd className={`mt-1 text-2xl font-bold ${panel.expiredCount > 0 ? "text-red-700" : "text-slate-900"}`}>
              {panel.expiredCount}
            </dd>
          </div>
        </dl>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Criar módulo de formação</h2>
          <ModuleCreateForm orgId={ctx.organization.id} />
        </section>

        {modules.length === 0 ? (
          <EmptyState title="Nenhum módulo de formação" description="Crie o primeiro módulo acima e adicione perguntas." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((trainingModule) => (
              <Link
                key={trainingModule.id}
                href={`${basePath}/${trainingModule.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{trainingModule.title}</h2>
                  {!trainingModule.organizationId && <StatusBadge label="Global" tone="purple" />}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {trainingModule._count.questions}/5 perguntas · {trainingModule._count.assignments} atribuição(ões) · validade{" "}
                  {trainingModule.validadeMeses} meses
                  {trainingModule.duracaoMinutos ? ` · ~${trainingModule.duracaoMinutos} min` : ""}
                </p>
                {trainingModule.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{trainingModule.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ModuleCreateForm({ orgId }: { orgId: string }) {
  return (
    <form action={createModuleAction} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="org" value={orgId} />
      <label className="block text-sm font-medium text-slate-700">
        Título *
        <input required name="title" placeholder="Ex.: Noções de phishing" className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Duração estimada (min)
        <input name="duracaoMinutos" type="number" min={1} max={480} placeholder="Ex.: 15" className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Validade (meses) *
        <input required name="validadeMeses" type="number" min={1} max={60} defaultValue={12} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Descrição
        <input name="description" className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Conteúdo da formação *
        <textarea
          required
          name="content"
          rows={5}
          placeholder="Texto curto que os colaboradores leem antes do questionário."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900">
          Criar módulo
        </button>
      </div>
    </form>
  );
}
