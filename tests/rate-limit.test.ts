import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitEntry: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      update: mocks.update,
    },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { checkRateLimit } from "@/lib/rate-limit";

const WINDOW = 15 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkRateLimit", () => {
  it("primeira tentativa cria uma janela nova e é permitida", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await checkRateLimit("login:a@b.c", 5, WINDOW);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("janela expirada reinicia a contagem", async () => {
    mocks.findUnique.mockResolvedValue({ count: 5, resetAt: new Date(Date.now() - 1000) });

    const result = await checkRateLimit("login:a@b.c", 5, WINDOW);

    expect(result.allowed).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("bloqueia ao atingir o limite e devolve o tempo de espera", async () => {
    const resetAt = new Date(Date.now() + 10 * 60 * 1000);
    mocks.findUnique.mockResolvedValue({ count: 5, resetAt });

    const result = await checkRateLimit("login:a@b.c", 5, WINDOW, { resource: "auth_login" });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(500);
    expect(mocks.auditCreate).toHaveBeenCalledOnce(); // RATE_LIMIT_EXCEEDED auditado
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("dentro do limite incrementa o contador", async () => {
    mocks.findUnique.mockResolvedValue({ count: 2, resetAt: new Date(Date.now() + 60000) });
    mocks.update.mockResolvedValue({ count: 3 });

    const result = await checkRateLimit("login:a@b.c", 5, WINDOW);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});
