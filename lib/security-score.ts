import type { ScoreCategory } from "@prisma/client";

export type ScoreCategoryKey =
  | "identidade_mfa"
  | "endpoints"
  | "backups"
  | "atualizacoes"
  | "rede"
  | "ativos"
  | "formacao_phishing"
  | "incidentes_politicas";

export type CategoryScore = {
  key: ScoreCategoryKey;
  label: string;
  weight: number;
  score: number;
  detail: string;
  incomplete: boolean;
};

export type SecurityScoreInput = {
  /** Percentagem de contas administrativas com MFA (null = sem dados). */
  mfaAdminPercent: number | null;
  endpoints: { total: number; protected: number };
  backups: { jobs: number; successLast30d: number; failuresLast30d: number };
  updates: { total: number; updatedLast30d: number };
  /** Firewall e Wi-Fi segmentado (null = sem dados). */
  networkSegmented: boolean | null;
  assets: { total: number; complete: number };
  /** Agregado das simulações (null = sem campanhas). */
  phishing: { sent: number; clicked: number } | null;
  incidentsHandled: number;
  /** Política de resposta a incidentes publicada (null = sem dados). */
  hasIncidentPolicy: boolean | null;
};

export type SecurityScoreResult = {
  total: number;
  categoria: ScoreCategory;
  categories: CategoryScore[];
  /** Categorias que mais pontos retiraram, para a secção "principais fatores". */
  factors: CategoryScore[];
  /** Ações recomendadas para os próximos 30 dias. */
  recommendations: string[];
  incompleteCount: number;
};

export const SCORE_WEIGHTS: Record<ScoreCategoryKey, number> = {
  identidade_mfa: 20,
  endpoints: 15,
  backups: 20,
  atualizacoes: 10,
  rede: 10,
  ativos: 10,
  formacao_phishing: 10,
  incidentes_politicas: 5,
};

export const CATEGORY_LABELS: Record<ScoreCategoryKey, string> = {
  identidade_mfa: "Gestão de identidade e MFA",
  endpoints: "Proteção de endpoints",
  backups: "Backups e recuperação",
  atualizacoes: "Atualizações e vulnerabilidades",
  rede: "Segurança de rede",
  ativos: "Gestão de ativos",
  formacao_phishing: "Formação e phishing",
  incidentes_politicas: "Resposta a incidentes e políticas",
};

