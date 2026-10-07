import type { RiskLevel } from "@prisma/client";

/**
 * Cálculo puro do nível de risco.
 * nivel = probabilidade (1-5) × impacto (1-5).
 * Bandas: 1-4 BAIXO · 5-9 MEDIO · 10-16 ALTO · 17-25 CRITICO.
 */
export function computeRiskLevel(probability: number, impact: number): { level: number; riskLevel: RiskLevel } {
  const level = probability * impact;
  if (level >= 17) return { level, riskLevel: "CRITICO" };
  if (level >= 10) return { level, riskLevel: "ALTO" };
  if (level >= 5) return { level, riskLevel: "MEDIO" };
  return { level, riskLevel: "BAIXO" };
}

/** Cores de fundo das células da matriz 5×5 por nível de risco. */
export const riskLevelCellStyles: Record<RiskLevel, string> = {
  BAIXO: "bg-emerald-100 text-emerald-900",
  MEDIO: "bg-amber-100 text-amber-900",
  ALTO: "bg-orange-200 text-orange-950",
  CRITICO: "bg-red-200 text-red-950",
};
