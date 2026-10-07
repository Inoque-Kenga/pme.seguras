import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/current-organization";

// Mock da camada Prisma: nenhum teste toca na base de dados real.
const mocks = vi.hoisted(() => ({
  riskFindUnique: vi.fn(),
  riskFindMany: vi.fn(),
  riskCount: vi.fn(),
  riskCreate: vi.fn(),
  riskUpdate: vi.fn(),
  assetFindUnique: vi.fn(),
  assessmentFindUnique: vi.fn(),
  membershipFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    risk: {
      findUnique: mocks.riskFindUnique,
      findMany: mocks.riskFindMany,
      count: mocks.riskCount,
      create: mocks.riskCreate,
      update: mocks.riskUpdate,
    },
    asset: { findUnique: mocks.assetFindUnique },
    riskAssessment: { findUnique: mocks.assessmentFindUnique },
    organizationMembership: { findUnique: mocks.membershipFindUnique },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { createRisk, listRisks, updateRisk } from "@/lib/services/risk.service";

const { riskFindUnique, riskFindMany, riskCount, riskCreate, riskUpdate, auditCreate } = mocks;

const ctxOrgA: OrganizationContext = {
  organization: { id: "org-a", name: "Organização A", slug: "org-a", status: "ACTIVE" },
  role: "ANALISTA_SEGURANCA",
};

const validInput = {
  title: "Risco de teste",
  probability: 3,
  impact: 4,
  status: "ABERTO",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Isolamento multi-tenant de riscos", () => {
  it("listRisks filtra obrigatoriamente por organizationId", async () => {
    riskFindMany.mockResolvedValue([]);
    riskCount.mockResolvedValue(0);

    await listRisks("org-a", { riskLevel: "CRITICO" });

    expect(riskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a", riskLevel: "CRITICO" }),
      }),
    );
  });

  it("um utilizador da organização A não consegue editar um risco da organização B", async () => {
    riskFindUnique.mockResolvedValue({ organizationId: "org-b" });

    const result = await updateRisk(ctxOrgA, "actor-1", "risco-de-outra-org", validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(riskUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("COLABORADOR não consegue criar riscos", async () => {
    const ctxColaborador: OrganizationContext = { ...ctxOrgA, role: "COLABORADOR" };

    const result = await createRisk(ctxColaborador, "actor-2", validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(riskCreate).not.toHaveBeenCalled();
  });

  it("não aceita ativo de outra organização", async () => {
    mocks.assetFindUnique.mockResolvedValue({ organizationId: "org-b" });

    const result = await createRisk(ctxOrgA, "actor-1", { ...validInput, assetId: "asset-de-outra-org" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(riskCreate).not.toHaveBeenCalled();
  });
});
