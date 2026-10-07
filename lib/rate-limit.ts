import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Rate limiting simples baseado em tabela (funciona com várias instâncias).
 * Estratégia: janela fixa — até maxAttempts por windowMs por chave.
 * A limpeza é lazy: entradas expiradas são substituídas na próxima leitura.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  audit?: { actorId?: string; organizationId?: string; resource: string },
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const entry = await prisma.rateLimitEntry.findUnique({ where: { key } });

  // Sem entrada ou janela expirada → nova janela.
  if (!entry || entry.resetAt <= now) {
    await prisma.rateLimitEntry.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
  }

  // Limite excedido.
  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000));
    if (audit) {
      await writeAuditLog({
        actorId: audit.actorId,
        organizationId: audit.organizationId,
        action: "RATE_LIMIT_EXCEEDED",
        resource: audit.resource,
        metadata: { key: key.slice(0, 60) },
      });
    }
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  // Dentro do limite → incrementa.
  const updated = await prisma.rateLimitEntry.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true, remaining: Math.max(0, maxAttempts - updated.count), retryAfterSeconds: 0 };
}

/** Limites usados na plataforma. */
export const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  report: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
} as const;

export function rateLimitMessage(result: RateLimitResult): string {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return `Muitas tentativas. Tente novamente em ${minutes} minuto(s).`;
}
