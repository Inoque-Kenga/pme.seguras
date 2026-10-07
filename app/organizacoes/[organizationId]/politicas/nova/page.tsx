import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditPolicies } from "@/lib/services/policy.service";
import { PolicyForm } from "../policy-form";
import { createPolicyAction } from "../actions";

export default async function NewPolicyPage({
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
  if (!canEditPolicies(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/politicas?error=O+seu+papel+apenas+pode+visualizar+pol%C3%ADticas.`);
  }

  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Nova política de segurança"
          description="Escreva regras claras e práticas. Guarde como rascunho enquanto revê, e publique quando estiver pronta."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <PolicyForm action={createPolicyAction} submitLabel="Criar política" hiddenFields={{ org: ctx.organization.id }} />
        </section>
      </div>
    </AppShell>
  );
}
