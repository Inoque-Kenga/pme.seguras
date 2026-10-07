import { describe, expect, it } from "vitest";
import { policyInputSchema } from "@/lib/services/policy.service";
import { trainingModuleSchema, trainingQuestionSchema, quizSubmissionSchema } from "@/lib/services/training.service";

describe("policyInputSchema", () => {
  const valid = {
    title: "Política de palavras-passe",
    content: "1. Mínimo 12 caracteres. 2. Nunca partilhar.",
    category: "PASSWORDS",
    status: "RASCUNHO",
  };

  it("aceita uma política válida", () => {
    expect(policyInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita conteúdo demasiado curto e categoria inválida", () => {
    expect(policyInputSchema.safeParse({ ...valid, content: "curto" }).success).toBe(false);
    expect(policyInputSchema.safeParse({ ...valid, category: "SEGREDOS" }).success).toBe(false);
  });
});

describe("trainingModuleSchema", () => {
  const valid = {
    title: "Noções de phishing",
    description: "",
    content: "Phishing é quando alguém se faz passar por uma entidade confiável.",
    duracaoMinutos: "10",
    validadeMeses: "12",
  };

  it("aceita um módulo válido", () => {
    expect(trainingModuleSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita validade fora de 1-60 meses", () => {
    expect(trainingModuleSchema.safeParse({ ...valid, validadeMeses: "0" }).success).toBe(false);
    expect(trainingModuleSchema.safeParse({ ...valid, validadeMeses: "61" }).success).toBe(false);
  });
});

describe("trainingQuestionSchema", () => {
  const valid = {
    pergunta: "Qual é o objetivo do phishing?",
    opcoes: ["Roubar dados", "Acelerar o PC"],
    respostaCorretaIndex: 0,
  };

  it("aceita uma pergunta válida", () => {
    expect(trainingQuestionSchema.safeParse(valid).success).toBe(true);
  });

  it("exige pelo menos 2 opções e pergunta com conteúdo", () => {
    expect(trainingQuestionSchema.safeParse({ ...valid, opcoes: ["Só uma"] }).success).toBe(false);
    expect(trainingQuestionSchema.safeParse({ ...valid, pergunta: "ok" }).success).toBe(false);
  });
});

describe("quizSubmissionSchema", () => {
  it("exige completionId e respostas", () => {
    expect(quizSubmissionSchema.safeParse({ completionId: "c1", answers: [0, 2, 1] }).success).toBe(true);
    expect(quizSubmissionSchema.safeParse({ completionId: "", answers: [0] }).success).toBe(false);
    expect(quizSubmissionSchema.safeParse({ completionId: "c1", answers: [] }).success).toBe(false);
  });
});
