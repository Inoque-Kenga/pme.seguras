import { describe, expect, it } from "vitest";
import { organizationInputSchema } from "@/lib/services/organization.service";

const validInput = {
  name: "Clínica Vida Segura",
  slug: "clinica-vida-segura",
  nif: "5000123456",
  sector: "Saúde",
  dimensao: "PEQUENA",
  city: "Luanda",
  provincia: "Luanda",
  contactoNome: "Dra. Marta Fictícia",
  contactoEmail: "contacto@clinica.demo",
  contactoTelefone: "+244 900 000 001",
  planoId: "",
};

describe("organizationInputSchema", () => {
  it("aceita uma organização válida completa", () => {
    const result = organizationInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("aceita apenas os campos obrigatórios (nome e slug)", () => {
    const result = organizationInputSchema.safeParse({ name: "Academia", slug: "academia" });
    expect(result.success).toBe(true);
  });

  it("rejeita nome demasiado curto", () => {
    const result = organizationInputSchema.safeParse({ ...validInput, name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejeita slug com maiúsculas ou espaços", () => {
    expect(organizationInputSchema.safeParse({ ...validInput, slug: "Clinica Vida" }).success).toBe(false);
    expect(organizationInputSchema.safeParse({ ...validInput, slug: "CLINICA" }).success).toBe(false);
  });

  it("rejeita e-mail de contacto inválido", () => {
    const result = organizationInputSchema.safeParse({ ...validInput, contactoEmail: "nao-e-email" });
    expect(result.success).toBe(false);
  });

  it("rejeita dimensão fora do enum", () => {
    const result = organizationInputSchema.safeParse({ ...validInput, dimensao: "ENORME" });
    expect(result.success).toBe(false);
  });
});
