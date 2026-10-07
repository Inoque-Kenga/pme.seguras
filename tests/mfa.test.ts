import { beforeEach, describe, expect, it, vi } from "vitest";
import { generate, generateSecret } from "otplib";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { hashBackupCode, totpCodeSchema, verifyLoginMfa, verifyTotpCode } from "@/lib/services/mfa.service";
import { encryptText } from "@/lib/crypto";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "segredo-de-teste-com-pelo-mente-32-caracteres";
});

describe("TOTP", () => {
  it("valida códigos gerados com o mesmo segredo e rejeita códigos errados", async () => {
    const secret = generateSecret();
    const token = await generate({ secret });

    expect(await verifyTotpCode(secret, token)).toBe(true);
    expect(await verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("schema exige exatamente 6 dígitos", () => {
    expect(totpCodeSchema.safeParse("123456").success).toBe(true);
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    expect(totpCodeSchema.safeParse("abcdef").success).toBe(false);
  });
});

describe("Códigos de backup", () => {
  it("hash é determinístico e insensível a maiúsculas/espaços", () => {
    expect(hashBackupCode("abcd-1234")).toBe(hashBackupCode(" ABCD-1234 "));
    expect(hashBackupCode("abcd-1234")).not.toBe(hashBackupCode("abcd-1235"));
  });

  it("código de backup válido é consumido (uso único); inválido falha", async () => {
    const code = "ABCD-1234";
    const secret = generateSecret();
    mocks.userFindUnique.mockResolvedValue({
      mfaEnabled: true,
      mfaSecret: encryptText(secret),
      mfaBackupCodes: JSON.stringify([hashBackupCode(code)]),
    });
    mocks.userUpdate.mockResolvedValue({});

    const first = await verifyLoginMfa("user-1", code);
    expect(first).toBe(true);
    expect(mocks.userUpdate).toHaveBeenCalledOnce(); // código removido

    // Segunda utilização: lista já sem o código.
    mocks.userFindUnique.mockResolvedValue({
      mfaEnabled: true,
      mfaSecret: encryptText(secret),
      mfaBackupCodes: JSON.stringify([]),
    });
    const second = await verifyLoginMfa("user-1", code);
    expect(second).toBe(false);
  });

  it("login MFA aceita um TOTP válido", async () => {
    const secret = generateSecret();
    mocks.userFindUnique.mockResolvedValue({
      mfaEnabled: true,
      mfaSecret: encryptText(secret),
      mfaBackupCodes: JSON.stringify([]),
    });

    const result = await verifyLoginMfa("user-1", await generate({ secret }));
    expect(result).toBe(true);
  });

  it("login MFA falha sem MFA ativo", async () => {
    mocks.userFindUnique.mockResolvedValue({ mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null });
    expect(await verifyLoginMfa("user-1", "123456")).toBe(false);
  });
});
