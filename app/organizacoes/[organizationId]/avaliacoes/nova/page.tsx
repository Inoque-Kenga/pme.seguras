import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageAssessments } from "@/lib/services/risk-assessment.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import { AssessmentForm } from "../assessment-form";
import { createAssessmentAction } from "../actions";

export default async function NewAssessmentPage({
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
  if (!canManageAssessments(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/avaliacoes?error=O+seu+papel+n%C3%A3o+pode+criar+avalia%C3%A7%C3%B5es.`);
  }

  const members = await listOrganizationMembers(ctx.organization.id);
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Nova avaliação de risco"
          description="Defina o âmbito da avaliação. Os riscos são associados a seguir, na página da avaliação ou dos riscos."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <AssessmentForm
            action={createAssessmentAction}
            members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
            submitLabel="Criar avaliação"
            hiddenFields={{ org: ctx.organization.id }}
          />
        </section>
      </div>
    </AppShell>
  );
}
