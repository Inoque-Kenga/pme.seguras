import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/current-organization";

// Mock da camada Prisma: nenhum teste toca na base de dados real.
const mocks = vi.hoisted(() => ({
  incidentFindUnique: vi.fn(),
  incidentFindFirst: vi.fn(),
  incidentFindMany: vi.fn(),
  incidentCount: vi.fn(),
  ticketFindUnique: vi.fn(),
  ticketCreate: vi.fn(),
  ticketCommentCreate: vi.fn(),
  backupFindUnique: vi.fn(),
  backupFindMany: vi.fn(),
  backupCount: vi.fn(),
  assetFindUnique: vi.fn(),
  membershipFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    incident: {
      findUnique: mocks.incidentFindUnique,
      findFirst: mocks.incidentFindFirst,
      findMany: mocks.incidentFindMany,
      count: mocks.incidentCount,
    },
    ticket: {
      findUnique: mocks.ticketFindUnique,
      create: mocks.ticketCreate,
    },
    ticketComment: { create: mocks.ticketCommentCreate },
    backupJob: {
      findUnique: mocks.backupFindUnique,
      findMany: mocks.backupFindMany,
      count: mocks.backupCount,
    },
    asset: { findUnique: mocks.assetFindUnique },
    organizationMembership: { findUnique: mocks.membershipFindUnique },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { listIncidents, setIncidentStatus } from "@/lib/services/incident.service";
import { addTicketComment, createTicket } from "@/lib/services/ticket.service";
import { listBackups, updateBackup } from "@/lib/services/backup.service";

const ctxOrgA: OrganizationContext = {
  organization: { id: "org-a", name: "Organização A", slug: "org-a", status: "ACTIVE" },
  role: "ANALISTA_SEGURANCA",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Isolamento multi-tenant (Fase C3)", () => {
  it("listIncidents filtra obrigatoriamente por organizationId", async () => {
    mocks.incidentFindMany.mockResolvedValue([]);
    mocks.incidentCount.mockResolvedValue(0);

    await listIncidents("org-a", { type: "RANSOMWARE" });

    expect(mocks.incidentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a", type: "RANSOMWARE" }),
      }),
    );
  });

  it("listBackups filtra obrigatoriamente por organizationId", async () => {
    mocks.backupFindMany.mockResolvedValue([]);
    mocks.backupCount.mockResolvedValue(0);

    await listBackups("org-a", { estado: "FALHA" });

    expect(mocks.backupFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a", estado: "FALHA" }),
      }),
    );
  });

  it("não consegue alterar incidente de outra organização", async () => {
    mocks.incidentFindUnique.mockResolvedValue({ organizationId: "org-b" });

    const result = await setIncidentStatus(ctxOrgA, "actor-1", "incidente-de-outra-org", "CONTIDO", "Contido");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("não consegue editar backup de outra organização", async () => {
    mocks.backupFindUnique.mockResolvedValue({ organizationId: "org-b" });

    const result = await updateBackup(ctxOrgA, "actor-1", "backup-de-outra-org", {
      sistemaAtivo: "Sistema",
      frequencia: "DIARIA",
      estado: "SUCESSO",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("qualquer membro pode criar ticket, mas COLABORADOR não cria backup", async () => {
    mocks.ticketCreate.mockResolvedValue({ id: "ticket-1" });
    const ctxColaborador: OrganizationContext = { ...ctxOrgA, role: "COLABORADOR" };

    const ticket = await createTicket(ctxColaborador, "colab-1", {
      title: "Pedido de ajuda",
      category: "SUPORTE",
      priority: "LOW",
    });
    expect(ticket.ok).toBe(true);

    const backup = await updateBackup(ctxColaborador, "colab-1", "backup-1", {
      sistemaAtivo: "Sistema",
      frequencia: "DIARIA",
      estado: "SUCESSO",
    });
    expect(backup.ok).toBe(false);
    if (!backup.ok) expect(backup.error.code).toBe("FORBIDDEN");
  });

  it("COLABORADOR não comenta no ticket de outro utilizador", async () => {
    mocks.ticketFindUnique.mockResolvedValue({ organizationId: "org-a", createdById: "outro-user" });
    const ctxColaborador: OrganizationContext = { ...ctxOrgA, role: "COLABORADOR" };

    const result = await addTicketComment(ctxColaborador, "colab-1", "ticket-1", { conteudo: "Comentário" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(mocks.ticketCommentCreate).not.toHaveBeenCalled();
  });
});
