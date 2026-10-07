import { redirect } from "next/navigation";
import { requireSession, resolveOrganization } from "@/lib/current-organization";

/** Rota de compatibilidade: redireciona para as tarefas da organização atual. */
export default async function TasksRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const orgId = typeof params.org === "string" ? params.org : undefined;
  const ctx = await resolveOrganization(session, orgId);
  if (!ctx) redirect("/dashboard");
  redirect(`/organizacoes/${ctx.organization.id}/tarefas`);
}
