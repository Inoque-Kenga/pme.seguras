import { describe, expect, it } from "vitest";
import { computeRiskLevel } from "@/lib/risk-level";
import { buildMatrix } from "@/lib/services/risk.service";

describe("computeRiskLevel (nível = probabilidade × impacto)", () => {
  it("1-4 → BAIXO", () => {
    expect(computeRiskLevel(1, 1)).toEqual({ level: 1, riskLevel: "BAIXO" });
    expect(computeRiskLevel(2, 2)).toEqual({ level: 4, riskLevel: "BAIXO" });
    expect(computeRiskLevel(1, 4)).toEqual({ level: 4, riskLevel: "BAIXO" });
  });

  it("5-9 → MEDIO", () => {
    expect(computeRiskLevel(1, 5)).toEqual({ level: 5, riskLevel: "MEDIO" });
    expect(computeRiskLevel(3, 3)).toEqual({ level: 9, riskLevel: "MEDIO" });
  });

  it("10-16 → ALTO", () => {
    expect(computeRiskLevel(2, 5)).toEqual({ level: 10, riskLevel: "ALTO" });
    expect(computeRiskLevel(4, 4)).toEqual({ level: 16, riskLevel: "ALTO" });
  });

  it("17-25 → CRITICO", () => {
    expect(computeRiskLevel(4, 5)).toEqual({ level: 20, riskLevel: "CRITICO" });
    expect(computeRiskLevel(5, 5)).toEqual({ level: 25, riskLevel: "CRITICO" });
  });
});

describe("buildMatrix (matriz 5×5)", () => {
  it("conta riscos por célula probabilidade × impacto", () => {
    const matrix = buildMatrix([
      { probability: 4, impact: 5 },
      { probability: 4, impact: 5 },
      { probability: 1, impact: 2 },
    ]);
    expect(matrix[3][4]).toBe(2);
    expect(matrix[0][1]).toBe(1);
    expect(matrix[4][4]).toBe(0);
  });

  it("tolerância a valores fora de 1-5", () => {
    const matrix = buildMatrix([{ probability: 0, impact: 99 }]);
    expect(matrix[0][4]).toBe(1);
  });
});
