import { describe, expect, it } from "vitest";
import { buildExecutiveSummary, buildRecommendedActions, type ReportContentInput } from "@/lib/report-content";
import { firstDayOfMonth } from "@/lib/services/report.service";

function baseInput(overrides: Partial<ReportContentInput> = {}): ReportContentInput {
  return {
    organizationName: "Clínica Vida Segura",
    mesReferencia: new Date(Date.UTC(2026, 8, 1)),
    scoreGlobal: 72,
    categoria: "ACEITAVEL",
    scoreVariation: 4,
    risks: [],
    backups: { total: 2, sucesso: 2, falha: 0, aviso: 0, desconhecido: 0, semTesteRecente: 0 },
    tickets: { abertos: 1, vencidos: 0, resolvidosNoMes: 2, porPrioridade: [] },
    incidents: { totalNoMes: 1, criticos: 0, porTipo: [], encerrados: 1 },
    trainingPolicies: { validPercent: 80, validUsers: 4, totalMembers: 5, keyPolicies: 2 },
    ...overrides,
  };
}

describe("buildExecutiveSummary", () => {
  it("descreve score, categoria e variação", () => {
    const summary = buildExecutiveSummary(baseInput());
    expect(summary).toContain("ACEITÁVEL");
    expect(summary).toContain("72");
    expect(summary).toContain("melhoria de 4 ponto(s)");
  });

  it("alerta para riscos críticos, falhas de backup e formação fraca", () => {
    const summary = buildExecutiveSummary(
      baseInput({
        risks: [
          { level: 20, riskLevel: "CRITICO", title: "Risco A", status: "ABERTO", owner: null, dueDate: null },
          { level: 12, riskLevel: "ALTO", title: "Risco B", status: "ABERTO", owner: null, dueDate: null },
        ],
        backups: { total: 3, sucesso: 1, falha: 1, aviso: 0, desconhecido: 1, semTesteRecente: 2 },
        trainingPolicies: { validPercent: 40, validUsers: 2, totalMembers: 5, keyPolicies: 0 },
      }),
    );
    expect(summary).toContain("2 risco(s) de nível alto ou crítico");
    expect(summary).toContain("1 crítico(s)");
    expect(summary).toContain("1 backup(s) com falha");
    expect(summary).toContain("40%");
    expect(summary).toContain("Não há políticas");
  });

  it("cenário positivo é reconhecido", () => {
    const summary = buildExecutiveSummary(baseInput({ categoria: "BOM", scoreGlobal: 90 }));
    expect(summary).toContain("BOM");
    expect(summary).toContain("bom sinal");
  });
});

describe("buildRecommendedActions", () => {
  it("prioriza incidentes críticos e riscos críticos", () => {
    const actions = buildRecommendedActions(
      baseInput({
        incidents: { totalNoMes: 2, criticos: 1, porTipo: [], encerrados: 0 },
        risks: [{ level: 20, riskLevel: "CRITICO", title: "X", status: "ABERTO", owner: null, dueDate: null }],
      }),
    );
    expect(actions[0]).toContain("incidente(s) crítico(s)");
    expect(actions[1]).toContain("risco(s) crítico(s)");
  });

  it("inclui formação e políticas em falta", () => {
    const actions = buildRecommendedActions(
      baseInput({
        trainingPolicies: { validPercent: 60, validUsers: 3, totalMembers: 10, keyPolicies: 0 },
      }),
    );
    expect(actions.some((action) => action.includes("formação"))).toBe(true);
    expect(actions.some((action) => action.includes("políticas"))).toBe(true);
  });

  it("sem gaps → ação de manutenção", () => {
    const actions = buildRecommendedActions(baseInput({ trainingPolicies: { validPercent: 100, validUsers: 5, totalMembers: 5, keyPolicies: 3 } }));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toContain("Manter a rotina");
  });

  it("nunca devolve mais de 7 ações", () => {
    const actions = buildRecommendedActions(
      baseInput({
        incidents: { totalNoMes: 5, criticos: 2, porTipo: [], encerrados: 0 },
        risks: [
          { level: 20, riskLevel: "CRITICO", title: "A", status: "ABERTO", owner: null, dueDate: new Date("2020-01-01") },
          { level: 18, riskLevel: "CRITICO", title: "B", status: "ABERTO", owner: null, dueDate: new Date("2020-02-01") },
        ],
        backups: { total: 4, sucesso: 0, falha: 2, aviso: 1, desconhecido: 1, semTesteRecente: 3 },
        tickets: { abertos: 5, vencidos: 3, resolvidosNoMes: 0, porPrioridade: [] },
        trainingPolicies: { validPercent: 30, validUsers: 3, totalMembers: 10, keyPolicies: 0 },
      }),
    );
    expect(actions.length).toBeLessThanOrEqual(7);
  });
});

describe("firstDayOfMonth", () => {
  it("converte AAAA-MM no primeiro dia do mês (UTC)", () => {
    const date = firstDayOfMonth("2026-09");
    expect(date.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
