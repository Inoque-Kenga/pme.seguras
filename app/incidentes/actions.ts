"use server";

import { z } from "zod";
import { IncidentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { backWithMessage, getActionContext } from "@/lib/action-context";
import { createIncident, setIncidentStatus } from "@/lib/services/incidents.service";
import { fail } from "@/lib/services/common";

export async function createIncidentAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const result = await createIncident(ctx, session.user.id, {
    title: formData.get("title"),
    description: formData.get("description"),
    severity: formData.get("severity"),
  });
  revalidatePath("/incidentes");
  backWithMessage("/incidentes", ctx.organization.id, result, "Incidente registado com sucesso.");
}

export async function setIncidentStatusAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const status = z.nativeEnum(IncidentStatus).safeParse(formData.get("status"));
  const result = status.success
    ? await setIncidentStatus(ctx, session.user.id, String(formData.get("id")), status.data)
    : fail("Estado inválido.");
  revalidatePath("/incidentes");
  backWithMessage("/incidentes", ctx.organization.id, result, "Estado do incidente atualizado.");
}
