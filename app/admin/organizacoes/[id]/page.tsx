import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { requireSuperAdminSession } from "@/lib/action-context";
import { getOrganizationById, listActivePlans } from "@/lib/services/organization.service";
import { organizationSizeLabels, organizationStatusLabels, organizationStatusTones } from "@/lib/labels";
import { OrganizationForm } from "../organization-form";
import { archiveOrganizationAction, updateOrganizationAction } from "../actions";

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireSuperAdminSession();
  const [organization, plans] = await Promise.all([getOrganizationById(id), listActivePlans()]);
  if (!organization) notFound();

  const error = typeof query.error === "string" ? query.error : undefined;
  const success = typeof query.success === "string" ? query.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={["SUPER_ADMIN"]}>
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Administração" title={organization.name} description="Detalhe e edição da organização cliente." />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Estado</dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={organizationStatusLabels[organization.status]}
                    tone={organizationStatusTones[organization.status]}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Dimensão</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {organization.dimensao ? organizationSizeLabels[organization.dimensao] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Plano</dt>
                <dd className="mt-1 font-medium text-slate-900">{organization.plano?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Membros</dt>
                <dd className="mt-1 font-medium text-slate-900">{organization._count.memberships}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Ativos</dt>
                <dd className="mt-1 font-medium text-slate-900">{organization._count.assets}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Incidentes</dt>
                <dd className="mt-1 font-medium text-slate-900">{organization._count.incidents}</dd>
              </div>
            </dl>
            <div className="flex gap-3">
              <Link
                href={`/organizacoes/${organization.id}/ativos`}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Ver ativos →
              </Link>
              <Link
                href={`/organizacoes/${organization.id}/utilizadores`}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Ver membros →
              </Link>
            </div>
          </div>
        </section>

        {organization.status === "ACTIVE" ? (
          <>
            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">Editar organização</h2>
              <OrganizationForm
                action={updateOrganizationAction}
                plans={plans}
                submitLabel="Guardar alterações"
                hiddenFields={{ id: organization.id }}
                values={{
                  name: organization.name,
                  slug: organization.slug,
                  nif: organization.nif,
                  sector: organization.sector,
                  dimensao: organization.dimensao,
                  city: organization.city,
                  provincia: organization.provincia,
                  contactoNome: organization.contactoNome,
                  contactoEmail: organization.contactoEmail,
                  contactoTelefone: organization.contactoTelefone,
                  planoId: organization.planoId,
                }}
              />
            </section>
            <section className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-base font-semibold text-red-900">Zona de risco</h2>
              <p className="mt-1 text-sm leading-6 text-red-800">
                Arquivar suspende o acesso dos utilizadores a esta organização. Os dados não são apagados.
              </p>
              <div className="mt-4">
                <ConfirmAction
                  triggerLabel="Arquivar organização"
                  title="Arquivar organização?"
                  description={`A organização "${organization.name}" ficará inacessível para todos os membros até ser reativada. Os dados são mantidos.`}
                  confirmLabel="Sim, arquivar"
                  action={archiveOrganizationAction}
                  fields={{ id: organization.id }}
                />
              </div>
            </section>
          </>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            Esta organização está arquivada. Os dados são mantidos apenas para consulta histórica.
          </p>
        )}
      </div>
    </AppShell>
  );
}
