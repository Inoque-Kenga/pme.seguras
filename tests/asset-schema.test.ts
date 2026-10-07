import { describe, expect, it } from "vitest";
import { assetInputSchema } from "@/lib/services/asset.service";

const validInput = {
  name: "Servidor de registos clínicos",
  type: "HARDWARE",
  marcaModelo: "Dell PowerEdge T350",
  numeroSerie: "DEMO-SN-0001",
  sistemaOperativo: "Windows Server 2022",
  ip: "192.168.10.5",
  location: "Sala técnica",
  owner: "TI interno",
  criticality: "CRITICAL",
  status: "ACTIVE",
  protecaoEndpoint: true,
  ultimaAtualizacao: "2026-10-01",
  mfaAplicavel: true,
  cifragem: true,
  description: "Servidor principal (demonstração).",
};

describe("assetInputSchema", () => {
  it("aceita um ativo válido completo", () => {
    const result = assetInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("aceita apenas os campos obrigatórios", () => {
    const result = assetInputSchema.safeParse({
      name: "Portátil",
      type: "HARDWARE",
      criticality: "LOW",
      status: "ACTIVE",
      protecaoEndpoint: false,
      mfaAplicavel: false,
      cifragem: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita endereço IP inválido", () => {
    expect(assetInputSchema.safeParse({ ...validInput, ip: "999.999.1.1.1" }).success).toBe(false);
    expect(assetInputSchema.safeParse({ ...validInput, ip: "nao-e-ip" }).success).toBe(false);
  });

  it("rejeita tipo fora do enum", () => {
    const result = assetInputSchema.safeParse({ ...validInput, type: "VEICULO" });
    expect(result.success).toBe(false);
  });

  it("rejeita criticidade fora do enum", () => {
    const result = assetInputSchema.safeParse({ ...validInput, criticality: "ALTissima" });
    expect(result.success).toBe(false);
  });

  it("converte booleans a partir de formulários (coerce)", () => {
    const result = assetInputSchema.safeParse({ ...validInput, protecaoEndpoint: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.protecaoEndpoint).toBe(true);
  });
});
