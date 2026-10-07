import { z } from "zod";
import { BackupStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import type { OrganizationContext } from "@/lib/current-organization";
import { fail, ok, requireEditor, sameOrganization, type ServiceResult } from "@/lib/services/common";

const createBackupSchema = z.object({
  resource: z.string().trim().min(2, "Indique o recurso protegido.").max(160),
  frequency: z.string().trim().min(2, "Indique a frequência (ex.: diário).").max(60),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function listBackups(organizationId: string) {
  return prisma.backupRecord.findMany({
    where: { organizationId },
    orderBy: [{ status: "desc" }, { resource: "asc" }],
  });
}

export async function createBackup(ctx: OrganizationContext, actorId: string, input: unknown): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const parsed = createBackupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const backup = await prisma.backupRecord.create({
    data: {
      organizationId: ctx.organization.id,
      resource: parsed.data.resource,
      frequency: parsed.data.frequency,
      notes: parsed.data.notes || null,
      status: "RUNNING",
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "backup",
    resourceId: backup.id,
  });
  return ok;
}

/** Regista o resultado de uma execução de backup (sucesso/falha). */
export async function registerBackupRun(
  ctx: OrganizationContext,
  actorId: string,
  backupId: string,
  status: Extract<BackupStatus, "SUCCESS" | "FAILED">,
): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const backup = await prisma.backupRecord.findUnique({ where: { id: backupId }, select: { organizationId: true, frequency: true } });
  if (!backup) return fail("Registo de backup não encontrado.");
  const wrongOrg = sameOrganization(backup.organizationId, ctx);
  if (wrongOrg) return wrongOrg;

  const now = new Date();
  const nextRunAt = new Date(now);
  nextRunAt.setDate(nextRunAt.getDate() + (/seman/i.test(backup.frequency) ? 7 : 1));

  await prisma.backupRecord.update({
    where: { id: backupId },
    data: { status, lastRunAt: now, nextRunAt },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "backup",
    resourceId: backupId,
    metadata: { status },
  });
  return ok;
}
