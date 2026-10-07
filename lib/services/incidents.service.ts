import { z } from "zod";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import type { OrganizationContext } from "@/lib/current-organization";
import { fail, ok, requireEditor, sameOrganization, type ServiceResult } from "@/lib/services/common";

const createIncidentSchema = z.object({
  title: z.string().trim().min(3, "Indique o título do incidente.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  severity: z.nativeEnum(IncidentSeverity),
});

export async function listIncidents(organizationId: string) {
  return prisma.incident.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { detectedAt: "desc" }],
  });
}

export async function createIncident(ctx: OrganizationContext, actorId: string, input: unknown): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const parsed = createIncidentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const incident = await prisma.incident.create({
    data: {
      organizationId: ctx.organization.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      severity: parsed.data.severity,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "incident",
    resourceId: incident.id,
  });
  return ok;
}

export async function setIncidentStatus(
  ctx: OrganizationContext,
  actorId: string,
  incidentId: string,
  status: IncidentStatus,
): Promise<ServiceResult> {
  const denied = requireEditor(ctx);
  if (denied) return denied;

  const incident = await prisma.incident.findUnique({ where: { id: incidentId }, select: { organizationId: true } });
  if (!incident) return fail("Incidente não encontrado.");
  const wrongOrg = sameOrganization(incident.organizationId, ctx);
  if (wrongOrg) return wrongOrg;

  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      status,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "incident",
    resourceId: incidentId,
    metadata: { status },
  });
  return ok;
}
