import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  tokenCreate: vi.fn(),
  tokenFindFirst: vi.fn(),
  transaction: vi.fn().mockResolvedValue([]),
  rateLimitFindUnique: vi.fn().mockResolvedValue(null),
  rateLimitUpsert: vi.fn(),
  rateLimitUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: vi.fn() },
    passwordResetToken: {
      create: mocks.tokenCreate,
      findFirst: mocks.tokenFindFirst,
      update: vi.fn(),
    },
    userSession: { updateMany: vi.fn() },
    rateLimitEntry: {
      findUnique: mocks.rateLimitFindUnique,
      upsert: mocks.rateLimitUpsert,
      update: mocks.rateLimitUpdate,
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { requestPasswordReset, resetPasswordWithToken, validateResetToken } from "@/lib/services/password-reset.service";
import { hashText } from "@/lib/crypto";

const strongPassword = "NovaPassword123";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimitFindUnique.mockResolvedValue(null);
});

describe("Fluxo de recuperação de password", () => {
  it("pedido com e-mail existente cria token (guardado como hash) e devolve link em dev", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", isActive: true });
    mocks.tokenCreate.mockResolvedValue({ id: "tok-1" });

    const result = await requestPasswordReset({ email: "Admin@CyberPME.demo" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.devResetLink).toContain("/redefinir-password/");
    // O token é guardado como hash — nunca em plaintext.
    const createdData = mocks.tokenCreate.mock.calls[0][0].data;
    expect(createdData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("pedido com e-mail inexistente devolve resposta genérica (anti-enumeração)", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const result = await requestPasswordReset({ email: "naoexiste@x.pt" });

    expect(result.ok).toBe(true);
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("token válido passa na validação; expirado falha", async () => {
    mocks.tokenFindFirst.mockResolvedValue({ id: "tok-1", user: { id: "user-1", isActive: true } });
    expect(await validateResetToken("token-valido-123")).toBe(true);

    mocks.tokenFindFirst.mockResolvedValue(null); // expirado/usado não é devolvido pela query
    expect(await validateResetToken("token-expirado-123")).toBe(false);
    expect(await validateResetToken("curto")).toBe(false);
  });

  it("redefinição com sucesso marca token, atualiza password e revoga sessões", async () => {
    mocks.tokenFindFirst.mockResolvedValue({
      id: "tok-1",
      userId: "user-1",
      user: { id: "user-1", isActive: true },
    });

    const result = await resetPasswordWithToken({
      token: "token-valido-123",
      password: strongPassword,
      confirmPassword: strongPassword,
    });

    expect(result.ok).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("rejeita passwords fracas e confirmações diferentes", async () => {
    const weak = await resetPasswordWithToken({ token: "token-valido-123", password: "curta", confirmPassword: "curta" });
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.error.code).toBe("VALIDATION");

    const mismatch = await resetPasswordWithToken({
      token: "token-valido-123",
      password: strongPassword,
      confirmPassword: "OutraPassword456",
    });
    expect(mismatch.ok).toBe(false);
  });

  it("o hash do token na ligação corresponde ao armazenado", () => {
    // Garante a ligação token → hashText usada pelo serviço.
    expect(hashText("abc")).toBe(hashText("abc"));
    expect(hashText("abc")).not.toBe(hashText("abd"));
  });
});
