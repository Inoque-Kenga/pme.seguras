import Link from "next/link";
import { PolicyCategory, PolicyStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditPolicies, listPolicies } from "@/lib/services/policy.service";
import { policyCategoryLabels, policyStatusLabels, policyStatusTones } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function PoliciesPage({
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
          <PageHeader eyebrow="Organização" title="Políticas de segurança" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const category = str(query.category);
  const status = str(query.status);
  const editable = canEditPolicies(ctx.role);

  const policies = await listPolicies(ctx.organization.id, ctx.role, {
    category: (Object.values(PolicyCategory) as string[]).includes(category) ? (category as PolicyCategory) : undefined,
    status: (Object.values(PolicyStatus) as string[]).includes(status) ? (status as PolicyStatus) : undefined,
  });

  const basePath = `/organizacoes/${ctx.organization.id}/politicas`;
  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Políticas de segurança"
          description="Regras claras escritas para toda a equipa: como usar passwords, dispositivos, e-mail e como reagir a incidentes."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="category" defaultValue={category} className={`${inputClass} w-52`}>
              <option value="">Todas as categorias</option>
              {Object.values(PolicyCategory).map((value) => (
                <option key={value} value={value}>{policyCategoryLabels[value]}</option>
              ))}
            </select>
            {editable && (
              <select name="status" defaultValue={status} className={`${inputClass} w-40`}>
                <option value="">Todos os estados</option>
                {Object.values(PolicyStatus).map((value) => (
                  <option key={value} value={value}>{policyStatusLabels[value]}</option>
                ))}
              </select>
            )}
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {editable && (
            <Link
              href={`${basePath}/nova`}
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Nova política
            </Link>
          )}
        </div>

        {policies.length === 0 ? (
          <EmptyState
            title="Nenhuma política encontrada"
            description={
              editable
                ? "Crie a primeira política de segurança da organização — por exemplo, regras de palavras-passe."
                : "Ainda não há políticas publicadas. Quando forem publicadas, aparecem aqui."
            }
            actionHref={editable ? `${basePath}/nova` : undefined}
            actionLabel={editable ? "Criar política" : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => (
              <Link
                key={policy.id}
                href={`${basePath}/${policy.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{policy.title}</h2>
                  <StatusBadge label={policyStatusLabels[policy.status]} tone={policyStatusTones[policy.status]} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {policyCategoryLabels[policy.category]} · versão {policy.version}
                  {policy.publishedAt &&
                    ` · publicada em ${new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(policy.publishedAt)}`}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{policy.content}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
