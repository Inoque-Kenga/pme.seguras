import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageAssessments, getAssessment } from "@/lib/services/risk-assessment.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  assessmentStatusLabels,
  assessmentStatusTones,
  riskLevelLabels,
  riskLevelTones,
  riskStatusLabels,
  riskStatusTones,
} from "@/lib/labels";
import { AssessmentForm } from "../assessment-form";
import { setAssessmentStatusAction, updateAssessmentAction } from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; assessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, assessmentId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const assessment = await getAssessment(ctx.organization.id, assessmentId);
  if (!assessment) notFound();

  const manageable = canManageAssessments(ctx.role);
  const members = manageable ? await listOrganizationMembers(ctx.organization.id) : [];
  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title={assessment.title}
          description={assessment.domain ? `Domínio: ${assessment.domain}` : "Avaliação de risco."}
        />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Estado</dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={assessmentStatusLabels[assessment.status]}
                    tone={assessmentStatusTones[assessment.status]}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Responsável</dt>
                <dd className="mt-1 font-medium text-slate-900">{assessment.owner?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Início</dt>
                <dd className="mt-1 font-medium text-slate-900">{formatDate(assessment.startDate)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Fim</dt>
                <dd className="mt-1 font-medium text-slate-900">{formatDate(assessment.endDate)}</dd>
              </div>
            </dl>
            {manageable && (
              <form action={setAssessmentStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={assessment.id} />
                <select name="status" defaultValue={assessment.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                  {Object.values(AssessmentStatus).map((status) => (
                    <option key={status} value={status}>{assessmentStatusLabels[status]}</option>
                  ))}
                </select>
                <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Atualizar estado
                </button>
              </form>
            )}
          </div>
          {assessment.description && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{assessment.description}</p>
          )}
        </section>

        <section className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Riscos desta avaliação ({assessment.risks.length})</h2>
            <Link
              href={`/organizacoes/${ctx.organization.id}/riscos/novo?assessmentId=${assessment.id}`}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900"
            >
              + Associar risco
            </Link>
          </div>
          {assessment.risks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Ainda não existem riscos associados a esta avaliação.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Risco</th>
                  <th className="px-5 py-3 font-semibold">Nível</th>
                  <th className="px-5 py-3 font-semibold">Ativo</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assessment.risks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/organizacoes/${ctx.organization.id}/riscos/${risk.id}`}
                        className="font-medium text-blue-800 hover:underline"
                      >
                        {risk.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={`${risk.level} · ${riskLevelLabels[risk.riskLevel]}`} tone={riskLevelTones[risk.riskLevel]} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{risk.asset?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge label={riskStatusLabels[risk.status]} tone={riskStatusTones[risk.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {manageable && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar avaliação</h2>
            <AssessmentForm
              action={updateAssessmentAction}
              members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: assessment.id }}
              values={{
                title: assessment.title,
                description: assessment.description,
                domain: assessment.domain,
                ownerId: assessment.ownerId,
                startDate: assessment.startDate,
                endDate: assessment.endDate,
                status: assessment.status,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
