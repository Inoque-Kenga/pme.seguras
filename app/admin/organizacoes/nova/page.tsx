import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSuperAdminSession } from "@/lib/action-context";
import { listActivePlans } from "@/lib/services/organization.service";
import { OrganizationForm } from "../organization-form";
import { createOrganizationAction } from "../actions";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireSuperAdminSession();
  const roles = ["SUPER_ADMIN"];
  const plans = await listActivePlans();
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Administração"
          title="Nova organização"
          description="Registe uma nova empresa cliente. O criador fica associado como super administrador da organização."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <OrganizationForm action={createOrganizationAction} plans={plans} submitLabel="Criar organização" />
        </section>
      </div>
    </AppShell>
  );
}
