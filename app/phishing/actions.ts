"use server";

import { z } from "zod";
import { PhishingCampaignStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { backWithMessage, getActionContext } from "@/lib/action-context";
import { createCampaign, setCampaignStatus, updateCampaignCounters } from "@/lib/services/phishing.service";
import { fail } from "@/lib/services/common";

export async function createCampaignAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const result = await createCampaign(ctx, session.user.id, {
    name: formData.get("name"),
    targetCount: formData.get("targetCount"),
  });
  revalidatePath("/phishing");
  backWithMessage("/phishing", ctx.organization.id, result, "Campanha criada com sucesso.");
}

export async function setCampaignStatusAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const status = z.nativeEnum(PhishingCampaignStatus).safeParse(formData.get("status"));
  const result = status.success
    ? await setCampaignStatus(ctx, session.user.id, String(formData.get("id")), status.data)
    : fail("Estado inválido.");
  revalidatePath("/phishing");
  backWithMessage("/phishing", ctx.organization.id, result, "Estado da campanha atualizado.");
}

export async function updateCampaignCountersAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const result = await updateCampaignCounters(ctx, session.user.id, String(formData.get("id")), {
    sentCount: formData.get("sentCount"),
    clickedCount: formData.get("clickedCount"),
    reportedCount: formData.get("reportedCount"),
  });
  revalidatePath("/phishing");
  backWithMessage("/phishing", ctx.organization.id, result, "Contadores atualizados.");
}
