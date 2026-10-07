import { describe, expect, it } from "vitest";
import { canAssignRole, canChangeManager, hasActiveMembership } from "@/lib/services/membership-rules";
import type { MembershipLike } from "@/lib/services/membership-rules";

const memberships: MembershipLike[] = [
  { userId: "u-admin", role: "SUPER_ADMIN", status: "ACTIVE" },
  { userId: "u-gestor", role: "GESTOR_CLIENTE", status: "ACTIVE" },
  { userId: "u-colab", role: "COLABORADOR", status: "ACTIVE" },
  { userId: "u-suspenso", role: "ANALISTA_SEGURANCA", status: "SUSPENDED" },
];

describe("hasActiveMembership (não duplicar memberships ativos)", () => {
  it("deteta membership ativo existente", () => {
    expect(hasActiveMembership(memberships, "u-colab")).toBe(true);
  });

  it("permite convidar utilizador suspenso (será reativado)", () => {
    expect(hasActiveMembership(memberships, "u-suspenso")).toBe(false);
  });

  it("permite convidar utilizador novo", () => {
    expect(hasActiveMembership(memberships, "u-novo")).toBe(false);
  });
});

describe("canChangeManager (não remover o último GESTOR_CLIENTE)", () => {
  it("bloqueia alterar o último gestor cliente ativo", () => {
    expect(canChangeManager(memberships, "u-gestor")).toBe(false);
  });

  it("permite quando existe outro gestor ativo", () => {
    const withTwoManagers: MembershipLike[] = [
      ...memberships,
      { userId: "u-gestor-2", role: "GESTOR_CLIENTE", status: "ACTIVE" },
    ];
    expect(canChangeManager(withTwoManagers, "u-gestor")).toBe(true);
  });

  it("não se aplica a outros papéis", () => {
    expect(canChangeManager(memberships, "u-colab")).toBe(true);
  });
});

describe("canAssignRole (só SUPER_ADMIN atribui SUPER_ADMIN)", () => {
  it("super admin pode atribuir super admin", () => {
    expect(canAssignRole(["SUPER_ADMIN"], "SUPER_ADMIN")).toBe(true);
  });

  it("gestor cliente não pode atribuir super admin", () => {
    expect(canAssignRole(["GESTOR_CLIENTE"], "SUPER_ADMIN")).toBe(false);
  });

  it("gestor cliente pode atribuir outros papéis", () => {
    expect(canAssignRole(["GESTOR_CLIENTE"], "COLABORADOR")).toBe(true);
    expect(canAssignRole(["GESTOR_CLIENTE"], "ANALISTA_SEGURANCA")).toBe(true);
  });
});
