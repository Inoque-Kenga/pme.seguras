import type {
  AssetStatus,
  AssetType,
  AssessmentStatus,
  BackupStatus,
  Criticality,
  IncidentSeverity,
  IncidentStatus,
  MembershipStatus,
  OrganizationSize,
  OrganizationStatus,
  PhishingCampaignStatus,
  Priority,
  RiskLevel,
  RiskStatus,
  Role,
  TicketCategory,
  TicketStatus,
  TreatmentTaskStatus,
} from "@prisma/client";

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "purple";

export const organizationSizeLabels: Record<OrganizationSize, string> = {
  MICRO: "Micro",
  PEQUENA: "Pequena",
  MEDIA: "Média",
  GRANDE: "Grande",
};

export const organizationStatusLabels: Record<OrganizationStatus, string> = {
  ACTIVE: "Ativa",
  ARCHIVED: "Arquivada",
};

export const organizationStatusTones: Record<OrganizationStatus, Tone> = {
  ACTIVE: "green",
  ARCHIVED: "slate",
};

export const membershipStatusLabels: Record<MembershipStatus, string> = {
  ACTIVE: "Ativo",
  INVITED: "Convidado",
  SUSPENDED: "Suspenso",
};

export const membershipStatusTones: Record<MembershipStatus, Tone> = {
  ACTIVE: "green",
  INVITED: "blue",
  SUSPENDED: "amber",
};

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super administrador",
  ANALISTA_SEGURANCA: "Analista de segurança",
  GESTOR_CLIENTE: "Gestor cliente",
  COLABORADOR: "Colaborador",
};

export const assetTypeLabels: Record<AssetType, string> = {
  HARDWARE: "Hardware",
  SOFTWARE: "Software",
  DATA: "Dados",
  SERVICE: "Serviço",
  NETWORK: "Rede",
  PEOPLE: "Pessoas",
};

export const assetStatusLabels: Record<AssetStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  UNDER_MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
  RETIRED: "Descartado",
};

export const assetStatusTones: Record<AssetStatus, Tone> = {
  ACTIVE: "green",
  INACTIVE: "slate",
  UNDER_MAINTENANCE: "amber",
  LOST: "red",
  RETIRED: "slate",
};

export const criticalityLabels: Record<Criticality, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const criticalityTones: Record<Criticality, Tone> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  CRITICAL: "red",
};

export const assessmentStatusLabels: Record<AssessmentStatus, string> = {
  RASCUNHO: "Rascunho",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const assessmentStatusTones: Record<AssessmentStatus, Tone> = {
  RASCUNHO: "slate",
  EM_ANDAMENTO: "blue",
  CONCLUIDA: "green",
};

export const riskLevelLabels: Record<RiskLevel, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export const riskLevelTones: Record<RiskLevel, Tone> = {
  BAIXO: "green",
  MEDIO: "amber",
  ALTO: "red",
  CRITICO: "red",
};

export const riskStatusLabels: Record<RiskStatus, string> = {
  ABERTO: "Aberto",
  EM_TRATAMENTO: "Em tratamento",
  ACEITE: "Aceite",
  MITIGADO: "Mitigado",
  FECHADO: "Fechado",
};

export const riskStatusTones: Record<RiskStatus, Tone> = {
  ABERTO: "red",
  EM_TRATAMENTO: "blue",
  ACEITE: "purple",
  MITIGADO: "green",
  FECHADO: "slate",
};

export const treatmentTaskStatusLabels: Record<TreatmentTaskStatus, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const treatmentTaskStatusTones: Record<TreatmentTaskStatus, Tone> = {
  NAO_INICIADA: "amber",
  EM_ANDAMENTO: "blue",
  CONCLUIDA: "green",
  CANCELADA: "slate",
};

export const priorityLabels: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const priorityTones: Record<Priority, Tone> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export const backupStatusLabels: Record<BackupStatus, string> = {
  SUCCESS: "Com sucesso",
  FAILED: "Falhado",
  RUNNING: "Em execução",
  OVERDUE: "Em atraso",
};

export const backupStatusTones: Record<BackupStatus, Tone> = {
  SUCCESS: "green",
  FAILED: "red",
  RUNNING: "blue",
  OVERDUE: "amber",
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em curso",
  WAITING_CLIENT: "A aguardar cliente",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

export const ticketStatusTones: Record<TicketStatus, Tone> = {
  OPEN: "amber",
  IN_PROGRESS: "blue",
  WAITING_CLIENT: "purple",
  RESOLVED: "green",
  CLOSED: "slate",
};

export const ticketCategoryLabels: Record<TicketCategory, string> = {
  INCIDENT: "Incidente",
  REQUEST: "Pedido",
  VULNERABILITY: "Vulnerabilidade",
  CHANGE: "Alteração",
  OTHER: "Outro",
};

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const incidentSeverityTones: Record<IncidentSeverity, Tone> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  CRITICAL: "red",
};

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  DETECTED: "Detetado",
  INVESTIGATING: "Em investigação",
  CONTAINED: "Contido",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

export const incidentStatusTones: Record<IncidentStatus, Tone> = {
  DETECTED: "red",
  INVESTIGATING: "amber",
  CONTAINED: "blue",
  RESOLVED: "green",
  CLOSED: "slate",
};

export const phishingStatusLabels: Record<PhishingCampaignStatus, string> = {
  DRAFT: "Rascunho",
  RUNNING: "Em curso",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const phishingStatusTones: Record<PhishingCampaignStatus, Tone> = {
  DRAFT: "slate",
  RUNNING: "blue",
  COMPLETED: "green",
  CANCELLED: "amber",
};
