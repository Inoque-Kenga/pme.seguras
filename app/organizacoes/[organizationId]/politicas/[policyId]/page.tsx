import { notFound } from "next/navigation";
import { PolicyStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditPolicies, getPolicy } from "@/lib/services/policy.service";
import { policyCategoryLabels, policyStatusLabels, policyStatusTones } from "@/lib/labels";
import { PolicyForm } from "../policy-form";
import { setPolicyStatusAction, updatePolicyAction } from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function PolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; policyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, policyId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const policy = await getPolicy(ctx.organization.id, policyId, ctx.role);
  if (!policy) notFound();

  const editable = canEditPolicies(ctx.role);
  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow={ctx.organization.name} title={policy.title} description={policyCategoryLabels[policy.category]} />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={policyStatusLabels[policy.status]} tone={policyStatusTones[policy.status]} />
              <StatusBadge label={`Versão ${policy.version}`} tone="blue" />
            </div>
            {editable && (
              <form action={setPolicyStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={policy.id} />
                <select name="status" defaultValue={policy.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                  {Object.values(PolicyStatus).map((value) => (
                    <option key={value} value={value}>{policyStatusLabels[value]}</option>
                  ))}
                </select>
                <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Atualizar estado
                </button>
              </form>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Autor: {policy.author?.name ?? "—"} · Publicada em {formatDate(policy.publishedAt)}
          </p>
          <article className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-800">
            {policy.content}
          </article>
        </section>

        {editable && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar política</h2>
            <PolicyForm
              action={updatePolicyAction}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: policy.id }}
              values={{
                title: policy.title,
                content: policy.content,
                category: policy.category,
                status: policy.status,
              }}
            />
          </section>
        )}

        {policy.versions.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Histórico de versões</h2>
            <ul className="space-y-3">
              {policy.versions.map((version) => (
                <li key={version.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Versão {version.version} — {version.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {version.author?.name ?? "—"} · {formatDate(version.createdAt)}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-900">
                      Ver conteúdo desta versão
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{version.content}</p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
