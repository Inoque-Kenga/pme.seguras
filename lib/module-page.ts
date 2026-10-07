import { listMembershipOrganizations, requireSession, resolveOrganization } from "@/lib/current-organization";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Carrega o contexto comum das páginas de módulo (sessão, organização, mensagens). */
export async function loadModulePage(searchParams: SearchParams) {
  const params = await searchParams;
  const session = await requireSession();
  const orgId = typeof params.org === "string" ? params.org : undefined;
  const ctx = await resolveOrganization(session, orgId);
  const organizations = await listMembershipOrganizations(session);
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));
  const error = typeof params.error === "string" ? params.error : undefined;
  const success = typeof params.success === "string" ? params.success : undefined;
  return { session, ctx, organizations, roles, error, success };
}
