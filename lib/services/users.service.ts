import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { fail, ok, type ServiceResult } from "@/lib/services/common";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Indique o nome do utilizador.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(254),
  password: z.string().min(12, "A palavra-passe deve ter pelo menos 12 caracteres.").max(128),
  organizationId: z.string().min(1, "Selecione a organização."),
  role: z.nativeEnum(Role),
});

/** Membros ativos de uma organização (para atribuição de tarefas/tickets). */
export async function listOrganizationMembers(organizationId: string) {
  return prisma.organizationMembership.findMany({
    where: { organizationId, status: "ACTIVE", user: { isActive: true } },
    select: { user: { select: { id: true, name: true } }, role: true },
    orderBy: { user: { name: "asc" } },
  });
}

export async function listUsersWithMemberships(search?: string) {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          status: true,
          organization: { select: { name: true } },
        },
      },
    },
  });
}

/** Apenas SUPER_ADMIN pode criar utilizadores (verificado pelo chamador). */
export async function createUser(actorId: string, input: unknown): Promise<ServiceResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Já existe um utilizador com este e-mail.");

  const organization = await prisma.organization.findUnique({ where: { id: parsed.data.organizationId } });
  if (!organization) return fail("Organização não encontrada.");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      memberships: {
        create: { organizationId: organization.id, role: parsed.data.role },
      },
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: organization.id,
    action: "CREATE",
    resource: "user",
    resourceId: user.id,
    metadata: { role: parsed.data.role },
  });
  return ok;
}

export async function setUserActive(actorId: string, userId: string, isActive: boolean): Promise<ServiceResult> {
  if (actorId === userId) return fail("Não pode desativar a sua própria conta.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return fail("Utilizador não encontrado.");

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await writeAuditLog({
    actorId,
    action: "STATUS_CHANGE",
    resource: "user",
    resourceId: userId,
    metadata: { isActive },
  });
  return ok;
}
