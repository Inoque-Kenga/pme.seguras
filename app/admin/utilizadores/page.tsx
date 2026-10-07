import { Role } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/current-organization";
import { prisma } from "@/lib/prisma";
import { listUsersWithMemberships } from "@/lib/services/users.service";
import { roleLabels } from "@/lib/labels";
import { createUserAction, setUserActiveAction } from "./actions";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const roles = Array.from(new Set(session.user.memberships.map((membership) => membership.role)));

  if (!roles.includes("SUPER_ADMIN")) {
    return (
      <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
        <div className="mx-auto max-w-3xl">
          <PageHeader eyebrow="Administração" title="Acessos" description="Acesso reservado." />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Apenas o super administrador pode gerir utilizadores e acessos.
          </p>
        </div>
      </AppShell>
    );
  }

  const search = typeof params.search === "string" ? params.search : "";
  const [users, organizations] = await Promise.all([
    listUsersWithMemberships(search || undefined),
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const error = typeof params.error === "string" ? params.error : undefined;
  const success = typeof params.success === "string" ? params.success : undefined;

  return (
    <AppShell name={session.user.name ?? "Utilizador"} roles={roles}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Administração"
          title="Utilizadores e acessos"
          description="Crie contas e atribua papéis por organização. As passwords exigem pelo menos 12 caracteres."
        />
        <FeedbackMessage error={error} success={success} />

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Criar utilizador</h2>
          <form action={createUserAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input required name="name" placeholder="Nome completo *" className={inputClass} />
            <input required name="email" type="email" placeholder="E-mail *" className={inputClass} />
            <input
              required
              name="password"
              type="password"
              minLength={12}
              placeholder="Palavra-passe (mín. 12) *"
              autoComplete="new-password"
              className={inputClass}
            />
            <select name="organizationId" className={inputClass} required defaultValue="">
              <option value="" disabled>
                Selecione a organização *
              </option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
            <select name="role" className={inputClass} defaultValue="COLABORADOR">
              {Object.values(Role).map((role) => (
                <option key={role} value={role}>{roleLabels[role]}</option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900"
            >
              Criar utilizador
            </button>
          </form>
        </section>

        <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
          <input name="search" placeholder="Pesquisar por nome ou e-mail" defaultValue={search} className={`${inputClass} w-72`} />
          <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900">
            Pesquisar
          </button>
        </form>

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">E-mail</th>
                <th className="px-5 py-3 font-semibold">E-mail verificado</th>
                <th className="px-5 py-3 font-semibold">Organizações e papéis</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Nenhum utilizador encontrado para esta pesquisa.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-5 py-3 text-slate-600">{user.email}</td>
                  <td className="px-5 py-3">
                    <StatusBadge label={user.emailVerified ? "Verificado" : "Por verificar"} tone={user.emailVerified ? "green" : "slate"} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {user.memberships.length === 0
                      ? "—"
                      : user.memberships
                          .map((membership) => `${membership.organization.name} · ${roleLabels[membership.role]}`)
                          .join(" | ")}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge label={user.isActive ? "Ativo" : "Inativo"} tone={user.isActive ? "green" : "slate"} />
                  </td>
                  <td className="px-5 py-3">
                    {user.id !== session.user.id && (
                      <form action={setUserActiveAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="isActive" value={String(!user.isActive)} />
                        <button type="submit" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                          {user.isActive ? "Desativar" : "Reativar"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
