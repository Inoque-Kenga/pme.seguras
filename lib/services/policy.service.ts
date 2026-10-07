import { z } from "zod";
import { PolicyCategory, PolicyStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

export const POLICY_EDITOR_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canEditPolicies(role: string): boolean {
  return POLICY_EDITOR_ROLES.includes(role);
}

/** Categorias chave para a pontuação de "Resposta a incidentes e políticas". */
export const KEY_POLICY_CATEGORIES: PolicyCategory[] = ["PASSWORDS", "RESPOSTA_INCIDENTES", "USO_ACEITAVEL"];

export const policyInputSchema = z.object({
  title: z.string().trim().min(3, "Indique o título da política.").max(160),
  content: z.string().trim().min(20, "O conteúdo deve ter pelo menos 20 caracteres.").max(50000),
  category: z.nativeEnum(PolicyCategory),
  status: z.nativeEnum(PolicyStatus),
});

export type PolicyInput = z.infer<typeof policyInputSchema>;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** COLABORADOR vê apenas políticas publicadas; editores veem todas. */
export async function listPolicies(
  organizationId: string,
  viewerRole: string,
  params: { category?: PolicyCategory; status?: PolicyStatus } = {},
) {
  const where: Prisma.SecurityPolicyWhereInput = { organizationId };
  if (!canEditPolicies(viewerRole)) where.status = "PUBLICADA";
  else if (params.status) where.status = params.status;
  if (params.category) where.category = params.category;

  return prisma.securityPolicy.findMany({
    where,
    include: {
      author: { select: { name: true } },
      _count: { select: { versions: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getPolicy(organizationId: string, policyId: string, viewerRole: string) {
  const policy = await prisma.securityPolicy.findFirst({
    where: { id: policyId, organizationId },
    include: {
      author: { select: { name: true } },
      versions: {
        include: { author: { select: { name: true } } },
        orderBy: { version: "desc" },
      },
    },
  });
  if (!policy) return null;
  if (!canEditPolicies(viewerRole) && policy.status !== "PUBLICADA") return null;
  return policy;
}

function toData(input: PolicyInput) {
  return {
    title: input.title,
    content: input.content,
    category: input.category,
    status: input.status,
  };
}

export async function createPolicy(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canEditPolicies(ctx.role)) return err("FORBIDDEN", "O seu papel não permite criar políticas.");

  const parsed = policyInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const policy = await prisma.securityPolicy.create({
    data: {
      organizationId: ctx.organization.id,
      ...toData(parsed.data),
      authorId: actorId,
      publishedAt: parsed.data.status === "PUBLICADA" ? new Date() : null,
    },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "security_policy",
    resourceId: policy.id,
    metadata: { category: policy.category, status: policy.status },
  });
  return ok({ id: policy.id });
}

/**
 * Edita uma política. Se estiver PUBLICADA, a versão atual é arquivada no
 * histórico e a política passa à versão seguinte.
 */
export async function updatePolicy(
  ctx: OrganizationContext,
  actorId: string,
  policyId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditPolicies(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar políticas.");

  const parsed = policyInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.securityPolicy.findUnique({ where: { id: policyId } });
  if (!existing || existing.organizationId !== ctx.organization.id) {
    return err("NOT_FOUND", "Política não encontrada.");
  }

  const wasPublished = existing.status === "PUBLICADA";
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  if (wasPublished) {
    operations.push(
      prisma.policyVersion.create({
        data: {
          policyId,
          version: existing.version,
          title: existing.title,
          content: existing.content,
          authorId: existing.authorId,
        },
      }),
    );
  }
  const becomesPublished = parsed.data.status === "PUBLICADA";
  operations.push(
    prisma.securityPolicy.update({
      where: { id: policyId },
      data: {
        ...toData(parsed.data),
        authorId: actorId,
        version: wasPublished ? existing.version + 1 : existing.version,
        publishedAt: becomesPublished ? new Date() : existing.publishedAt,
      },
    }),
  );
  await prisma.$transaction(operations);

  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: becomesPublished && !wasPublished ? "STATUS_CHANGE" : "UPDATE",
    resource: "security_policy",
    resourceId: policyId,
    metadata: { status: parsed.data.status, version: wasPublished ? existing.version + 1 : existing.version },
  });
  return ok(undefined);
}

export async function setPolicyStatus(
  ctx: OrganizationContext,
  actorId: string,
  policyId: string,
  status: PolicyStatus,
): Promise<Result> {
  if (!canEditPolicies(ctx.role)) return err("FORBIDDEN", "O seu papel não permite alterar políticas.");

  const existing = await prisma.securityPolicy.findUnique({ where: { id: policyId } });
  if (!existing || existing.organizationId !== ctx.organization.id) {
    return err("NOT_FOUND", "Política não encontrada.");
  }

  await prisma.securityPolicy.update({
    where: { id: policyId },
    data: { status, publishedAt: status === "PUBLICADA" && !existing.publishedAt ? new Date() : existing.publishedAt },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "STATUS_CHANGE",
    resource: "security_policy",
    resourceId: policyId,
    metadata: { status },
  });
  return ok(undefined);
}

/** Políticas publicadas em categorias chave (para o score). */
export async function countKeyPublishedPolicies(organizationId: string): Promise<number> {
  return prisma.securityPolicy.count({
    where: { organizationId, status: "PUBLICADA", category: { in: KEY_POLICY_CATEGORIES } },
  });
}
