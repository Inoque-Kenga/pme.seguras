import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { hashText, randomToken } from "@/lib/crypto";
import { passwordPolicySchema } from "@/lib/password-policy";
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/services/errors";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export const requestResetSchema = z.object({
  email: z.string().trim().email("E-mail inválido.").max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Ligação inválida."),
  password: passwordPolicySchema,
  confirmPassword: z.string(),
});

const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * Pedido de recuperação. Resposta é sempre genérica (não revela se o e-mail existe).
 * Em desenvolvimento, a ligação é mostrada no terminal e devolvida para a UI.
 */
export async function requestPasswordReset(input: unknown): Promise<Result<{ devResetLink?: string }>> {
  const parsed = requestResetSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const email = parsed.data.email.toLowerCase();
  const limit = await checkRateLimit(`reset:${email}`, RATE_LIMITS.passwordReset.maxAttempts, RATE_LIMITS.passwordReset.windowMs, {
    resource: "password_reset",
  });
  if (!limit.allowed) return err("VALIDATION", rateLimitMessage(limit));

  const user = await prisma.user.findUnique({ where: { email } });

  // Resposta genérica mesmo que o e-mail não exista (anti-enumeração).
  if (!user || !user.isActive) {
    return ok({});
  }

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashText(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "STATUS_CHANGE",
    resource: "password_reset",
    resourceId: user.id,
    metadata: { fase: "pedido" },
  });

  const link = `${APP_URL}/redefinir-password/${token}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[DEV] Ligação de recuperação para ${email}:\n${link}\n`);
    return ok({ devResetLink: link });
  }
  // Produção: envio por e-mail (integração futura).
  return ok({});
}

async function findValidToken(rawToken: string) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashText(rawToken), usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  });
}

/** Valida um token (para a página de redefinição). */
export async function validateResetToken(rawToken: string): Promise<boolean> {
  if (!rawToken || rawToken.length < 10) return false;
  const token = await findValidToken(rawToken);
  return Boolean(token?.user.isActive);
}

/** Redefine a password com token de uso único; invalida as sessões do utilizador. */
export async function resetPasswordWithToken(input: unknown): Promise<Result> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return err("VALIDATION", "As palavras-passe não coincidem.");
  }

  const token = await findValidToken(parsed.data.token);
  if (!token || !token.user.isActive) {
    await writeAuditLog({
      action: "STATUS_CHANGE",
      resource: "password_reset",
      metadata: { fase: "falha_token" },
    });
    return err("VALIDATION", "A ligação de recuperação é inválida ou expirou. Peça uma nova.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    // Invalida todas as sessões ativas do utilizador.
    prisma.userSession.updateMany({
      where: { userId: token.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await writeAuditLog({
    actorId: token.userId,
    action: "STATUS_CHANGE",
    resource: "password_reset",
    resourceId: token.userId,
    metadata: { fase: "sucesso" },
  });
  return ok(undefined);
}