const RECOMMENDATIONS: Record<ScoreCategoryKey, string> = {
  identidade_mfa: "Ativar MFA nas contas administrativas e registar a cobertura na plataforma.",
  endpoints: "Instalar/ativar proteção de endpoint (antivírus/EDR) em todos os computadores.",
  backups: "Garantir execuções de backup com sucesso e testar uma restauração este mês.",
  atualizacoes: "Atualizar sistemas operativos e aplicações com mais de 30 dias.",
  rede: "Documentar a existência de firewall e de Wi-Fi segmentado para visitantes.",
  ativos: "Completar o inventário: responsável e localização em todos os ativos.",
  formacao_phishing: "Realizar formação de sensibilização e uma simulação de phishing.",
  incidentes_politicas: "Publicar a política de resposta a incidentes e registar a resolução dos incidentes.",
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function categoryOf(total: number): ScoreCategory {
  if (total >= 80) return "BOM";
  if (total >= 60) return "ACEITAVEL";
  if (total >= 40) return "EM_RISCO";
  return "CRITICO";
}

/**
 * Motor puro do score de segurança (0-100).
 * Dados em falta recebem pontuação conservadora (~25% do peso) e ficam
 * marcados como incompletos — nunca são inventados.
 */
export function computeSecurityScore(input: SecurityScoreInput): SecurityScoreResult {
  const categories: CategoryScore[] = [];

  // 1) Identidade e MFA (20)
  if (input.mfaAdminPercent === null) {
    categories.push({
      key: "identidade_mfa",
      label: CATEGORY_LABELS.identidade_mfa,
      weight: 20,
      score: 5,
      detail: "Sem dados sobre MFA nas contas administrativas — pontuação conservadora aplicada.",
      incomplete: true,
    });
  } else {
    const pct = clamp01(input.mfaAdminPercent);
    categories.push({
      key: "identidade_mfa",
      label: CATEGORY_LABELS.identidade_mfa,
      weight: 20,
      score: Math.round(20 * pct),
      detail: `${Math.round(pct * 100)}% das contas administrativas com MFA ativo.`,
      incomplete: false,
    });
  }

  // 2) Proteção de endpoints (15)
  if (input.endpoints.total === 0) {
    categories.push({
      key: "endpoints",
      label: CATEGORY_LABELS.endpoints,
      weight: 15,
      score: 3,
      detail: "Sem computadores registados no inventário — pontuação conservadora aplicada.",
      incomplete: true,
    });
  } else {
    const pct = clamp01(input.endpoints.protected / input.endpoints.total);
    categories.push({
      key: "endpoints",
      label: CATEGORY_LABELS.endpoints,
      weight: 15,
      score: Math.round(15 * pct),
      detail: `${input.endpoints.protected} de ${input.endpoints.total} computadores com proteção de endpoint.`,
      incomplete: false,
    });
  }

  // 3) Backups e recuperação (20)
  if (input.backups.jobs === 0) {
    categories.push({
      key: "backups",
      label: CATEGORY_LABELS.backups,
      weight: 20,
      score: 4,
      detail: "Nenhum backup registado — pontuação conservadora aplicada.",
      incomplete: true,
    });
  } else {
    const successRate = clamp01(input.backups.successLast30d / input.backups.jobs);
    const failurePenalty = Math.min(0.5, input.backups.failuresLast30d * 0.15);
    const health = clamp01(successRate - failurePenalty);
    categories.push({
      key: "backups",
      label: CATEGORY_LABELS.backups,
      weight: 20,
      score: Math.round(20 * health),
      detail: `${input.backups.successLast30d} de ${input.backups.jobs} backups com sucesso nos últimos 30 dias · ${input.backups.failuresLast30d} falha(s) recente(s).`,
      incomplete: false,
    });
  }

  // 4) Atualizações (10)
  if (input.updates.total === 0) {
    categories.push({
      key: "atualizacoes",
      label: CATEGORY_LABELS.atualizacoes,
      weight: 10,
      score: 2,
      detail: "Sem ativos para avaliar atualizações — pontuação conservadora aplicada.",
      incomplete: true,
    });
  } else {
    const pct = clamp01(input.updates.updatedLast30d / input.updates.total);
    categories.push({
      key: "atualizacoes",
      label: CATEGORY_LABELS.atualizacoes,
      weight: 10,
      score: Math.round(10 * pct),
      detail: `${input.updates.updatedLast30d} de ${input.updates.total} ativos atualizados nos últimos 30 dias.`,
      incomplete: false,
    });
  }

  // 5) Segurança de rede (10)
  if (input.networkSegmented === null) {
    categories.push({
      key: "rede",
      label: CATEGORY_LABELS.rede,
      weight: 10,
      score: 2,
      detail: "Sem dados sobre firewall/segmentação de rede — pontuação conservadora aplicada.",
      incomplete: true,
    });
  } else {
    categories.push({
      key: "rede",
      label: CATEGORY_LABELS.rede,
      weight: 10,
      score: input.networkSegmented ? 10 : 2,
      detail: input.networkSegmented
        ? "Firewall e Wi-Fi segmentado documentados."
        : "Sem firewall ou Wi-Fi segmentado documentados.",
      incomplete: false,
    });
  }

  // 6) Gestão de ativos (10)
  if (input.assets.total === 0) {
    categories.push({
      key: "ativos",
      label: CATEGORY_LABELS.ativos,
      weight: 10,
      score: 0,
      detail: "Inventário vazio — registe os ativos da organização.",
      incomplete: true,
    });
  } else {
    const pct = clamp01(input.assets.complete / input.assets.total);
    categories.push({
      key: "ativos",
      label: CATEGORY_LABELS.ativos,
      weight: 10,
      score: Math.round(10 * pct),
      detail: `${input.assets.complete} de ${input.assets.total} ativos com responsável e localização preenchidos.`,
      incomplete: false,
    });
  }

  // 7) Formação e phishing (10)
  if (!input.phishing) {
    categories.push({
      key: "formacao_phishing",
      label: CATEGORY_LABELS.formacao_phishing,
      weight: 10,
      score: 3,
      detail: "Sem dados de formação nem simulações — pontuação conservadora aplicada.",
      incomplete: true,
    });
  } else {
    const clickRate = input.phishing.sent > 0 ? clamp01(input.phishing.clicked / input.phishing.sent) : 0;
    categories.push({
      key: "formacao_phishing",
      label: CATEGORY_LABELS.formacao_phishing,
      weight: 10,
      score: Math.round(10 * (1 - clickRate)),
      detail:
        input.phishing.sent > 0
          ? `${Math.round(clickRate * 100)}% de cliques nas simulações de phishing.`
          : "Simulações registadas sem envios.",
      incomplete: false,
    });
  }

  // 8) Resposta a incidentes e políticas (5)
  {
    let score = 0;
    const parts: string[] = [];
    let incomplete = false;
    if (input.hasIncidentPolicy === null) {
      score += 1;
      parts.push("sem política de resposta registada (pontuação conservadora)");
      incomplete = true;
    } else if (input.hasIncidentPolicy) {
      score += 3;
      parts.push("política de resposta a incidentes publicada");
    } else {
      parts.push("sem política de resposta a incidentes publicada");
    }
    if (input.incidentsHandled > 0) {
      score += 2;
      parts.push(`${input.incidentsHandled} incidente(s) já tratado(s)`);
    } else {
      parts.push("nenhum incidente tratado até agora");
    }
    categories.push({
      key: "incidentes_politicas",
      label: CATEGORY_LABELS.incidentes_politicas,
      weight: 5,
      score: Math.min(5, score),
      detail: parts.join(" · ") + ".",
      incomplete,
    });
  }

  const total = Math.min(100, categories.reduce((sum, category) => sum + category.score, 0));
  const factors = [...categories].sort((a, b) => b.weight - b.score - (a.weight - a.score)).slice(0, 5);
  const weakKeys = new Set(
    categories.filter((category) => category.score < category.weight * 0.7).map((category) => category.key),
  );
  const recommendations = [...weakKeys].map((key) => RECOMMENDATIONS[key]).slice(0, 5);

  return {
    total,
    categoria: categoryOf(total),
    categories,
    factors,
    recommendations,
    incompleteCount: categories.filter((category) => category.incomplete).length,
  };
}
