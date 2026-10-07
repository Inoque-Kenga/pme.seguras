import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/current-organization";

const mocks = vi.hoisted(() => ({
  reportFindMany: vi.fn().mockResolvedValue([]),
  reportFindFirst: vi.fn(),
  reportFindUnique: vi.fn(),
  reportUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    securityReport: {
      findMany: mocks.reportFindMany,
      findFirst: mocks.reportFindFirst,
      findUnique: mocks.reportFindUnique,
      update: mocks.reportUpdate,
    },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { generateReportSchema, listReports, setReportStatus } from "@/lib/services/report.service";

const ctxOrgA: OrganizationContext = {
  organization: { id: "org-a", name: "Organização A", slug: "org-a", status: "ACTIVE" },
  role: "ANALISTA_SEGURANCA",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Isolamento multi-tenant de relatórios", () => {
  it("listReports filtra obrigatoriamente por organizationId", async () => {
    await listReports("org-a", { status: "PUBLICADO" });
    expect(mocks.reportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a", status: "PUBLICADO" }),
      }),
    );
  });

  it("obterRelatorio devolve null para relatório de outra organização", async () => {
    mocks.reportFindFirst.mockResolvedValue(null);
    const report = await import("@/lib/services/report.service").then((module) =>
      module.getReport("org-a", "relatorio-de-outra-org"),
    );
    expect(report).toBeNull();
    expect(mocks.reportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "relatorio-de-outra-org", organizationId: "org-a" }),
      }),
    );
  });

  it("não consegue publicar relatório de outra organização", async () => {
    mocks.reportFindUnique.mockResolvedValue({ organizationId: "org-b" });

    const result = await setReportStatus(ctxOrgA, "actor-1", "relatorio-de-outra-org", "PUBLICADO");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(mocks.reportUpdate).not.toHaveBeenCalled();
  });

  it("COLABORADOR não pode gerir o estado dos relatórios", async () => {
    const ctxColaborador: OrganizationContext = { ...ctxOrgA, role: "COLABORADOR" };
    const result = await setReportStatus(ctxColaborador, "actor-2", "qualquer", "PUBLICADO");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});

describe("generateReportSchema", () => {
  it("aceita AAAA-MM válido", () => {
    expect(generateReportSchema.safeParse({ mesReferencia: "2026-09" }).success).toBe(true);
  });

  it("rejeita formatos e meses inválidos", () => {
    expect(generateReportSchema.safeParse({ mesReferencia: "09/2026" }).success).toBe(false);
    expect(generateReportSchema.safeParse({ mesReferencia: "2026-13" }).success).toBe(false);
    expect(generateReportSchema.safeParse({ mesReferencia: "" }).success).toBe(false);
  });
});
