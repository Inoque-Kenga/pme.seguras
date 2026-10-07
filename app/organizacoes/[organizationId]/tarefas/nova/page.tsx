import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditTasks } from "@/lib/services/treatment-task.service";
import { listRiskOptions } from "@/lib/services/risk.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import { TaskForm } from "../task-form";
import { createTaskAction } from "../actions";

export default async function NewTaskPage({
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

  if (!ctx) redirect("/dashboard?error=Organiza%C3%A7%C3%A3o+n%C3%A3o+encontrada.");
  if (!canEditTasks(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/tarefas?error=O+seu+papel+n%C3%A3o+pode+criar+tarefas.`);
  }

  const [members, risks] = await Promise.all([
    listOrganizationMembers(ctx.organization.id),
    listRiskOptions(ctx.organization.id),
  ]);
  if (risks.length === 0) {
    redirect(`/organizacoes/${organizationId}/riscos/novo?error=Registe+primeiro+um+risco+para+lhe+associar+tarefas.`);
  }

  const error = typeof query.error === "string" ? query.error : undefined;
  const preselectedRisk = typeof query.riskId === "string" ? query.riskId : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Nova tarefa de tratamento"
          description="Cada tarefa está associada a um risco e contribui para o respetivo tratamento."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <TaskForm
            action={createTaskAction}
            members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
            risks={risks.map((risk) => ({ id: risk.id, title: risk.title, riskLevel: risk.riskLevel }))}
            values={{ riskId: preselectedRisk }}
            submitLabel="Criar tarefa"
            hiddenFields={{ org: ctx.organization.id }}
          />
        </section>
      </div>
    </AppShell>
  );
}
