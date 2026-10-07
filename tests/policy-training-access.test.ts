import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  policyFindMany: vi.fn().mockResolvedValue([]),
  policyFindFirst: vi.fn(),
  completionFindMany: vi.fn().mockResolvedValue([]),
  completionUpsert: vi.fn(),
  assignmentFindMany: vi.fn().mockResolvedValue([]),
  quizFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    securityPolicy: { findMany: mocks.policyFindMany, findFirst: mocks.policyFindFirst },
    trainingCompletion: {
      findMany: mocks.completionFindMany,
      findFirst: mocks.quizFindFirst,
      upsert: mocks.completionUpsert,
      updateMany: vi.fn(),
    },
    trainingAssignment: { findMany: mocks.assignmentFindMany },
    auditLog: { create: vi.fn() },
  },
}));

import { listPolicies, getPolicy } from "@/lib/services/policy.service";
import { listMyTrainings, getQuizForUser } from "@/lib/services/training.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.policyFindMany.mockResolvedValue([]);
  mocks.assignmentFindMany.mockResolvedValue([]);
  mocks.completionFindMany.mockResolvedValue([]);
});

describe("Isolamento multi-tenant de políticas", () => {
  it("listPolicies filtra por organizationId", async () => {
    await listPolicies("org-a", "GESTOR_CLIENTE");
    expect(mocks.policyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }),
    );
  });

  it("COLABORADOR só vê políticas PUBLICADAS", async () => {
    await listPolicies("org-a", "COLABORADOR");
    expect(mocks.policyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-a", status: "PUBLICADA" }),
      }),
    );
  });

  it("COLABORADOR não consegue ver um rascunho de política", async () => {
    mocks.policyFindFirst.mockResolvedValue({ id: "p1", status: "RASCUNHO" });
    const policy = await getPolicy("org-a", "p1", "COLABORADOR");
    expect(policy).toBeNull();
  });
});

describe("Minhas formações (isolamento por utilizador e organização)", () => {
  it("lista apenas completions do próprio utilizador na organização", async () => {
    await listMyTrainings("org-a", "user-1");
    expect(mocks.completionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", trainingAssignment: { organizationId: "org-a" } }),
      }),
    );
  });

  it("o questionário exige que a completion pertença ao utilizador", async () => {
    mocks.quizFindFirst.mockResolvedValue(null); // não encontrada para outro utilizador
    const quiz = await getQuizForUser("org-a", "outro-user", "completion-1");
    expect(quiz).toBeNull();
    expect(mocks.quizFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "completion-1",
          userId: "outro-user",
          trainingAssignment: { organizationId: "org-a" },
        }),
      }),
    );
  });
});
