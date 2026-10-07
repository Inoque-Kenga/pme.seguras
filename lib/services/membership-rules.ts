import type { MembershipStatus, Role } from "@prisma/client";

export type MembershipLike = {
  userId: string;
  role: Role;
  status: MembershipStatus;
};

/**
 * Regra: um utilizador não pode ter dois memberships ativos na mesma organização.
 * Devolve true se já existir um membership ativo para o utilizador.
 */
export function hasActiveMembership(memberships: MembershipLike[], userId: string): boolean {
  return memberships.some((membership) => membership.userId === userId && membership.status === "ACTIVE");
}

/**
 * Regra: não é permitido remover/desativar/rebaixar o último GESTOR_CLIENTE ativo
 * de uma organização. Devolve true se a operação é segura.
 */
export function canChangeManager(
  memberships: MembershipLike[],
  targetUserId: string,
): boolean {
  const target = memberships.find((membership) => membership.userId === targetUserId);
  if (!target || target.role !== "GESTOR_CLIENTE" || target.status !== "ACTIVE") return true;
  const activeManagers = memberships.filter(
    (membership) => membership.role === "GESTOR_CLIENTE" && membership.status === "ACTIVE",
  );
  return activeManagers.length > 1;
}

/** Regra: só SUPER_ADMIN pode atribuir (ou manter) o papel SUPER_ADMIN. */
export function canAssignRole(actorRoles: string[], newRole: Role): boolean {
  if (newRole === "SUPER_ADMIN") return actorRoles.includes("SUPER_ADMIN");
  return true;
}
