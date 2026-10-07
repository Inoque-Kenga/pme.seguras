import crypto from "node:crypto";
import { z } from "zod";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { decryptText, encryptText, hashText } from "@/lib/crypto";
import { err, ok, type Result } from "@/lib/services/errors";

export const totpCodeSchema = z.string().trim().regex(/^\d{6}$/, "O código deve ter 6 dígitos.");

const BACKUP_CODES_COUNT = 8;

/** Gera códigos de backup legíveis (ex.: AB12-CD34) e devolve plaintext + hashes. */
function generateBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: BACKUP_CODES_COUNT }, () => {
    const part = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${part.slice(0, 4)}-${part.slice(4)}`;
  });
  return { plain, hashes: plain.map(hashText) };
}

export function hashBackupCode(code: string): string {
  return hashText(code.trim().toUpperCase());
}

export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}

/** Passo 1: gera (ou substitui) um segredo pendente e devolve QR + segredo para configuração. */
export async function startMfaSetup(userId: string, email: string): Promise<Result<{ qrDataUrl: string; secret: string }>> {
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: encryptText(secret), mfaEnabled: false, mfaBackupCodes: null },
  });
  const uri = generateURI({ issuer: "CyberPME", label: email, secret });
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
  return ok({ qrDataUrl, secret });
}

/** Passo 2: valida o primeiro código TOTP e ativa o MFA, gerando códigos de backup. */
export async function confirmMfaEnable(
  actorId: string,
  organizationId: string | undefined,
  code: unknown,
): Promise<Result<{ backupCodes: string[] }>> {
  const parsed = totpCodeSchema.safeParse(code);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Código inválido.");

  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { mfaSecret: true } });
  if (!user?.mfaSecret) return err("CONFLICT", "Inicie primeiro a configuração do MFA.");

  const secret = decryptText(user.mfaSecret);
  if (!(await verifyTotpCode(secret, parsed.data))) {
    return err("VALIDATION", "Código incorreto. Verifique a aplicação autenticadora e tente novamente.");
  }

  const { plain, hashes } = generateBackupCodes();
  await prisma.user.update({
    where: { id: actorId },
    data: { mfaEnabled: true, mfaBackupCodes: JSON.stringify(hashes) },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "STATUS_CHANGE",
    resource: "user_mfa",
    resourceId: actorId,
    metadata: { mfaEnabled: true },
  });
  return ok({ backupCodes: plain });
}

/** Desativa o MFA: exige password atual + código TOTP válido. */
export async function disableMfa(
  actorId: string,
  organizationId: string | undefined,
  input: { passwordHashOk: boolean; code: unknown },
): Promise<Result> {
  if (!input.passwordHashOk) return err("FORBIDDEN", "A palavra-passe atual está incorreta.");
  const parsed = totpCodeSchema.safeParse(input.code);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Código inválido.");

  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user?.mfaEnabled || !user.mfaSecret) return err("CONFLICT", "O MFA não está ativo nesta conta.");

  if (!(await verifyTotpCode(decryptText(user.mfaSecret), parsed.data))) {
    return err("VALIDATION", "Código incorreto.");
  }

  await prisma.user.update({
    where: { id: actorId },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "STATUS_CHANGE",
    resource: "user_mfa",
    resourceId: actorId,
    metadata: { mfaEnabled: false },
  });
  return ok(undefined);
}

/** Gera novos códigos de backup (invalida os anteriores). Exige MFA ativo. */
export async function regenerateBackupCodes(
  actorId: string,
  organizationId: string | undefined,
  code: unknown,
): Promise<Result<{ backupCodes: string[] }>> {
  const parsed = totpCodeSchema.safeParse(code);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Código inválido.");

  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user?.mfaEnabled || !user.mfaSecret) return err("CONFLICT", "O MFA não está ativo nesta conta.");
  if (!(await verifyTotpCode(decryptText(user.mfaSecret), parsed.data))) {
    return err("VALIDATION", "Código incorreto.");
  }

  const { plain, hashes } = generateBackupCodes();
  await prisma.user.update({
    where: { id: actorId },
    data: { mfaBackupCodes: JSON.stringify(hashes) },
  });
  await writeAuditLog({
    actorId,
    organizationId,
    action: "UPDATE",
    resource: "user_mfa_backup_codes",
    resourceId: actorId,
  });
  return ok({ backupCodes: plain });
}

/** Conta de códigos de backup restantes (guardados como hashes). */
export async function countBackupCodes(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfaBackupCodes: true } });
  if (!user?.mfaBackupCodes) return 0;
  try {
    const hashes = JSON.parse(user.mfaBackupCodes) as string[];
    return Array.isArray(hashes) ? hashes.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Verifica um código TOTP ou um código de backup no login.
 * Códigos de backup são de uso único (consumidos com sucesso).
 */
export async function verifyLoginMfa(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
  });
  if (!user?.mfaEnabled || !user.mfaSecret) return false;

  const normalized = code.trim();
  if (/^\d{6}$/.test(normalized)) {
    return verifyTotpCode(decryptText(user.mfaSecret), normalized);
  }

  // Código de backup (uso único).
  if (!user.mfaBackupCodes) return false;
  let hashes: string[];
  try {
    hashes = JSON.parse(user.mfaBackupCodes) as string[];
  } catch {
    return false;
  }
  const candidate = hashBackupCode(normalized);
  if (!hashes.includes(candidate)) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: JSON.stringify(hashes.filter((hash) => hash !== candidate)) },
  });
  return true;
}
