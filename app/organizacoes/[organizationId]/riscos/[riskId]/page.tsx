import Link from "next/link";
import { notFound } from "next/navigation";
import { RiskStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditRisks, getRisk } from "@/lib/services/risk.service";
import { canEditTasks } from "@/lib/services/treatment-task.service";
import { listAssetOptions } from "@/lib/services/asset.service";
import { listAssessments } from "@/lib/services/risk-assessment.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import {
  priorityLabels,
  priorityTones,
  riskLevelLabels,
  riskLevelTones,
  riskStatusLabels,
  riskStatusTones,
  treatmentTaskStatusLabels,
  treatmentTaskStatusTones,
} from "@/lib/labels";
import { RiskForm } from "../risk-form";
import { setRiskStatusAction, updateRiskAction } from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(date);
}

export default async function RiskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; riskId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, riskId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const ctx = await resolveOrganization(session, organizationId);
  if (!ctx) notFound();

  const risk = await getRisk(ctx.organization.id, riskId);
  if (!risk) notFound();

  const editable = canEditRisks(ctx.role);
  const tasksEditable = canEditTasks(ctx.role);
  const [members, assets, assessments] = editable
    ? await Promise.all([
        listOrganizationMembers(ctx.organization.id),
        listAssetOptions(ctx.organization.id),
        listAssessments(ctx.organization.id),
      ])
    : [[], [], []];

  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;
  const highlight = risk.riskLevel === "CRITICO" || risk.riskLevel === "ALTO";

  const info: [string, React.ReactNode][] = [
    ["Probabilidade", `${risk.probability} de 5`],
    ["Impacto", `${risk.impact} de 5`],
    ["Nível calculado", `${risk.level} (${riskLevelLabels[risk.riskLevel]})`],
    ["Ameaça", risk.threat ?? "—"],
    ["Vulnerabilidade", risk.vulnerability ?? "—"],
    ["Ativo", risk.asset?.name ?? "—"],
    ["Avaliação", risk.assessment?.title ?? "—"],
    ["Responsável", risk.owner?.name ?? "—"],
    ["Prazo de tratamento", formatDate(risk.dueDate)],
  ];

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-5xl">
        <PageHeader eyebrow={ctx.organization.name} title={risk.title} description="Detalhe do risco, tratamento e tarefas associadas." />
        <FeedbackMessage error={error} success={success} />

        <section className={`mb-6 rounded-xl border bg-white p-6 ${highlight ? "border-red-200" : "border-slate-200"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {highlight && <span className="text-lg" aria-label="Risco elevado" title="Risco elevado">⚠️</span>}
              <StatusBadge label={`Nível ${risk.level} · ${riskLevelLabels[risk.riskLevel]}`} tone={riskLevelTones[risk.riskLevel]} />
              <StatusBadge label={riskStatusLabels[risk.status]} tone={riskStatusTones[risk.status]} />
            </div>
            {editable && (
              <form action={setRiskStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="org" value={ctx.organization.id} />
                <input type="hidden" name="id" value={risk.id} />
                <select name="status" defaultValue={risk.status} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                  {Object.values(RiskStatus).map((status) => (
                    <option key={status} value={status}>{riskStatusLabels[status]}</option>
                  ))}
                </select>
                <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Atualizar estado
                </button>
              </form>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            {info.map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {risk.treatment && (
            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-950">
              <strong>Tratamento:</strong> {risk.treatment}
            </p>
          )}
          {risk.description && (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{risk.description}</p>
          )}
        </section>

        <section className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Tarefas de tratamento ({risk.tasks.length})</h2>
            {tasksEditable && (
              <Link
                href={`/organizacoes/${ctx.organization.id}/tarefas/nova?riskId=${risk.id}`}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                + Nova tarefa
              </Link>
            )}
          </div>
          {risk.tasks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Ainda não existem tarefas de tratamento para este risco.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tarefa</th>
                  <th className="px-5 py-3 font-semibold">Prioridade</th>
                  <th className="px-5 py-3 font-semibold">Responsável</th>
                  <th className="px-5 py-3 font-semibold">Prazo</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {risk.tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/organizacoes/${ctx.organization.id}/tarefas/${task.id}`}
                        className="font-medium text-blue-800 hover:underline"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={priorityLabels[task.priority]} tone={priorityTones[task.priority]} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{task.assignee?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(task.dueDate)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={treatmentTaskStatusLabels[task.status]}
                        tone={treatmentTaskStatusTones[task.status]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {editable && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Editar risco</h2>
            <RiskForm
              action={updateRiskAction}
              members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
              assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
              assessments={assessments.map((assessment) => ({ id: assessment.id, name: assessment.title }))}
              submitLabel="Guardar alterações"
              hiddenFields={{ org: ctx.organization.id, id: risk.id }}
              values={{
                title: risk.title,
                description: risk.description,
                assessmentId: risk.assessmentId,
                assetId: risk.assetId,
                threat: risk.threat,
                vulnerability: risk.vulnerability,
                probability: risk.probability,
                impact: risk.impact,
                treatment: risk.treatment,
                ownerId: risk.ownerId,
                dueDate: risk.dueDate,
                status: risk.status,
              }}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
