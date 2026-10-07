import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditRisks } from "@/lib/services/risk.service";
import { listAssetOptions } from "@/lib/services/asset.service";
import { listAssessments } from "@/lib/services/risk-assessment.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import { RiskForm } from "../risk-form";
import { createRiskAction } from "../actions";

export default async function NewRiskPage({
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
  if (!canEditRisks(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/riscos?error=O+seu+papel+n%C3%A3o+pode+registar+riscos.`);
  }

  const [members, assets, assessments] = await Promise.all([
    listOrganizationMembers(ctx.organization.id),
    listAssetOptions(ctx.organization.id),
    listAssessments(ctx.organization.id),
  ]);
  const error = typeof query.error === "string" ? query.error : undefined;
  const preselectedAssessment = typeof query.assessmentId === "string" ? query.assessmentId : "";

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Registar novo risco"
          description="Descreva a ameaça e a vulnerabilidade, e classifique a probabilidade e o impacto de 1 a 5."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <RiskForm
            action={createRiskAction}
            members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
            assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
            assessments={assessments.map((assessment) => ({ id: assessment.id, name: assessment.title }))}
            values={{ assessmentId: preselectedAssessment }}
            submitLabel="Registar risco"
            hiddenFields={{ org: ctx.organization.id }}
          />
        </section>
      </div>
    </AppShell>
  );
}
