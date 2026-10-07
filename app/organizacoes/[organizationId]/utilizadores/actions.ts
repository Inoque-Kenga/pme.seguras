"use server";

import { revalidatePath } from "next/cache";
import { redirectWithResult, requireSession } from "@/lib/action-context";
import { resolveOrganization } from "@/lib/current-organization";
import { err } from "@/lib/services/errors";
import {
  canManageMembers,
  changeMemberRole,
  inviteMember,
  removeMember,
  setMemberStatus,
} from "@/lib/services/membership.service";

async function getMembershipContext(organizationId: string) {
  const session = await requireSession();
  const ctx = await resolveOrganization(session, organizationId);
  const actorRoles: string[] = Array.from(
    new Set([...session.user.memberships.map((membership) => membership.role), ...(ctx ? [ctx.role] : [])]),
  );
  return { session, ctx, actorRoles };
}

const basePath = (organizationId: string) => `/organizacoes/${organizationId}/utilizadores`;

export async function inviteMemberAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const { session, ctx, actorRoles } = await getMembershipContext(organizationId);
  if (!ctx || !actorRoles) redirectWithResult(basePath(organizationId), err("NOT_FOUND", "Organização não encontrada."), "");
  if (!canManageMembers(actorRoles)) {
    redirectWithResult(basePath(organizationId), err("FORBIDDEN", "O seu papel não permite gerir membros."), "");
  }
  const result = await inviteMember(session.user.id, actorRoles, ctx.organization.id, {
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  revalidatePath(basePath(organizationId));
  redirectWithResult(basePath(organizationId), result, "Convite registado com sucesso.");
}

export async function changeMemberRoleAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const { session, ctx, actorRoles } = await getMembershipContext(organizationId);
  if (!ctx || !actorRoles || !canManageMembers(actorRoles)) {
    redirectWithResult(basePath(organizationId), err("FORBIDDEN", "O seu papel não permite gerir membros."), "");
  }
  const result = await changeMemberRole(
    session.user.id,
    actorRoles,
    ctx.organization.id,
    String(formData.get("userId")),
    formData.get("role"),
  );
  revalidatePath(basePath(organizationId));
  redirectWithResult(basePath(organizationId), result, "Papel atualizado com sucesso.");
}

export async function setMemberStatusAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const { session, ctx, actorRoles } = await getMembershipContext(organizationId);
  if (!ctx || !actorRoles || !canManageMembers(actorRoles)) {
    redirectWithResult(basePath(organizationId), err("FORBIDDEN", "O seu papel não permite gerir membros."), "");
  }
  const result = await setMemberStatus(
    session.user.id,
    ctx.organization.id,
    String(formData.get("userId")),
    formData.get("status"),
  );
  revalidatePath(basePath(organizationId));
  redirectWithResult(basePath(organizationId), result, "Estado do membro atualizado.");
}

export async function removeMemberAction(formData: FormData) {
  const organizationId = String(formData.get("org") ?? "");
  const { session, ctx, actorRoles } = await getMembershipContext(organizationId);
  if (!ctx || !actorRoles || !canManageMembers(actorRoles)) {
    redirectWithResult(basePath(organizationId), err("FORBIDDEN", "O seu papel não permite gerir membros."), "");
  }
  const result = await removeMember(session.user.id, ctx.organization.id, String(formData.get("userId")));
  revalidatePath(basePath(organizationId));
  redirectWithResult(basePath(organizationId), result, "Acesso removido com sucesso.");
}
