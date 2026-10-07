import { describe, expect, it } from "vitest";
import { riskInputSchema } from "@/lib/services/risk.service";
import { taskInputSchema, commentInputSchema } from "@/lib/services/treatment-task.service";

const validRisk = {
  title: "Acesso indevido a registos clínicos",
  description: "Contas partilhadas na receção.",
  assessmentId: "",
  assetId: "",
  threat: "Acesso não autorizado",
  vulnerability: "Contas partilhadas",
  probability: 4,
  impact: 5,
  treatment: "Contas individuais",
  ownerId: "",
  dueDate: "2026-12-31",
  status: "ABERTO",
};

describe("riskInputSchema", () => {
  it("aceita um risco válido", () => {
    expect(riskInputSchema.safeParse(validRisk).success).toBe(true);
  });

  it("rejeita probabilidade fora de 1-5", () => {
    expect(riskInputSchema.safeParse({ ...validRisk, probability: 0 }).success).toBe(false);
    expect(riskInputSchema.safeParse({ ...validRisk, probability: 6 }).success).toBe(false);
  });

  it("rejeita impacto fora de 1-5", () => {
    expect(riskInputSchema.safeParse({ ...validRisk, impact: 9 }).success).toBe(false);
  });

  it("aceita probabilidade/impacto como strings de formulário (coerce)", () => {
    const result = riskInputSchema.safeParse({ ...validRisk, probability: "5", impact: "4" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.probability).toBe(5);
      expect(result.data.impact).toBe(4);
    }
  });

  it("rejeita título vazio e estado inválido", () => {
    expect(riskInputSchema.safeParse({ ...validRisk, title: "" }).success).toBe(false);
    expect(riskInputSchema.safeParse({ ...validRisk, status: "FECHADOO" }).success).toBe(false);
  });
});

describe("taskInputSchema", () => {
  const validTask = {
    riskId: "risk-1",
    title: "Ativar MFA no e-mail",
    description: "",
    assigneeId: "",
    priority: "HIGH",
    status: "NAO_INICIADA",
    dueDate: "2026-12-31",
  };

  it("aceita uma tarefa válida", () => {
    expect(taskInputSchema.safeParse(validTask).success).toBe(true);
  });

  it("exige o risco associado", () => {
    expect(taskInputSchema.safeParse({ ...validTask, riskId: "" }).success).toBe(false);
  });

  it("rejeita prioridade e estado inválidos", () => {
    expect(taskInputSchema.safeParse({ ...validTask, priority: "MEGA" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...validTask, status: "FEITA" }).success).toBe(false);
  });
});

describe("commentInputSchema", () => {
  it("aceita comentário válido", () => {
    expect(commentInputSchema.safeParse({ body: "Progresso registado." }).success).toBe(true);
  });

  it("rejeita comentário vazio", () => {
    expect(commentInputSchema.safeParse({ body: " " }).success).toBe(false);
  });
});
