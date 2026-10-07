import type { ScoreCategory } from "@prisma/client";

export type ReportRisksInput = {
  level: number;
  riskLevel: string;
  title: string;
  status: string;
  owner: string | null;
  dueDate: Date | null;
}[];

export type ReportBackupsInput = {
  total: number;
  sucesso: number;
  falha: number;
  aviso: number;
  desconhecido: number;
  semTesteRecente: number;
};

export type ReportTicketsInput = {
  abertos: number;
  vencidos: number;
  resolvidosNoMes: number;
  porPrioridade: { priority: string; count: number }[];
};

export type ReportIncidentsInput = {
  totalNoMes: number;
  criticos: number;
  porTipo: { type: string; count: number }[];
  encerrados: number;
};

export type ReportTrainingPoliciesInput = {
  validPercent: number | null;
  validUsers: number;
  totalMembers: number;
  keyPolicies: number;
};

export type ReportContentInput = {
  organizationName: string;
  mesReferencia: Date;
  scoreGlobal: number;
  categoria: ScoreCategory;
  scoreVariation: number | null;
  risks: ReportRisksInput;
  backups: ReportBackupsInput;
  tickets: ReportTicketsInput;
  incidents: ReportIncidentsInput;
  trainingPolicies: ReportTrainingPoliciesInput;
};

const CATEGORY_TEXT: Record<ScoreCategory, string> = {
  BOM: "BOM",
  ACEITAVEL: "ACEITÁVEL",
  EM_RISCO: "EM RISCO",
  CRITICO: "CRÍTICO",
};

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(date);
}

/** Resumo executivo estruturado, gerado por regras simples (função pura). */
export function buildExecutiveSummary(input: ReportContentInput): string {
  const parts: string[] = [];

  parts.push(
    `Em ${monthLabel(input.mesReferencia)}, a ${input.organizationName} apresenta um nível de segurança ${CATEGORY_TEXT[input.categoria]}, com um score global de ${input.scoreGlobal} em 100.`,
  );

  if (input.scoreVariation !== null) {
    const direction = input.scoreVariation > 0 ? "uma melhoria" : input.scoreVariation < 0 ? "uma descida" : "uma manutenção";
    parts.push(`Face ao mês anterior, registou-se ${direction} de ${Math.abs(input.scoreVariation)} ponto(s).`);
  }

  const openHighRisks = input.risks.length;
  if (openHighRisks > 0) {
    const critical = input.risks.filter((risk) => risk.riskLevel === "CRITICO").length;
    parts.push(
      `Existem ${openHighRisks} risco(s) de nível alto ou crítico por tratar${critical > 0 ? `, dos quais ${critical} crítico(s)` : ""}, que exigem atenção prioritária.`,
    );
  } else {
    parts.push("Não existem riscos de nível alto ou crítico por tratar — um bom sinal de maturidade.");
  }

  if (input.backups.falha > 0 || input.backups.desconhecido > 0) {
    parts.push(
      `Nas cópias de segurança, ${input.backups.falha} backup(s) com falha e ${input.backups.desconhecido} em estado desconhecido nos últimos 30 dias exigem verificação imediata.`,
    );
  } else if (input.backups.total > 0) {
    parts.push(`Todos os ${input.backups.total} backups registados executaram com sucesso nos últimos 30 dias.`);
  }

  if (input.incidents.criticos > 0) {
    parts.push(`Foram registados ${input.incidents.criticos} incidente(s) crítico(s) no período.`);
  }

  if (input.trainingPolicies.validPercent !== null && input.trainingPolicies.validPercent < 70) {
    parts.push(
      `Apenas ${input.trainingPolicies.validPercent}% dos utilizadores têm formação válida — a sensibilização é o ponto mais frágil.`,
    );
  }

  if (input.trainingPolicies.keyPolicies === 0) {
    parts.push("Não há políticas de segurança publicadas nas categorias chave (passwords, resposta a incidentes, uso aceitável).");
  }

  return parts.join(" ");
}

/** Ações recomendadas para os próximos 30 dias, por prioridade (função pura). */
export function buildRecommendedActions(input: ReportContentInput): string[] {
  const actions: string[] = [];

  if (input.incidents.criticos > 0) {
    actions.push(`Encerrar e documentar as lições aprendidas dos ${input.incidents.criticos} incidente(s) crítico(s) do mês.`);
  }
  const criticalRisks = input.risks.filter((risk) => risk.riskLevel === "CRITICO").length;
  if (criticalRisks > 0) {
    actions.push(`Tratar imediatamente ${criticalRisks} risco(s) crítico(s) aberto(s) e definir plano de mitigação.`);
  }
  if (input.backups.falha > 0) {
    actions.push(`Resolver as ${input.backups.falha} falha(s) de backup e repetir a execução manualmente.`);
  }
  if (input.backups.semTesteRecente > 0) {
    actions.push(`Testar a restauração de ${input.backups.semTesteRecente} backup(s) sem teste há mais de 30 dias.`);
  }
  if (input.tickets.vencidos > 0) {
    actions.push(`Dar resposta aos ${input.tickets.vencidos} ticket(s) que ultrapassaram o SLA.`);
  }
  if (input.trainingPolicies.validPercent !== null && input.trainingPolicies.validPercent < 100) {
    const missing = input.trainingPolicies.totalMembers - input.trainingPolicies.validUsers;
    actions.push(`Garantir a conclusão da formação de segurança para ${missing} utilizador(es) sem formação válida.`);
  }
  if (input.trainingPolicies.keyPolicies === 0) {
    actions.push("Publicar as políticas de palavras-passe e de resposta a incidentes.");
  }
  const overdueRisks = input.risks.filter((risk) => risk.dueDate && risk.dueDate < new Date()).length;
  if (overdueRisks > 0) {
    actions.push(`Rever os prazos de tratamento de ${overdueRisks} risco(s) vencido(s).`);
  }

  if (actions.length === 0) {
    actions.push("Manter a rotina atual: monitorizar o score mensalmente e rever o inventário de ativos.");
  }
  return actions.slice(0, 7);
}
