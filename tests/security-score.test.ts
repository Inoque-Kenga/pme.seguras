import { describe, expect, it } from "vitest";
import { computeSecurityScore, type SecurityScoreInput } from "@/lib/security-score";

const perfectInput: SecurityScoreInput = {
  mfaAdminPercent: 1,
  endpoints: { total: 10, protected: 10 },
  backups: { jobs: 2, successLast30d: 2, failuresLast30d: 0 },
  updates: { total: 10, updatedLast30d: 10 },
  networkSegmented: true,
  assets: { total: 10, complete: 10 },
  phishing: { sent: 50, clicked: 0 },
  training: { assigned: 10, validCompleted: 10 },
  incidentsHandled: 3,
  hasIncidentPolicy: true,
};

const emptyInput: SecurityScoreInput = {
  mfaAdminPercent: null,
  endpoints: { total: 0, protected: 0 },
  backups: { jobs: 0, successLast30d: 0, failuresLast30d: 0 },
  updates: { total: 0, updatedLast30d: 0 },
  networkSegmented: null,
  assets: { total: 0, complete: 0 },
  phishing: null,
  training: null,
  incidentsHandled: 0,
  hasIncidentPolicy: null,
};

describe("computeSecurityScore", () => {
  it("dados perfeitos → score máximo 100 e categoria BOM", () => {
    const result = computeSecurityScore(perfectInput);
    expect(result.total).toBe(100);
    expect(result.categoria).toBe("BOM");
    expect(result.incompleteCount).toBe(0);
  });

  it("sem dados → pontuação conservadora baixa, categorias marcadas como incompletas", () => {
    const result = computeSecurityScore(emptyInput);
    expect(result.total).toBeLessThanOrEqual(30);
    expect(["CRITICO", "EM_RISCO"]).toContain(result.categoria);
    expect(result.incompleteCount).toBeGreaterThanOrEqual(6);
    // Nunca inventa dados: categorias sem dados recebem ~25% ou menos do peso.
    for (const category of result.categories.filter((entry) => entry.incomplete)) {
      expect(category.score).toBeLessThanOrEqual(category.weight * 0.3);
    }
  });

  it("falhas de backup reduzem a pontuação da categoria", () => {
    const withFailures = computeSecurityScore({
      ...perfectInput,
      backups: { jobs: 4, successLast30d: 1, failuresLast30d: 3 },
    });
    const backups = withFailures.categories.find((category) => category.key === "backups")!;
    expect(backups.score).toBeLessThan(20);
  });

  it("taxa de cliques de phishing alta reduz a categoria de formação (sem formações atribuídas)", () => {
    const result = computeSecurityScore({
      ...perfectInput,
      training: null, // sem formações → fallback para taxa de cliques
      phishing: { sent: 50, clicked: 40 },
    });
    const phishing = result.categories.find((category) => category.key === "formacao_phishing")!;
    expect(phishing.score).toBe(2); // 80% de cliques → 20% de 10 pontos
  });

  it("gera recomendações para categorias fracas", () => {
    const result = computeSecurityScore(emptyInput);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe("classificação em categorias", () => {
  function totalFor(score: number) {
    // Constrói um input que produz aproximadamente o score pretendido.
    const pct = score / 100;
    return computeSecurityScore({
      mfaAdminPercent: pct,
      endpoints: { total: 100, protected: Math.round(100 * pct) },
      backups: { jobs: 100, successLast30d: Math.round(100 * pct), failuresLast30d: 0 },
      updates: { total: 100, updatedLast30d: Math.round(100 * pct) },
      networkSegmented: pct >= 0.5,
      assets: { total: 100, complete: Math.round(100 * pct) },
      phishing: { sent: 100, clicked: Math.round(100 * (1 - pct)) },
      training: null,
      incidentsHandled: pct > 0.2 ? 2 : 0,
      hasIncidentPolicy: pct >= 0.6,
    });
  }

  it("bandas: <40 CRITICO · 40-59 EM_RISCO · 60-79 ACEITAVEL · >=80 BOM", () => {
    expect(totalFor(25).categoria).toBe("CRITICO");
    expect(totalFor(50).categoria).toBe("EM_RISCO");
    expect(totalFor(70).categoria).toBe("ACEITAVEL");
    expect(totalFor(90).categoria).toBe("BOM");
  });
});
