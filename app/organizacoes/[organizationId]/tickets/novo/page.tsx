import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { listAssetOptions } from "@/lib/services/asset.service";
import { TicketForm } from "../ticket-form";
import { createTicketAction } from "../actions";

export default async function NewTicketPage({
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

  const assets = await listAssetOptions(ctx.organization.id);
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Abrir novo ticket"
          description="Descreva o problema ou pedido. A equipa de segurança será notificada pela plataforma."
        />
        <FeedbackMessage error={error} />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <TicketForm
            action={createTicketAction}
            assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
            submitLabel="Abrir ticket"
            hiddenFields={{ org: ctx.organization.id }}
          />
        </section>
      </div>
    </AppShell>
  );
}
