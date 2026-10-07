"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { backWithMessage, getActionContext } from "@/lib/action-context";
import { createBackup, registerBackupRun } from "@/lib/services/backups.service";
import { fail } from "@/lib/services/common";

export async function createBackupAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const result = await createBackup(ctx, session.user.id, {
    resource: formData.get("resource"),
    frequency: formData.get("frequency"),
    notes: formData.get("notes"),
  });
  revalidatePath("/backups");
  backWithMessage("/backups", ctx.organization.id, result, "Recurso de backup registado.");
}

export async function registerBackupRunAction(formData: FormData) {
  const { session, ctx } = await getActionContext(formData);
  const status = z.enum(["SUCCESS", "FAILED"]).safeParse(formData.get("status"));
  const result = status.success
    ? await registerBackupRun(ctx, session.user.id, String(formData.get("id")), status.data)
    : fail("Estado inválido.");
  revalidatePath("/backups");
  backWithMessage("/backups", ctx.organization.id, result, "Execução de backup registada.");
}
