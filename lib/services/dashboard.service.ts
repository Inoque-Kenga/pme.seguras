import { Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { backupSemaphore, type Semaphore } from "@/lib/services/backup.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type OrgDashboardData = {
  topRisks: {
    id: string;
    title: string;
    level: number;
    riskLevel: string;
    status: string;
    owner: string | null;
  }[];
  backups: {
    id: string;
    sistemaAtivo: string;
    estado: string;
    ultimaExecucao: Date | null;
    semaphore: Semaphore;
  }[];
  ticketsByPriority: { priority: Priority; count: number }[];
  recentIncidents: {
    id: string;
    title: string;
    severity: string;
    status: string;
    detectedAt: Date;
  }[];
};

/** Dados dos widgets do dashboard da organização (sempre filtrados por organizationId). */
export async function getOrgDashboardData(organizationId: string, now = new Date()): Promise<OrgDashboardData> {
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [risks, backupJobs, ticketGroups, incidents] = await Promise.all([
    prisma.risk.findMany({
      where: { organizationId, riskLevel: { in: ["CRITICO", "ALTO"] }, status: { in: ["ABERTO", "EM_TRATAMENTO"] } },
      include: { owner: { select: { name: true } } },
      orderBy: [{ level: "desc" }],
      take: 8,
    }),
    prisma.backupJob.findMany({
      where: { organizationId },
      orderBy: [{ estado: "desc" }, { sistemaAtivo: "asc" }],
      take: 6,
    }),
    prisma.ticket.groupBy({
      by: ["priority"],
      where: { organizationId, status: { in: ["ABERTO", "EM_ANALISE", "EM_ANDAMENTO", "AGUARDA_CLIENTE"] } },
      _count: { _all: true },
    }),
    prisma.incident.findMany({
      where: { organizationId, detectedAt: { gte: thirtyDaysAgo } },
      orderBy: { detectedAt: "desc" },
      take: 5,
    }),
  ]);

  const priorityOrder: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

  return {
    topRisks: risks.map((risk) => ({
      id: risk.id,
      title: risk.title,
      level: risk.level,
      riskLevel: risk.riskLevel,
      status: risk.status,
      owner: risk.owner?.name ?? null,
    })),
    backups: backupJobs.map((job) => ({
      id: job.id,
      sistemaAtivo: job.sistemaAtivo,
      estado: job.estado,
      ultimaExecucao: job.ultimaExecucao,
      semaphore: backupSemaphore(job, now),
    })),
    ticketsByPriority: priorityOrder.map((priority) => ({
      priority,
      count: ticketGroups.find((group) => group.priority === priority)?._count._all ?? 0,
    })),
    recentIncidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      detectedAt: incident.detectedAt,
    })),
  };
}
