import { describe, expect, it } from "vitest";
import { backupInputSchema, verificationInputSchema, backupSemaphore } from "@/lib/services/backup.service";
import { ticketInputSchema, ticketCommentSchema, isTicketOverdue } from "@/lib/services/ticket.service";
import { incidentInputSchema, timelineEventSchema } from "@/lib/services/incident.service";
import { phishingReportSchema } from "@/lib/services/phishing-report.service";

describe("backupInputSchema", () => {
  const valid = {
    sistemaAtivo: "Base de dados de pacientes",
    fornecedor: "Backblaze",
    frequencia: "DIARIA",
    ultimaExecucao: "2026-10-06",
    estado: "SUCESSO",
    tamanhoGB: "42.5",
    localizacao: "Cloud",
    retencaoDias: "30",
    rtoHoras: "4",
    rpoHoras: "24",
    ultimoTesteRestauracao: "2026-09-26",
    notas: "",
  };

  it("aceita um backup válido (com números de formulário em string)", () => {
    expect(backupInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita sem sistemaAtivo e com frequência inválida", () => {
    expect(backupInputSchema.safeParse({ ...valid, sistemaAtivo: "" }).success).toBe(false);
    expect(backupInputSchema.safeParse({ ...valid, frequencia: "HORARIA" }).success).toBe(false);
  });
});

describe("verificationInputSchema", () => {
  it("exige data e resultado válidos", () => {
    expect(verificationInputSchema.safeParse({ dataTeste: "2026-10-06", resultado: "SUCESSO" }).success).toBe(true);
    expect(verificationInputSchema.safeParse({ dataTeste: "", resultado: "SUCESSO" }).success).toBe(false);
    expect(verificationInputSchema.safeParse({ dataTeste: "2026-10-06", resultado: "MAIS_OU_MENOS" }).success).toBe(false);
  });
});

describe("backupSemaphore (função pura)", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("vermelho em caso de falha ou estado desconhecido", () => {
    expect(
      backupSemaphore({ estado: "FALHA", ultimaExecucao: now, ultimoTesteRestauracao: now, frequencia: "DIARIA" }, now),
    ).toBe("vermelho");
    expect(
      backupSemaphore(
        { estado: "DESCONHECIDO", ultimaExecucao: now, ultimoTesteRestauracao: now, frequencia: "DIARIA" },
        now,
      ),
    ).toBe("vermelho");
  });

  it("amarelo sem teste de restauração recente", () => {
    expect(
      backupSemaphore(
        { estado: "SUCESSO", ultimaExecucao: now, ultimoTesteRestauracao: null, frequencia: "DIARIA" },
        now,
      ),
    ).toBe("amarelo");
  });

  it("verde com execução e teste recentes", () => {
    expect(
      backupSemaphore({ estado: "SUCESSO", ultimaExecucao: now, ultimoTesteRestauracao: now, frequencia: "DIARIA" }, now),
    ).toBe("verde");
  });
});

describe("ticketInputSchema", () => {
  const valid = {
    title: "Computador muito lento",
    description: "",
    category: "SUPORTE",
    priority: "HIGH",
    slaHoras: "48",
    assetId: "",
  };

  it("aceita um ticket válido", () => {
    expect(ticketInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita categoria/prioridade inválidas", () => {
    expect(ticketInputSchema.safeParse({ ...valid, category: "PEDIDO" }).success).toBe(false);
    expect(ticketInputSchema.safeParse({ ...valid, priority: "MAXIMA" }).success).toBe(false);
  });
});

describe("ticketCommentSchema", () => {
  it("rejeita comentário vazio", () => {
    expect(ticketCommentSchema.safeParse({ conteudo: " " }).success).toBe(false);
  });
});

describe("isTicketOverdue (SLA)", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const createdAt = new Date("2026-10-05T10:00:00Z");

  it("vencido quando createdAt + slaHoras < agora e ainda aberto", () => {
    expect(isTicketOverdue({ status: "ABERTO", createdAt, slaHoras: 24 }, now)).toBe(true);
  });

  it("não vencido quando dentro do SLA ou já fechado", () => {
    expect(isTicketOverdue({ status: "ABERTO", createdAt, slaHoras: 96 }, now)).toBe(false);
    expect(isTicketOverdue({ status: "FECHADO", createdAt, slaHoras: 24 }, now)).toBe(false);
    expect(isTicketOverdue({ status: "ABERTO", createdAt, slaHoras: null }, now)).toBe(false);
  });
});

describe("incidentInputSchema", () => {
  const valid = {
    title: "E-mail de phishing reportado",
    description: "",
    type: "PHISHING",
    severity: "HIGH",
    detectedAt: "2026-10-06T10:30",
    sistemasAfetados: "",
    acoesImediatas: "",
    licoesAprendidas: "",
    responsavelId: "",
    assetId: "",
    status: "REPORTADO",
  };

  it("aceita um incidente válido", () => {
    expect(incidentInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita tipo, severidade ou estado inválidos", () => {
    expect(incidentInputSchema.safeParse({ ...valid, type: "BRUXARIA" }).success).toBe(false);
    expect(incidentInputSchema.safeParse({ ...valid, severity: "ENORME" }).success).toBe(false);
    expect(incidentInputSchema.safeParse({ ...valid, status: "ABERTO" }).success).toBe(false);
  });
});

describe("timelineEventSchema", () => {
  it("aceita apenas ACAO ou NOTA", () => {
    expect(timelineEventSchema.safeParse({ tipo: "ACAO", descricao: "Equipamento isolado." }).success).toBe(true);
    expect(timelineEventSchema.safeParse({ tipo: "STATUS_CHANGE", descricao: "Manual" }).success).toBe(false);
  });
});

describe("phishingReportSchema", () => {
  const valid = {
    canal: "EMAIL",
    remetente: "facturas@fornecedor-falso.example",
    assunto: "",
    descricao: "E-mail a pedir transferência urgente.",
    urlSuspeita: "",
    classificacaoInicial: "ALTA",
  };

  it("aceita um report válido", () => {
    expect(phishingReportSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita descrição curta e canal inválido", () => {
    expect(phishingReportSchema.safeParse({ ...valid, descricao: "ok" }).success).toBe(false);
    expect(phishingReportSchema.safeParse({ ...valid, canal: "POMBO" }).success).toBe(false);
  });
});
