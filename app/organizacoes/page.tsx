import { redirect } from "next/navigation";
import { isGlobalAdmin, requireSession, resolveOrganization } from "@/lib/current-organization";

/** Rota de compatibilidade: admins vão para a gestão; restantes para os seus ativos. */
export default async function OrganizationsRedirectPage() {
  const session = await requireSession();
  if (isGlobalAdmin(session) || session.user.memberships.some((membership) => membership.role === "ANALISTA_SEGURANCA")) {
    redirect("/admin/organizacoes");
  }
  const ctx = await resolveOrganization(session);
  if (!ctx) redirect("/dashboard");
  redirect(`/organizacoes/${ctx.organization.id}/ativos`);
}
