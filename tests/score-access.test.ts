import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock da camada Prisma: nenhum teste toca na base de dados real.
const mocks = vi.hoisted(() => ({
  assetCount: vi.fn().mockResolvedValue(0),
  backupFindMany: vi.fn().mockResolvedValue([]),
  campaignFindMany: vi.fn().mockResolvedValue([]),
  incidentCount: vi.fn().mockResolvedValue(0),
  snapshotFindFirst: vi.fn().mockResolvedValue({ dataReferencia: new Date() }),
  snapshotFindMany: vi.fn().mockResolvedValue([]),
  snapshotCreate: vi.fn().mockResolvedValue({ id: "snap-1" }),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: { count: mocks.assetCount },
    backupJob: { findMany: mocks.backupFindMany },
    phishingCampaign: { findMany: mocks.campaignFindMany },
    incident: { count: mocks.incidentCount },
    trainingAssignment: { count: vi.fn().mockResolvedValue(0) },
    trainingCompletion: { findMany: vi.fn().mockResolvedValue([]) },
    securityPolicy: { count: vi.fn().mockResolvedValue(0) },
    organizationMembership: { count: vi.fn().mockResolvedValue(0) },
    securityScoreSnapshot: {
      findFirst: mocks.snapshotFindFirst,
      findMany: mocks.snapshotFindMany,
      create: mocks.snapshotCreate,
    },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { computeAndStoreSnapshot, getScoreHistory } from "@/lib/services/security-score.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assetCount.mockResolvedValue(0);
  mocks.backupFindMany.mockResolvedValue([]);
  mocks.campaignFindMany.mockResolvedValue([]);
  mocks.incidentCount.mockResolvedValue(0);
  mocks.snapshotFindFirst.mockResolvedValue({ dataReferencia: new Date() });
});

describe("Isolamento multi-tenant do score", () => {
  it("todos os dados do cálculo vêm apenas da organização pedida", async () => {
    await computeAndStoreSnapshot("org-a", "actor-1");

    for (const call of mocks.assetCount.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
    }
    for (const call of mocks.backupFindMany.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
    }
    for (const call of mocks.incidentCount.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
    }
  });

  it("o histórico de snapshots é filtrado por organizationId", async () => {
    await getScoreHistory("org-a", 6);

    expect(mocks.snapshotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a" }),
      }),
    );
  });

  it("snapshot recente não gera duplicado nem auditoria", async () => {
    mocks.snapshotFindFirst.mockResolvedValue({ dataReferencia: new Date() });

    await computeAndStoreSnapshot("org-a", "actor-1");

    expect(mocks.snapshotCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
