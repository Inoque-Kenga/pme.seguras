import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  sessionUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userSession: {
      findUnique: mocks.sessionFindUnique,
      updateMany: mocks.sessionUpdateMany,
    },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { revokeOwnSession } from "@/lib/services/session.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Terminar sessões", () => {
  it("um utilizador não consegue terminar a sessão de outro utilizador", async () => {
    mocks.sessionFindUnique.mockResolvedValue({ userId: "outro-utilizador", revokedAt: null });

    const result = await revokeOwnSession("eu", "org-1", "sessao-de-outro");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("o próprio utilizador consegue terminar a sua sessão (com auditoria)", async () => {
    mocks.sessionFindUnique.mockResolvedValue({ userId: "eu", revokedAt: null });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });

    const result = await revokeOwnSession("eu", "org-1", "minha-sessao");

    expect(result.ok).toBe(true);
    expect(mocks.sessionUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("uma sessão já terminada não pode ser terminada de novo", async () => {
    mocks.sessionFindUnique.mockResolvedValue({ userId: "eu", revokedAt: new Date() });

    const result = await revokeOwnSession("eu", "org-1", "minha-sessao");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });
});
