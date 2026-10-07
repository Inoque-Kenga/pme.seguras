import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canEditIncidents } from "@/lib/services/incident.service";
import { listAssetOptions } from "@/lib/services/asset.service";
import { listOrganizationMembers } from "@/lib/services/users.service";
import { IncidentForm } from "../incident-form";
import { createIncidentAction } from "../actions";

export default async function NewIncidentPage({
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
  if (!canEditIncidents(ctx.role)) {
    redirect(`/organizacoes/${organizationId}/incidentes?error=O+seu+papel+n%C3%A3o+pode+registar+incidentes.`);
  }

  const [members, assets] = await Promise.all([
    listOrganizationMembers(ctx.organization.id),
    listAssetOptions(ctx.organization.id),
  ]);
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Registar incidente de segurança"
          description="Registe o que aconteceu, os sistemas afetados e as ações imediatas tomadas."
        />
        <FeedbackMessage error={error} />
        <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <p className="font-semibold">Primeiras medidas recomendadas</p>
          <ul className="mt-1 list-inside list-disc">
            <li>Isolar o equipamento da rede (não desligar, se possível).</li>
            <li>Preservar evidências: não apagar e-mails, ficheiros ou registos.</li>
            <li>Avaliar o estado das cópias de segurança antes de recuperar sistemas.</li>
            <li>Em caso de ransomware: <strong>nunca pagar resgate</strong>; contactar apoio técnico e as autoridades.</li>
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <IncidentForm
            action={createIncidentAction}
            members={members.map((member) => ({ id: member.user.id, name: member.user.name }))}
            assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
            submitLabel="Registar incidente"
            hiddenFields={{ org: ctx.organization.id }}
          />
        </section>
      </div>
    </AppShell>
  );
}
