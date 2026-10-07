import Link from "next/link";
import { AssessmentStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageAssessments, listAssessments } from "@/lib/services/risk-assessment.service";
import { assessmentStatusLabels, assessmentStatusTones } from "@/lib/labels";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function AssessmentsPage({
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
          <PageHeader eyebrow="Organização" title="Avaliações de risco" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const statusFilter = typeof query.status === "string" ? query.status : "";
  const assessments = await listAssessments(
    ctx.organization.id,
    (Object.values(AssessmentStatus) as string[]).includes(statusFilter)
      ? (statusFilter as AssessmentStatus)
      : undefined,
  );
  const manageable = canManageAssessments(ctx.role);
  const basePath = `/organizacoes/${ctx.organization.id}/avaliacoes`;
  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Avaliações de risco"
          description="Cada avaliação agrupa um conjunto de riscos identificados num período e domínio (ex.: avaliação anual, auditoria a um sistema)."
        />
        <FeedbackMessage error={error} success={success} />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <select name="status" defaultValue={statusFilter} className={`${inputClass} w-48`}>
              <option value="">Todos os estados</option>
              {Object.values(AssessmentStatus).map((status) => (
                <option key={status} value={status}>{assessmentStatusLabels[status]}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
              Filtrar
            </button>
          </form>
          {manageable && (
            <Link
              href={`${basePath}/nova`}
              className="inline-flex h-10 items-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
            >
              + Nova avaliação
            </Link>
          )}
        </div>

        {assessments.length === 0 ? (
          <EmptyState
            title="Nenhuma avaliação encontrada"
            description="Crie a primeira avaliação de risco para organizar e acompanhar os riscos desta organização."
            actionHref={manageable ? `${basePath}/nova` : undefined}
            actionLabel={manageable ? "Criar avaliação" : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`${basePath}/${assessment.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{assessment.title}</h2>
                  <StatusBadge
                    label={assessmentStatusLabels[assessment.status]}
                    tone={assessmentStatusTones[assessment.status]}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {assessment.domain ? `${assessment.domain} · ` : ""}
                  início em {formatDate(assessment.startDate)}
                  {assessment.endDate ? ` · fim em ${formatDate(assessment.endDate)}` : ""}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {assessment._count.risks} risco(s) · responsável: {assessment.owner?.name ?? "—"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
