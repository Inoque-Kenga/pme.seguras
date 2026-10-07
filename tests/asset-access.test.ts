import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/current-organization";

// Mock da camada Prisma: nenhum teste toca na base de dados real.
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
      update: mocks.update,
    },
    auditLog: { create: mocks.auditCreate },
  },
}));

const { findUnique, findMany, count, update, auditCreate } = mocks;

import { archiveAsset, listAssets, updateAsset } from "@/lib/services/asset.service";

const ctxOrgA: OrganizationContext = {
  organization: { id: "org-a", name: "Organização A", slug: "org-a", status: "ACTIVE" },
  role: "ANALISTA_SEGURANCA",
};

const validAssetInput = {
  name: "Servidor",
  type: "HARDWARE",
  criticality: "HIGH",
  status: "ACTIVE",
  protecaoEndpoint: true,
  mfaAplicavel: false,
  cifragem: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Isolamento multi-tenant de ativos", () => {
  it("listAssets filtra obrigatoriamente por organizationId", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await listAssets("org-a", { search: "servidor" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a", archivedAt: null }),
      }),
    );
  });

  it("um utilizador da organização A não consegue editar um ativo da organização B", async () => {
    // O ativo existe, mas pertence a outra organização.
    findUnique.mockResolvedValue({ organizationId: "org-b", archivedAt: null });

    const result = await updateAsset(ctxOrgA, "actor-1", "asset-de-outra-org", validAssetInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("um utilizador da organização A não consegue arquivar um ativo da organização B", async () => {
    findUnique.mockResolvedValue({ organizationId: "org-b", archivedAt: null });

    const result = await archiveAsset(ctxOrgA, "actor-1", "asset-de-outra-org");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(update).not.toHaveBeenCalled();
  });

  it("COLABORADOR não pode criar nem editar ativos", async () => {
    const ctxColaborador: OrganizationContext = { ...ctxOrgA, role: "COLABORADOR" };
    const result = await updateAsset(ctxColaborador, "actor-2", "qualquer", validAssetInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(findUnique).not.toHaveBeenCalled();
  });
});
