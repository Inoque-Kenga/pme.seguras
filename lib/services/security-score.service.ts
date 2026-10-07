import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { computeSecurityScore, type SecurityScoreInput, type SecurityScoreResult } from "@/lib/security-score";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Recolhe os dados reais da organização para o cálculo. Campos sem dados → null. */
async function collectScoreInput(organizationId: string, now = new Date()): Promise<SecurityScoreInput> {
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [
    endpointTotal,
    endpointProtected,
    updateTotal,
    updatedRecently,
    assetTotal,
    assetComplete,
    backupJobs,
    campaigns,
    incidentsHandled,
  ] = await Promise.all([
    prisma.asset.count({ where: { organizationId, archivedAt: null, type: "HARDWARE" } }),
    prisma.asset.count({ where: { organizationId, archivedAt: null, type: "HARDWARE", protecaoEndpoint: true } }),
    prisma.asset.count({ where: { organizationId, archivedAt: null } }),
    prisma.asset.count({ where: { organizationId, archivedAt: null, ultimaAtualizacao: { gte: thirtyDaysAgo } } }),
    prisma.asset.count({ where: { organizationId, archivedAt: null } }),
    prisma.asset.count({ where: { organizationId, archivedAt: null, owner: { not: null }, location: { not: null } } }),
    prisma.backupJob.findMany({
      where: { organizationId },
      select: { estado: true, ultimaExecucao: true },
    }),
    prisma.phishingCampaign.findMany({
      where: { organizationId },
      select: { sentCount: true, clickedCount: true },
    }),
    prisma.incident.count({ where: { organizationId, status: { in: ["RECUPERADO", "ENCERRADO"] } } }),
  ]);

  const jobsWithSuccess = backupJobs.filter(
    (job) => job.estado === "SUCESSO" && job.ultimaExecucao && job.ultimaExecucao >= thirtyDaysAgo,
  ).length;
  const jobsWithFailure = backupJobs.filter(
    (job) => job.estado === "FALHA" && job.ultimaExecucao && job.ultimaExecucao >= thirtyDaysAgo,
  ).length;

  const sent = campaigns.reduce((total, campaign) => total + campaign.sentCount, 0);
  const clicked = campaigns.reduce((total, campaign) => total + campaign.clickedCount, 0);

  return {
    mfaAdminPercent: null, // sem campo de MFA por conta — pontuação conservadora
    endpoints: { total: endpointTotal, protected: endpointProtected },
    backups: { jobs: backupJobs.length, successLast30d: jobsWithSuccess, failuresLast30d: jobsWithFailure },
    updates: { total: updateTotal, updatedLast30d: updatedRecently },
    networkSegmented: null, // sem dados de rede — pontuação conservadora
    assets: { total: assetTotal, complete: assetComplete },
    phishing: campaigns.length === 0 ? null : { sent, clicked },
    incidentsHandled,
    hasIncidentPolicy: null, // módulo de políticas futuro — pontuação conservadora
  };
}

/** Calcula o score atual da organização (sem persistir). */
export async function computeOrganizationScore(organizationId: string): Promise<SecurityScoreResult> {
  const input = await collectScoreInput(organizationId);
  return computeSecurityScore(input);
}

/**
 * Calcula o score e guarda um snapshot se o último tiver mais de 24h.
 * A criação de snapshots é registada em auditoria.
 */
export async function computeAndStoreSnapshot(
  organizationId: string,
  actorId: string,
): Promise<SecurityScoreResult> {
  const input = await collectScoreInput(organizationId);
  const result = computeSecurityScore(input);

  const latest = await prisma.securityScoreSnapshot.findFirst({
    where: { organizationId },
    orderBy: { dataReferencia: "desc" },
    select: { dataReferencia: true },
  });
  const isStale = !latest || Date.now() - latest.dataReferencia.getTime() > SNAPSHOT_INTERVAL_MS;

  if (isStale) {
    const snapshot = await prisma.securityScoreSnapshot.create({
      data: {
        organizationId,
        score: result.total,
        categoria: result.categoria,
        detalhesJson: {
          categories: result.categories,
          recommendations: result.recommendations,
          incompleteCount: result.incompleteCount,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      actorId,
      organizationId,
      action: "CREATE",
      resource: "security_score_snapshot",
      resourceId: snapshot.id,
      metadata: { score: result.total, categoria: result.categoria },
    });
  }

  return result;
}

/** Evolução do score nos últimos N meses (a partir dos snapshots guardados). */
export async function getScoreHistory(organizationId: string, months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return prisma.securityScoreSnapshot.findMany({
    where: { organizationId, dataReferencia: { gte: since } },
    select: { score: true, categoria: true, dataReferencia: true },
    orderBy: { dataReferencia: "asc" },
  });
}

/** Snapshot mais próximo de há ~30 dias (para variação mensal). */
export async function getPreviousMonthScore(organizationId: string) {
  const reference = new Date(Date.now() - THIRTY_DAYS_MS);
  return prisma.securityScoreSnapshot.findFirst({
    where: { organizationId, dataReferencia: { lte: reference } },
    orderBy: { dataReferencia: "desc" },
    select: { score: true, dataReferencia: true },
  });
}

export type GlobalScoreParams = {
  sector?: string;
  dimensao?: string;
  categoria?: string;
};

/** Lista de organizações com o score atual (dashboard global de admins). */
export async function listOrganizationsWithScores(params: GlobalScoreParams = {}) {
  const where: Prisma.OrganizationWhereInput = { status: "ACTIVE" };
  if (params.sector) where.sector = { equals: params.sector, mode: "insensitive" };
  if (params.dimensao) where.dimensao = params.dimensao as never;

  const organizations = await prisma.organization.findMany({
    where,
    select: { id: true, name: true, sector: true, dimensao: true },
    orderBy: { name: "asc" },
  });

  const withScores = await Promise.all(
    organizations.map(async (organization) => {
      const result = await computeOrganizationScore(organization.id);
      return { ...organization, score: result.total, categoria: result.categoria };
    }),
  );

  const filtered = params.categoria
    ? withScores.filter((organization) => organization.categoria === params.categoria)
    : withScores;

  return filtered.sort((a, b) => a.score - b.score);
}

/** Agregados globais: organizações por categoria, riscos críticos abertos, incidentes críticos no último mês. */
export async function getGlobalAggregates(now = new Date()) {
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);
  const [criticalRisks, criticalIncidents] = await Promise.all([
    prisma.risk.count({ where: { riskLevel: "CRITICO", status: { in: ["ABERTO", "EM_TRATAMENTO"] } } }),
    prisma.incident.count({ where: { severity: "CRITICAL", detectedAt: { gte: thirtyDaysAgo } } }),
  ]);
  return { criticalRisks, criticalIncidents };
}
