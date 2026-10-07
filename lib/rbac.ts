import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function requireRole(allowedRoles: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, session: null };
  }
  const roles = session.user.memberships.map((membership) => membership.role);
  if (!allowedRoles.some((role) => roles.includes(role))) {
    return { ok: false as const, status: 403 as const, session };
  }
  return { ok: true as const, session };
}

export async function requireOrganizationAccess(organizationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, session: null };
  }

  const membership = session.user.memberships.find(
    (candidate) => candidate.organizationId === organizationId,
  );
  if (!membership) return { ok: false as const, status: 403 as const, session };
  return { ok: true as const, session, membership };
}

export function canManageOrganizations(roles: string[]) {
  return roles.includes("SUPER_ADMIN");
}
