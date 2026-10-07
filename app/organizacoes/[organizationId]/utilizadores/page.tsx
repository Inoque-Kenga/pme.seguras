import { MembershipStatus, Role } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { requireSession, resolveOrganization } from "@/lib/current-organization";
import { canManageMembers, listMembers } from "@/lib/services/membership.service";
import { membershipStatusLabels, membershipStatusTones, roleLabels } from "@/lib/labels";
import { inviteMemberAction, changeMemberRoleAction, removeMemberAction, setMemberStatusAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function str(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function OrgMembersPage({
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

  if (!ctx) {
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow="Organização" title="Membros" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Não tem acesso a esta organização.
          </p>
        </div>
      </AppShell>
    );
  }

  const actorRoles = Array.from(new Set([...roles, ctx.role]));
  const manageable = canManageMembers(actorRoles);

  const roleFilter = str(query.role);
  const statusFilter = str(query.status);
  const members = await listMembers(ctx.organization.id, {
    role: (Object.values(Role) as string[]).includes(roleFilter) ? (roleFilter as Role) : undefined,
    status: (Object.values(MembershipStatus) as string[]).includes(statusFilter)
      ? (statusFilter as MembershipStatus)
      : undefined,
  });
  const error = str(query.error) || undefined;
  const success = str(query.success) || undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={ctx.organization.name}
          title="Membros da organização"
          description="Convide utilizadores, defina papéis e controle os acessos desta organização."
        />
        <FeedbackMessage error={error} success={success} />

        {manageable && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Convidar utilizador</h2>
            <p className="mt-1 text-xs text-slate-500">
              Se o e-mail ainda não existir, a conta é criada com a password inicial indicada.
            </p>
            <form action={inviteMemberAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <input type="hidden" name="org" value={ctx.organization.id} />
              <input required name="name" placeholder="Nome completo *" className={inputClass} />
              <input required name="email" type="email" placeholder="E-mail *" className={inputClass} />
              <input
                required
                name="password"
                type="password"
                minLength={12}
                placeholder="Password inicial (mín. 12) *"
                autoComplete="new-password"
                className={inputClass}
              />
              <select name="role" className={inputClass} defaultValue="COLABORADOR">
                {Object.values(Role)
                  .filter((role) => role !== "SUPER_ADMIN" || actorRoles.includes("SUPER_ADMIN"))
                  .map((role) => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
              </select>
              <button type="submit" className="h-10 rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900">
                Convidar
              </button>
            </form>
          </section>
        )}

        <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
          <select name="role" defaultValue={roleFilter} className={`${inputClass} w-48`}>
            <option value="">Todos os papéis</option>
            {Object.values(Role).map((role) => (
              <option key={role} value={role}>{roleLabels[role]}</option>
            ))}
          </select>
          <select name="status" defaultValue={statusFilter} className={`${inputClass} w-44`}>
            <option value="">Todos os estados</option>
            {Object.values(MembershipStatus).map((status) => (
              <option key={status} value={status}>{membershipStatusLabels[status]}</option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
            Filtrar
          </button>
        </form>

        {members.length === 0 ? (
          <EmptyState
            title="Nenhum membro encontrado"
            description="Ajuste os filtros ou convide o primeiro utilizador para esta organização."
          />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nome</th>
                  <th className="px-5 py-3 font-semibold">E-mail</th>
                  <th className="px-5 py-3 font-semibold">Papel</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  {manageable && <th className="px-5 py-3 font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isSelf = member.user.id === session.user.id;
                  return (
                    <tr key={member.user.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {member.user.name}
                        {isSelf && <span className="ml-2 text-xs text-slate-400">(você)</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{member.user.email}</td>
                      <td className="px-5 py-3">
                        {manageable && !isSelf ? (
                          <form action={changeMemberRoleAction} className="flex items-center gap-2">
                            <input type="hidden" name="org" value={ctx.organization.id} />
                            <input type="hidden" name="userId" value={member.user.id} />
                            <select name="role" defaultValue={member.role} className="h-8 rounded-md border border-slate-300 px-2 text-xs">
                              {Object.values(Role)
                                .filter((role) => role !== "SUPER_ADMIN" || actorRoles.includes("SUPER_ADMIN"))
                                .map((role) => (
                                  <option key={role} value={role}>{roleLabels[role]}</option>
                                ))}
                            </select>
                            <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                              Guardar
                            </button>
                          </form>
                        ) : (
                          <span className="text-slate-600">{roleLabels[member.role]}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          label={membershipStatusLabels[member.status]}
                          tone={membershipStatusTones[member.status]}
                        />
                      </td>
                      {manageable && (
                        <td className="px-5 py-3">
                          {!isSelf && (
                            <div className="flex items-center gap-3">
                              <form action={setMemberStatusAction}>
                                <input type="hidden" name="org" value={ctx.organization.id} />
                                <input type="hidden" name="userId" value={member.user.id} />
                                <input
                                  type="hidden"
                                  name="status"
                                  value={member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                                />
                                <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                                  {member.status === "ACTIVE" ? "Desativar" : "Reativar"}
                                </button>
                              </form>
                              <ConfirmAction
                                triggerLabel="Remover"
                                title="Remover acesso?"
                                description={`O acesso de ${member.user.name} a ${ctx.organization.name} será removido. A conta do utilizador é mantida.`}
                                confirmLabel="Sim, remover"
                                action={removeMemberAction}
                                fields={{ org: ctx.organization.id, userId: member.user.id }}
                              />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  );
}
