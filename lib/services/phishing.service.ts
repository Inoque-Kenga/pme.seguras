import { z } from "zod";
import { PhishingCampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import type { OrganizationContext } from "@/lib/current-organization";
import { fail, ok, requireEditor, sameOrganization, type ServiceResult } from "@/lib/services/common";

const createCampaignSchema = z.object({
  name: z.string().trim().min(3, "Indique o nome da campanha.").max(160),
  targetCount: z.coerce.number().int().min(0).max(10000),
});

export async function listCampaigns(organizationId: string) {
  return prisma.phishingCampaign.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Regista uma campanha de simulação de phishing. Nesta fase não há envio real
 * de e-mails; os contadores são atualizados manualmente ou por integrações futuras.
 */
export async function createCampaign(ctx: OrganizationContext, actorId: string, input: unknown): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const campaign = await prisma.phishingCampaign.create({
    data: {
      organizationId: ctx.organization.id,
      name: parsed.data.name,
      targetCount: parsed.data.targetCount,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "phishing_campaign",
    resourceId: campaign.id,
  });
  return ok;
}

export async function setCampaignStatus(
  ctx: OrganizationContext,
  actorId: string,
  campaignId: string,
  status: PhishingCampaignStatus,
): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const campaign = await prisma.phishingCampaign.findUnique({
    where: { id: campaignId },
    select: { organizationId: true },
  });
  if (!campaign) return fail("Campanha não encontrada.");
  const wrongOrg = sameOrganization(campaign.organizationId, ctx);
  if (wrongOrg) return wrongOrg;

  await prisma.phishingCampaign.update({
    where: { id: campaignId },
    data: { status, launchedAt: status === "RUNNING" ? new Date() : undefined },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "phishing_campaign",
    resourceId: campaignId,
    metadata: { status },
  });
  return ok;
}

/** Atualiza os contadores simulados de uma campanha (enviados, cliques, reportes). */
export async function updateCampaignCounters(
  ctx: OrganizationContext,
  actorId: string,
  campaignId: string,
  input: unknown,
): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const schema = z.object({
    sentCount: z.coerce.number().int().min(0).max(10000),
    clickedCount: z.coerce.number().int().min(0).max(10000),
    reportedCount: z.coerce.number().int().min(0).max(10000),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Contadores inválidos.");
  if (parsed.data.clickedCount > parsed.data.sentCount) return fail("Cliques não podem exceder os enviados.");

  const campaign = await prisma.phishingCampaign.findUnique({
    where: { id: campaignId },
    select: { organizationId: true },
  });
  if (!campaign) return fail("Campanha não encontrada.");
  const wrongOrg = sameOrganization(campaign.organizationId, ctx);
  if (wrongOrg) return wrongOrg;

  await prisma.phishingCampaign.update({ where: { id: campaignId }, data: parsed.data });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "phishing_campaign",
    resourceId: campaignId,
  });
  return ok;
}
