import { prisma } from "@/lib/prisma";
import { computeSecurityScore, type ScoreResult } from "@/lib/score";

export type DashboardData = {
  score: ScoreResult;
  counts: {
    assets: number;
    risks: number;
    openTasks: number;
    openTickets: number;
    openIncidents: number;
    campaigns: number;
  };
  assetsByCriticality: { criticality: string; count: number }[];
};

/** Recolhe os dados da organização e calcula o score de segurança atual. */
export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  const [assets, risks, incidents, tasks, backups, campaigns, openTickets] = await Promise.all([
    prisma.asset.findMany({ where: { organizationId }, select: { criticality: true } }),
    prisma.risk.findMany({ where: { organizationId }, select: { probability: true, impact: true, status: true } }),
    prisma.incident.findMany({ where: { organizationId }, select: { severity: true, status: true } }),
    prisma.riskTreatmentTask.findMany({ where: { organizationId }, select: { status: true, dueDate: true } }),
    prisma.backupRecord.findMany({ where: { organizationId }, select: { status: true, lastRunAt: true } }),
    prisma.phishingCampaign.findMany({ where: { organizationId }, select: { sentCount: true, clickedCount: true } }),
    prisma.ticket.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] } } }),
  ]);

  const score = computeSecurityScore({ risks, incidents, tasks, backups, phishingCampaigns: campaigns, assets });

  const criticalityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const assetsByCriticality = criticalityOrder
    .map((criticality) => ({
      criticality,
      count: assets.filter((asset) => asset.criticality === criticality).length,
    }))
    .filter((entry) => entry.count > 0);

  return {
    score,
    counts: {
      assets: assets.length,
      risks: risks.length,
      openTasks: tasks.filter((task) => task.status === "NAO_INICIADA" || task.status === "EM_ANDAMENTO").length,
      openTickets,
      openIncidents: incidents.filter((incident) =>
        ["DETECTED", "INVESTIGATING", "CONTAINED"].includes(incident.status),
      ).length,
      campaigns: campaigns.length,
    },
    assetsByCriticality,
  };
}
