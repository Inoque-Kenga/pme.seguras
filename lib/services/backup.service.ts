import { z } from "zod";
import { BackupFrequency, BackupJobStatus, Prisma, VerificationResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log.service";
import { err, ok, type Result } from "@/lib/services/errors";
import type { OrganizationContext } from "@/lib/current-organization";

export const BACKUP_EDITOR_ROLES = ["ANALISTA_SEGURANCA", "GESTOR_CLIENTE"];

export function canEditBackups(role: string): boolean {
  return BACKUP_EDITOR_ROLES.includes(role);
}

export const backupInputSchema = z.object({
  sistemaAtivo: z.string().trim().min(2, "Indique o sistema protegido.").max(160),
  fornecedor: z.string().trim().max(120).optional().or(z.literal("")),
  frequencia: z.nativeEnum(BackupFrequency),
  ultimaExecucao: z.string().optional().or(z.literal("")),
  estado: z.nativeEnum(BackupJobStatus),
  tamanhoGB: z.coerce.number().min(0).max(1000000).optional().or(z.literal("")),
  localizacao: z.string().trim().max(120).optional().or(z.literal("")),
  retencaoDias: z.coerce.number().int().min(1).max(3650).optional().or(z.literal("")),
  rtoHoras: z.coerce.number().int().min(0).max(8760).optional().or(z.literal("")),
  rpoHoras: z.coerce.number().int().min(0).max(8760).optional().or(z.literal("")),
  ultimoTesteRestauracao: z.string().optional().or(z.literal("")),
  notas: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type BackupInput = z.infer<typeof backupInputSchema>;

export const verificationInputSchema = z.object({
  dataTeste: z.string().min(1, "Indique a data do teste."),
  resultado: z.nativeEnum(VerificationResult),
  detalhes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type BackupListParams = {
  estado?: BackupJobStatus;
  fornecedor?: string;
  frequencia?: BackupFrequency;
  page?: number;
  pageSize?: number;
};

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export async function listBackups(organizationId: string, params: BackupListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 12));

  const where: Prisma.BackupJobWhereInput = { organizationId };
  if (params.estado) where.estado = params.estado;
  if (params.fornecedor) where.fornecedor = { contains: params.fornecedor, mode: "insensitive" };
  if (params.frequencia) where.frequencia = params.frequencia;

  const [items, total] = await Promise.all([
    prisma.backupJob.findMany({
      where,
      include: { _count: { select: { verifications: true } } },
      orderBy: [{ estado: "desc" }, { sistemaAtivo: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.backupJob.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getBackup(organizationId: string, backupId: string) {
  return prisma.backupJob.findFirst({
    where: { id: backupId, organizationId },
    include: { verifications: { orderBy: { dataTeste: "desc" } } },
  });
}

/** Indicadores: falhas nos últimos 7 dias, sem teste de restauração há +30 dias, desconhecidos. */
export async function getBackupIndicators(organizationId: string, now = new Date()) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [recentFailures, untested, unknown] = await Promise.all([
    prisma.backupJob.count({
      where: { organizationId, estado: "FALHA", ultimaExecucao: { gte: sevenDaysAgo } },
    }),
    prisma.backupJob.count({
      where: {
        organizationId,
        OR: [{ ultimoTesteRestauracao: null }, { ultimoTesteRestauracao: { lt: thirtyDaysAgo } }],
      },
    }),
    prisma.backupJob.count({ where: { organizationId, estado: "DESCONHECIDO" } }),
  ]);

  return { recentFailures, untested, unknown };
}

export type Semaphore = "verde" | "amarelo" | "vermelho";

/**
 * Semáforo de saúde de um backup (função pura):
 * - vermelho: falha na última execução ou estado desconhecido;
 * - amarelo: aviso, sem teste de restauração recente, ou execução em atraso;
 * - verde: restante.
 */
export function backupSemaphore(
  job: { estado: BackupJobStatus; ultimaExecucao: Date | null; ultimoTesteRestauracao: Date | null; frequencia: BackupFrequency },
  now = new Date(),
): Semaphore {
  if (job.estado === "FALHA" || job.estado === "DESCONHECIDO") return "vermelho";
  if (job.estado === "AVISO") return "amarelo";

  const frequencyDays: Record<BackupFrequency, number> = { DIARIA: 2, SEMANAL: 9, MENSAL: 33, OUTRA: 33 };
  if (!job.ultimaExecucao) return "amarelo";
  const ageDays = (now.getTime() - job.ultimaExecucao.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > frequencyDays[job.frequencia]) return "amarelo";

  if (!job.ultimoTesteRestauracao) return "amarelo";
  const testAgeDays = (now.getTime() - job.ultimoTesteRestauracao.getTime()) / (1000 * 60 * 60 * 24);
  if (testAgeDays > 30) return "amarelo";

  return "verde";
}

function toData(input: BackupInput) {
  return {
    sistemaAtivo: input.sistemaAtivo,
    fornecedor: input.fornecedor || null,
    frequencia: input.frequencia,
    ultimaExecucao: input.ultimaExecucao ? new Date(input.ultimaExecucao) : null,
    estado: input.estado,
    tamanhoGB: typeof input.tamanhoGB === "number" ? input.tamanhoGB : null,
    localizacao: input.localizacao || null,
    retencaoDias: typeof input.retencaoDias === "number" ? input.retencaoDias : null,
    rtoHoras: typeof input.rtoHoras === "number" ? input.rtoHoras : null,
    rpoHoras: typeof input.rpoHoras === "number" ? input.rpoHoras : null,
    ultimoTesteRestauracao: input.ultimoTesteRestauracao ? new Date(input.ultimoTesteRestauracao) : null,
    notas: input.notas || null,
  };
}

export async function createBackup(
  ctx: OrganizationContext,
  actorId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  if (!canEditBackups(ctx.role)) return err("FORBIDDEN", "O seu papel não permite registar backups.");

  const parsed = backupInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const backup = await prisma.backupJob.create({
    data: { organizationId: ctx.organization.id, ...toData(parsed.data) },
  });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "backup_job",
    resourceId: backup.id,
  });
  return ok({ id: backup.id });
}

export async function updateBackup(
  ctx: OrganizationContext,
  actorId: string,
  backupId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditBackups(ctx.role)) return err("FORBIDDEN", "O seu papel não permite editar backups.");

  const parsed = backupInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.backupJob.findUnique({ where: { id: backupId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Backup não encontrado.");

  await prisma.backupJob.update({ where: { id: backupId }, data: toData(parsed.data) });
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "UPDATE",
    resource: "backup_job",
    resourceId: backupId,
  });
  return ok(undefined);
}

/** Regista um teste de restauração e atualiza ultimoTesteRestauracao do backup. */
export async function addVerification(
  ctx: OrganizationContext,
  actorId: string,
  backupId: string,
  input: unknown,
): Promise<Result> {
  if (!canEditBackups(ctx.role)) return err("FORBIDDEN", "O seu papel não permite registar verificações.");

  const parsed = verificationInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", firstIssue(parsed.error));

  const existing = await prisma.backupJob.findUnique({ where: { id: backupId }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== ctx.organization.id) return err("NOT_FOUND", "Backup não encontrado.");

  await prisma.$transaction([
    prisma.backupVerification.create({
      data: {
        backupJobId: backupId,
        dataTeste: new Date(parsed.data.dataTeste),
        resultado: parsed.data.resultado,
        detalhes: parsed.data.detalhes || null,
      },
    }),
    prisma.backupJob.update({
      where: { id: backupId },
      data: { ultimoTesteRestauracao: new Date(parsed.data.dataTeste) },
    }),
  ]);
  await writeAuditLog({
    actorId,
    organizationId: ctx.organization.id,
    action: "CREATE",
    resource: "backup_verification",
    resourceId: backupId,
    metadata: { resultado: parsed.data.resultado },
  });
  return ok(undefined);
}
