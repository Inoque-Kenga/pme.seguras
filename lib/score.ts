import type {
  BackupStatus,
  Criticality,
  IncidentSeverity,
  IncidentStatus,
  RiskStatus,
} from "@prisma/client";

export type ScoreFactor = {
  key: string;
  label: string;
  weight: number;
  deduction: number;
  detail: string;
};

export type ScoreResult = {
  score: number;
  level: "Bom" | "Razoável" | "Fraco" | "Crítico";
  factors: ScoreFactor[];
};

type ScoreInput = {
  risks: { probability: number; impact: number; status: RiskStatus }[];
  incidents: { severity: IncidentSeverity; status: IncidentStatus }[];
  tasks: { status: string; dueDate: Date | null }[];
  backups: { status: BackupStatus; lastRunAt: Date | null }[];
  phishingCampaigns: { sentCount: number; clickedCount: number }[];
  assets: { criticality: Criticality }[];
};

const OPEN_RISK_STATUSES: RiskStatus[] = ["ABERTO", "EM_TRATAMENTO"];
const OPEN_INCIDENT_STATUSES: IncidentStatus[] = ["DETECTED", "INVESTIGATING", "CONTAINED"];
const INCIDENT_POINTS: Record<IncidentSeverity, number> = {
  LOW: 2,
  MEDIUM: 5,
  HIGH: 9,
  CRITICAL: 14,
};

const BACKUP_OVERDUE_DAYS = 7;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Cálculo puro e explicável do score de segurança (0-100).
 * Começa em 100 e aplica deduções por fator, limitadas ao peso de cada fator.
 */
export function computeSecurityScore(input: ScoreInput, now = new Date()): ScoreResult {
  const factors: ScoreFactor[] = [];

  const openRisks = input.risks.filter((risk) => OPEN_RISK_STATUSES.includes(risk.status));
  const riskPoints = openRisks.reduce((total, risk) => total + risk.probability * risk.impact, 0);
  const riskDeduction = clamp(Math.round(riskPoints / 4), 0, 25);
  factors.push({
    key: "risks",
    label: "Riscos em aberto",
    weight: 25,
    deduction: riskDeduction,
    detail: `${openRisks.length} risco(s) por tratar`,
  });

  const openIncidents = input.incidents.filter((incident) => OPEN_INCIDENT_STATUSES.includes(incident.status));
  const incidentPoints = openIncidents.reduce((total, incident) => total + INCIDENT_POINTS[incident.severity], 0);
  const incidentDeduction = clamp(incidentPoints, 0, 25);
  factors.push({
    key: "incidents",
    label: "Incidentes ativos",
    weight: 25,
    deduction: incidentDeduction,
    detail: `${openIncidents.length} incidente(s) ativo(s)`,
  });

  const overdueTasks = input.tasks.filter(
    (task) => task.status !== "CONCLUIDA" && task.status !== "CANCELADA" && task.dueDate && task.dueDate < now,
  );
  const taskDeduction = clamp(overdueTasks.length * 3, 0, 15);
  factors.push({
    key: "tasks",
    label: "Tarefas em atraso",
    weight: 15,
    deduction: taskDeduction,
    detail: `${overdueTasks.length} tarefa(s) em atraso`,
  });

  const problematicBackups = input.backups.filter((backup) => {
    if (backup.status === "FAILED" || backup.status === "OVERDUE") return true;
    if (!backup.lastRunAt) return true;
    const ageDays = (now.getTime() - backup.lastRunAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > BACKUP_OVERDUE_DAYS;
  });
  const backupDeduction = clamp(problematicBackups.length * 5, 0, 15);
  factors.push({
    key: "backups",
    label: "Cópias de segurança",
    weight: 15,
    deduction: backupDeduction,
    detail: `${problematicBackups.length} backup(s) falhados ou desatualizados`,
  });

  const sent = input.phishingCampaigns.reduce((total, campaign) => total + campaign.sentCount, 0);
  const clicked = input.phishingCampaigns.reduce((total, campaign) => total + campaign.clickedCount, 0);
  const clickRate = sent > 0 ? clicked / sent : 0;
  const phishingDeduction = clamp(Math.round(clickRate * 40), 0, 20);
  factors.push({
    key: "phishing",
    label: "Simulações de phishing",
    weight: 20,
    deduction: phishingDeduction,
    detail: sent > 0 ? `${Math.round(clickRate * 100)}% de cliques em ${sent} enviados` : "Sem campanhas registadas",
  });

  const totalDeduction = factors.reduce((total, factor) => total + factor.deduction, 0);
  const score = clamp(100 - totalDeduction, 0, 100);
  const level = score >= 80 ? "Bom" : score >= 60 ? "Razoável" : score >= 40 ? "Fraco" : "Crítico";

  return { score, level, factors };
}
