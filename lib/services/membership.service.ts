import { z } from "zod";
import bcrypt from "bcryptjs";
import { MembershipStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import { canAssignRole, canChangeManager, hasActiveMembership } from "@/lib/services/membership-rules";

const MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "GESTOR_CLIENTE"];

const inviteSchema = z.object({
  email: z.string().trim().email("E-mail inválido.").max(254),
  name: z.string().trim().min(2, "Indique o nome do utilizador.").max(120),
  password: z.string().min(12, "A palavra-passe inicial deve ter pelo menos 12 caracteres.").max(128),
  role: z.nativeEnum(Role),
});

export type MemberListParams = {
  role?: Role;
  status?: MembershipStatus;
};

/** Quem pode gerir membros de uma organização. */
export function canManageMembers(actorRoles: string[]): boolean {
  return actorRoles.some((role) => (MANAGER_ROLES as string[]).includes(role));
}

async function getOrgMemberships(organizationId: string) {
  return prisma.organizationMembership.findMany({
    where: { organizationId },
    select: { userId: true, role: true, status: true },
  });
}

export async function listMembers(organizationId: string, params: MemberListParams = {}) {
  return prisma.organizationMembership.findMany({
    where: {
      organizationId,
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true, isActive: true, emailVerified: true } } },
    orderBy: [{ status: "asc" }, { user: { name: "asc" } }],
  });
}

/**
 * Convida um utilizador para a organização. Se o e-mail ainda não existir,
 * cria a conta com a password inicial fornecida.
 */
export async function inviteMember(
  actorId: string,
  actorRoles: string[],
  organizationId: string,
  input: unknown,
): Promise<Result> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (!canAssignRole(actorRoles, parsed.data.role)) {
    return err("FORBIDDEN", "Apenas o super administrador pode atribuir o papel de super administrador.");
  }

  const email = parsed.data.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    user = await prisma.user.create({
      data: { name: parsed.data.name, email, passwordHash },
    });
  }

  const memberships = await getOrgMemberships(organizationId);
  if (hasActiveMembership(memberships, user.id)) {
    return err("CONFLICT", "Este utilizador já é membro ativo desta organização.");
  }

  const existing = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (existing) {
    // Reativa um acesso anteriormente suspenso/convidado.
    await prisma.organizationMembership.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", role: parsed.data.role },
    });
  } else {
    await prisma.organizationMembership.create({
      data: { userId: user.id, organizationId, role: parsed.data.role },
    });
  }

  await writeAuditLog({
    actorId,
    organizationId,
    action: "ASSIGN",
    resource: "membership",
    resourceId: user.id,
    metadata: { role: parsed.data.role },
  });
  return ok(undefined);
}

export async function changeMemberRole(
  actorId: string,
  actorRoles: string[],
  organizationId: string,
  targetUserId: string,
  newRole: unknown,
): Promise<Result> {
  const parsed = z.nativeEnum(Role).safeParse(newRole);
  if (!parsed.success) return err("VALIDATION", "Papel inválido.");
  if (!canAssignRole(actorRoles, parsed.data)) {
    return err("FORBIDDEN", "Apenas o super administrador pode atribuir o papel de super administrador.");
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!membership) return err("NOT_FOUND", "Membro não encontrado nesta organização.");

  const memberships = await getOrgMemberships(organizationId);
  if (!canChangeManager(memberships, targetUserId)) {
    return err("CONFLICT", "Não é possível alterar o papel do último gestor cliente da organização.");
  }

  await prisma.organizationMembership.update({
    where: { id: membership.id },
    data: { role: parsed.data },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "ASSIGN",
    resource: "membership",
    resourceId: targetUserId,
    metadata: { role: parsed.data },
  });
  return ok(undefined);
}

export async function setMemberStatus(
  actorId: string,
  organizationId: string,
  targetUserId: string,
  status: unknown,
): Promise<Result> {
  const parsed = z.nativeEnum(MembershipStatus).safeParse(status);
  if (!parsed.success) return err("VALIDATION", "Estado inválido.");
  if (actorId === targetUserId) return err("FORBIDDEN", "Não pode alterar o estado do seu próprio acesso.");

  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!membership) return err("NOT_FOUND", "Membro não encontrado nesta organização.");

  if (parsed.data !== "ACTIVE") {
    const memberships = await getOrgMemberships(organizationId);
    if (!canChangeManager(memberships, targetUserId)) {
      return err("CONFLICT", "Não é possível desativar o último gestor cliente da organização.");
    }
  }

  await prisma.organizationMembership.update({
    where: { id: membership.id },
    data: { status: parsed.data },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "STATUS_CHANGE",
    resource: "membership",
    resourceId: targetUserId,
    metadata: { status: parsed.data },
  });
  return ok(undefined);
}

export async function removeMember(
  actorId: string,
  organizationId: string,
  targetUserId: string,
): Promise<Result> {
  if (actorId === targetUserId) return err("FORBIDDEN", "Não pode remover o seu próprio acesso.");

  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });
  if (!membership) return err("NOT_FOUND", "Membro não encontrado nesta organização.");

  const memberships = await getOrgMemberships(organizationId);
  if (!canChangeManager(memberships, targetUserId)) {
    return err("CONFLICT", "Não é possível remover o último gestor cliente da organização.");
  }

  await prisma.organizationMembership.delete({ where: { id: membership.id } });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "DELETE",
    resource: "membership",
    resourceId: targetUserId,
  });
  return ok(undefined);
}
