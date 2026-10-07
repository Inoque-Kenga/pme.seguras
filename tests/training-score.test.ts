import { describe, expect, it } from "vitest";
import { computeValidUntil, effectiveCompletionState, PASS_THRESHOLD } from "@/lib/services/training.service";
import { computeSecurityScore, type SecurityScoreInput } from "@/lib/security-score";

describe("computeValidUntil", () => {
  it("validoAte = dataConclusao + validadeMeses", () => {
    const conclusao = new Date("2026-01-15T10:00:00Z");
    const valid = computeValidUntil(conclusao, 12);
    expect(valid.getFullYear()).toBe(2027);
    expect(valid.getMonth()).toBe(0); // janeiro
    expect(valid.getDate()).toBe(15);
  });

  it("funciona com mudança de ano e meses curtos", () => {
    const valid = computeValidUntil(new Date("2026-11-30T10:00:00Z"), 3);
    expect(valid.getFullYear()).toBe(2027);
  });
});

describe("effectiveCompletionState", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("CONCLUIDO dentro da validade mantém-se", () => {
    expect(
      effectiveCompletionState({ estado: "CONCLUIDO", validoAte: new Date("2026-12-01") }, now),
    ).toBe("CONCLUIDO");
  });

  it("CONCLUIDO fora da validade passa a EXPIRADO", () => {
    expect(
      effectiveCompletionState({ estado: "CONCLUIDO", validoAte: new Date("2026-01-01") }, now),
    ).toBe("EXPIRADO");
  });

  it("outros estados não são afetados", () => {
    expect(effectiveCompletionState({ estado: "EM_ANDAMENTO", validoAte: null }, now)).toBe("EM_ANDAMENTO");
  });

  it("o limiar de aprovação é 70%", () => {
    expect(PASS_THRESHOLD).toBe(70);
  });
});

const baseInput: SecurityScoreInput = {
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

describe("score: categoria Formação e phishing (10 pts)", () => {
  function categoryOf(input: SecurityScoreInput) {
    return computeSecurityScore(input).categories.find((category) => category.key === "formacao_phishing")!;
  }

  it("100% dos utilizadores com formação válida → 10 pontos", () => {
    const category = categoryOf({ ...baseInput, training: { assigned: 10, validCompleted: 10 } });
    expect(category.score).toBe(10);
    expect(category.incomplete).toBe(false);
  });

  it("40% com formação válida → ~4 pontos e texto explicativo", () => {
    const category = categoryOf({ ...baseInput, training: { assigned: 10, validCompleted: 4 } });
    expect(category.score).toBe(4);
    expect(category.detail).toContain("40%");
  });

  it("sem atribuições mas com campanhas → usa taxa de cliques", () => {
    const category = categoryOf({ ...baseInput, training: null, phishing: { sent: 50, clicked: 25 } });
    expect(category.score).toBe(5);
  });

  it("sem atribuições nem campanhas → conservador + incompleto", () => {
    const category = categoryOf(baseInput);
    expect(category.incomplete).toBe(true);
    expect(category.score).toBeLessThanOrEqual(3);
  });
});

describe("score: categoria Resposta a incidentes e políticas (5 pts)", () => {
  function categoryOf(input: SecurityScoreInput) {
    return computeSecurityScore(input).categories.find((category) => category.key === "incidentes_politicas")!;
  }

  it("política publicada + incidentes tratados → 5 pontos", () => {
    const category = categoryOf({ ...baseInput, hasIncidentPolicy: true, incidentsHandled: 2 });
    expect(category.score).toBe(5);
  });

  it("política publicada sem incidentes tratados → 3 pontos", () => {
    const category = categoryOf({ ...baseInput, hasIncidentPolicy: true, incidentsHandled: 0 });
    expect(category.score).toBe(3);
  });

  it("sem política nem incidentes → 0 pontos", () => {
    const category = categoryOf({ ...baseInput, hasIncidentPolicy: false, incidentsHandled: 0 });
    expect(category.score).toBe(0);
  });
});
