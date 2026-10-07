import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { passwordPolicySchema } from "@/lib/password-policy";
import { err, ok, type Result } from "@/lib/services/errors";

/** Regista uma sessão emitida no login (chamado pelo callback JWT). */
export async function recordSession(userId: string, sessionId: string, ipAddress?: string, userAgent?: string) {
  await prisma.userSession.create({
    data: { id: sessionId, userId, ipAddress: ipAddress ?? null, userAgent: userAgent ?? null },
  });
}

/** Termina uma sessão (usado no logout). */
export async function revokeSessionById(sessionId: string) {
  await prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Verifica se a sessão da JWT continua válida (não revogada). */
export async function isSessionActive(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return true; // sessões anteriores à Fase D1 não têm registo
  const session = await prisma.userSession.findUnique({ where: { id: sessionId }, select: { revokedAt: true } });
  if (!session) return true;
  return session.revokedAt === null;
}

/** Sessões ativas do utilizador. */
export async function listUserSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });
}

/** Últimos logins (a partir da auditoria). */
export async function listRecentLogins(userId: string) {
  return prisma.auditLog.findMany({
    where: { actorId: userId, action: "LOGIN" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

/** Termina uma sessão — apenas o próprio utilizador pode terminar as suas. */
export async function revokeOwnSession(actorId: string, organizationId: string | undefined, sessionId: string): Promise<Result> {
  const session = await prisma.userSession.findUnique({ where: { id: sessionId }, select: { userId: true, revokedAt: true } });
  if (!session || session.userId !== actorId) return err("NOT_FOUND", "Sessão não encontrada.");
  if (session.revokedAt) return err("CONFLICT", "Esta sessão já foi terminada.");

  await revokeSessionById(sessionId);
  await writeAuditLog({
    actorId,
    organizationId,
    action: "UPDATE",
    resource: "user_session",
    resourceId: sessionId,
  });
  return ok(undefined);
}

/** Termina todas as outras sessões do utilizador (mantém a atual). */
export async function revokeOtherSessions(
  actorId: string,
  organizationId: string | undefined,
  currentSessionId?: string,
): Promise<Result> {
  await prisma.userSession.updateMany({
    where: { userId: actorId, revokedAt: null, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "UPDATE",
    resource: "user_session",
    metadata: { todas: true },
  });
  return ok(undefined);
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Indique a palavra-passe atual."),
  newPassword: passwordPolicySchema,
  confirmPassword: z.string(),
});

/** Alteração de password: exige a atual; revoga as outras sessões. */
export async function changePassword(
  actorId: string,
  organizationId: string | undefined,
  input: unknown,
  currentSessionId?: string,
): Promise<Result> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return err("VALIDATION", "As palavras-passe novas não coincidem.");
  }

  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { passwordHash: true } });
  if (!user) return err("NOT_FOUND", "Utilizador não encontrado.");

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return err("FORBIDDEN", "A palavra-passe atual está incorreta.");

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: actorId }, data: { passwordHash } });
  await revokeOtherSessions(actorId, organizationId, currentSessionId);
  await writeAuditLog({
    actorId,
    organizationId,
    action: "UPDATE",
    resource: "user_password",
    resourceId: actorId,
  });
  return ok(undefined);
}

/** Verifica se a password atual está correta (usado antes de desativar MFA). */
export async function verifyCurrentPassword(actorId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { passwordHash: true } });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

/** Descrição simples do dispositivo a partir do user-agent. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconhecido";
  const browser = userAgent.includes("Edg")
    ? "Edge"
    : userAgent.includes("Chrome")
      ? "Chrome"
      : userAgent.includes("Firefox")
        ? "Firefox"
        : userAgent.includes("Safari")
          ? "Safari"
          : "Navegador";
  const os = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac")
      ? "macOS"
      : userAgent.includes("Linux")
        ? "Linux"
        : userAgent.includes("Android")
          ? "Android"
          : userAgent.includes("iPhone") || userAgent.includes("iPad")
            ? "iOS"
            : "SO desconhecido";
  return `${browser} · ${os}`;
}
