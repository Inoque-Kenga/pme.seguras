import type { Role } from "@prisma/client";
import type { OrganizationContext } from "@/lib/current-organization";

export const EDITOR_ROLES: Role[] = ["SUPER_ADMIN", "ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export type ServiceResult = { ok: true } | { ok: false; error: string };

export const ok: ServiceResult = { ok: true };
export function fail(error: string): ServiceResult {
  return { ok: false, error };
}

export function canEdit(role: string) {
  return (EDITOR_ROLES as string[]).includes(role);
}

/** Garante que o papel do utilizador na organização pode criar/editar. */
export function requireEditor(ctx: OrganizationContext): ServiceResult | null {
  if (!canEdit(ctx.role)) return fail("Não tem permissão para alterar dados nesta organização.");
  return null;
}

/** Garante que o registo pertence à organização do contexto (anti-IDOR). */
export function sameOrganization(recordOrganizationId: string, ctx: OrganizationContext): ServiceResult | null {
  if (recordOrganizationId !== ctx.organization.id) return fail("Registo não encontrado nesta organização.");
  return null;
}
