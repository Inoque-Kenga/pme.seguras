import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditAssets } from "@/lib/services/asset.service";
import { AssetForm } from "../asset-form";
import { createAssetAction } from "../actions";

export default async function NewAssetPage({
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
  if (!canEditAssets(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/ativos?error=O+seu+papel+apenas+pode+visualizar+ativos.`);
  }

  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Registar novo ativo"
          description="Adicione um equipamento, aplicação, conjunto de dados ou serviço ao inventário."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <AssetForm action={createAssetAction} submitLabel="Registar ativo" hiddenFields={{ org: ctx.organization.id }} />
        </section>
      </div>
    </AppShell>
  );
}
