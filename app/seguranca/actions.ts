"use server";

import { requireSession } from "@/lib/action-context";
import { revalidatePath } from "next/cache";
import type { Result } from "@/lib/services/errors";
import { err } from "@/lib/services/errors";
import {
  confirmMfaEnable,
  disableMfa,
  regenerateBackupCodes,
  startMfaSetup,
} from "@/lib/services/mfa.service";
import {
  changePassword,
  revokeOtherSessions,
  revokeOwnSession,
  verifyCurrentPassword,
} from "@/lib/services/session.service";

function firstOrgId(session: Awaited<ReturnType<typeof requireSession>>) {
  return session.user.memberships[0]?.organizationId as string | undefined;
}

export async function startMfaAction(): Promise<Result<{ qrDataUrl: string; secret: string }>> {
  const session = await requireSession();
  return startMfaSetup(session.user.id, session.user.email ?? "utilizador@cyberpme.local");
}

export async function confirmMfaAction(code: string): Promise<Result<{ backupCodes: string[] }>> {
  const session = await requireSession();
  const result = await confirmMfaEnable(session.user.id, firstOrgId(session), code);
  if (result.ok) revalidatePath("/seguranca");
  return result;
}

export async function disableMfaAction(password: string, code: string): Promise<Result> {
  const session = await requireSession();
  const passwordHashOk = await verifyCurrentPassword(session.user.id, password);
  const result = await disableMfa(session.user.id, firstOrgId(session), { passwordHashOk, code });
  if (result.ok) revalidatePath("/seguranca");
  return result;
}

export async function regenerateCodesAction(code: string): Promise<Result<{ backupCodes: string[] }>> {
  const session = await requireSession();
  const result = await regenerateBackupCodes(session.user.id, firstOrgId(session), code);
  return result;
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<Result> {
  const session = await requireSession();
  const result = await changePassword(session.user.id, firstOrgId(session), input, session.user.sessionId);
  if (result.ok) revalidatePath("/seguranca");
  return result;
}

export async function revokeSessionAction(sessionId: string): Promise<Result> {
  const session = await requireSession();
  if (!sessionId) return err("VALIDATION", "Sessão inválida.");
  const result = await revokeOwnSession(session.user.id, firstOrgId(session), sessionId);
  if (result.ok) revalidatePath("/seguranca");
  return result;
}

export async function revokeOtherSessionsAction(): Promise<Result> {
  const session = await requireSession();
  const result = await revokeOtherSessions(session.user.id, firstOrgId(session), session.user.sessionId);
  if (result.ok) revalidatePath("/seguranca");
  return result;
}
