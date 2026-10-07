import { redirect } from "next/navigation";
import { isGlobalAdmin, requireSession, resolveOrganization } from "@/lib/current-organization";
import type { ServiceResult } from "@/lib/services/common";
import type { Result } from "@/lib/services/errors";

export { requireSession, isGlobalAdmin };

/**
 * Contexto para server actions: valida a sessão e resolve a organização
 * a partir das associações da sessão (o id enviado pelo browser é só uma pista).
 */
export async function getActionContext(formData: FormData) {
  const session = await requireSession();
  const requestedId = String(formData.get("org") ?? "");
  const ctx = await resolveOrganization(session, requestedId || undefined);
  if (!ctx) redirect("/dashboard?error=Sem+organiza%C3%A7%C3%A3o+associada.");
  return { session, ctx };
}

export function backWithMessage(path: string, orgId: string, result: ServiceResult, successMessage: string): never {
  const params = new URLSearchParams({ org: orgId });
  if (result.ok) params.set("success", successMessage);
  else params.set("error", result.error);
  redirect(`${path}?${params.toString()}`);
}

/** Variante para Result tipado (lib/services/errors.ts). */
export function redirectWithResult(path: string, result: Result<unknown>, successMessage: string): never {
  const params = new URLSearchParams();
  if (result.ok) params.set("success", successMessage);
  else params.set("error", result.error.message);
  redirect(`${path}${path.includes("?") ? "&" : "?"}${params.toString()}`);
}

/** Garante sessão de SUPER_ADMIN; redireciona para o dashboard caso contrário. */
export async function requireSuperAdminSession() {
  const session = await requireSession();
  if (!isGlobalAdmin(session)) redirect("/dashboard?error=Acesso+reservado+ao+super+administrador.");
  return session;
}
