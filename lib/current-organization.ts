import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isSessionActive } from "@/lib/services/session.service";

async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Obtém a sessão ou redireciona para o login. Uso em páginas privadas.
 * Sessões terminadas em /seguranca ou por redefinição de password são rejeitadas.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!(await isSessionActive(session.user.sessionId))) {
    redirect("/login?error=Sess%C3%A3o+terminada.+Inicie+sess%C3%A3o+novamente.");
  }
  return session;
}

export function isGlobalAdmin(session: Awaited<ReturnType<typeof requireSession>>): boolean {
  return session.user.memberships.some((membership) => membership.role === "SUPER_ADMIN");
}

/**
 * Resolve a organização de trabalho do utilizador.
 * O identificador pedido pelo browser só é aceite se existir uma associação
 * ativa na sessão; SUPER_ADMIN tem âmbito global (ver ARCHITECTURE.md).
 * Sem identificador válido, usa-se a primeira associação.
 */
export async function resolveOrganization(
  session: Awaited<ReturnType<typeof requireSession>>,
  requestedId?: string,
) {
  const memberships = session.user.memberships;
  if (memberships.length === 0) return null;

  const membership = requestedId
    ? memberships.find((candidate) => candidate.organizationId === requestedId)
    : undefined;

  let organizationId: string;
  let role: string;
  if (membership) {
    organizationId = membership.organizationId;
    role = membership.role;
  } else if (requestedId && isGlobalAdmin(session)) {
    // SUPER_ADMIN tem âmbito global: acede a qualquer organização ativa.
    organizationId = requestedId;
    role = "SUPER_ADMIN";
  } else if (!requestedId) {
    organizationId = memberships[0].organizationId;
    role = memberships[0].role;
  } else {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!organization || organization.status !== "ACTIVE") return null;

  return { organization, role };
}

export type OrganizationContext = NonNullable<Awaited<ReturnType<typeof resolveOrganization>>>;

/**
 * Lista as organizações visíveis para o utilizador (para o seletor).
 * SUPER_ADMIN vê todas as organizações ativas.
 */
export async function listMembershipOrganizations(session: Awaited<ReturnType<typeof requireSession>>) {
  if (isGlobalAdmin(session)) {
    return prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }
  const ids = session.user.memberships.map((membership) => membership.organizationId);
  return prisma.organization.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}
