import type {
  AssetStatus,
  AssetType,
  AssessmentStatus,
  BackupFrequency,
  BackupJobStatus,
  Criticality,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MembershipStatus,
  OrganizationSize,
  OrganizationStatus,
  PhishingCampaignStatus,
  PhishingChannel,
  PhishingClassification,
  PhishingReportStatus,
  Priority,
  RiskLevel,
  RiskStatus,
  Role,
  ScoreCategory,
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

export const scoreCategoryLabels: Record<ScoreCategory, string> = {
  CRITICO: "Crítico",
  EM_RISCO: "Em risco",
  ACEITAVEL: "Aceitável",
  BOM: "Bom",
};

export const scoreCategoryTones: Record<ScoreCategory, Tone> = {
  CRITICO: "red",
  EM_RISCO: "amber",
  ACEITAVEL: "blue",
  BOM: "green",
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

export const backupFrequencyLabels: Record<BackupFrequency, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  OUTRA: "Outra",
};

export const backupJobStatusLabels: Record<BackupJobStatus, string> = {
  SUCESSO: "Sucesso",
  FALHA: "Falha",
  AVISO: "Aviso",
  DESCONHECIDO: "Desconhecido",
};

export const backupJobStatusTones: Record<BackupJobStatus, Tone> = {
  SUCESSO: "green",
  FALHA: "red",
  AVISO: "amber",
  DESCONHECIDO: "slate",
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  ABERTO: "Aberto",
  EM_ANALISE: "Em análise",
  EM_ANDAMENTO: "Em andamento",
  AGUARDA_CLIENTE: "Aguarda cliente",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado",
};

export const ticketStatusTones: Record<TicketStatus, Tone> = {
  ABERTO: "amber",
  EM_ANALISE: "blue",
  EM_ANDAMENTO: "blue",
  AGUARDA_CLIENTE: "purple",
  RESOLVIDO: "green",
  FECHADO: "slate",
};

export const ticketCategoryLabels: Record<TicketCategory, string> = {
  SUPORTE: "Suporte",
  INCIDENTE: "Incidente",
  SOLICITACAO: "Solicitação",
  OUTRO: "Outro",
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

export const incidentTypeLabels: Record<IncidentType, string> = {
  PHISHING: "Phishing",
  MALWARE: "Malware",
  RANSOMWARE: "Ransomware",
  CONTA_COMPROMETIDA: "Conta comprometida",
  PERDA_ROUBO_EQUIPAMENTO: "Perda/roubo de equipamento",
  ACESSO_INDEVIDO: "Acesso indevido",
  FRAUDE: "Fraude",
  INDISPONIBILIDADE: "Indisponibilidade",
  OUTRO: "Outro",
};

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  REPORTADO: "Reportado",
  EM_ANALISE: "Em análise",
  CONTIDO: "Contido",
  ERRADICADO: "Erradicado",
  RECUPERADO: "Recuperado",
  ENCERRADO: "Encerrado",
};

export const incidentStatusTones: Record<IncidentStatus, Tone> = {
  REPORTADO: "red",
  EM_ANALISE: "amber",
  CONTIDO: "blue",
  ERRADICADO: "purple",
  RECUPERADO: "green",
  ENCERRADO: "slate",
};

export const phishingChannelLabels: Record<PhishingChannel, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  OUTRO: "Outro",
};

export const phishingClassificationLabels: Record<PhishingClassification, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
};

export const phishingClassificationTones: Record<PhishingClassification, Tone> = {
  BAIXA: "slate",
  MEDIA: "amber",
  ALTA: "red",
};

export const phishingReportStatusLabels: Record<PhishingReportStatus, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  CONVERTIDO_TICKET: "Convertido em ticket",
  CONVERTIDO_INCIDENTE: "Convertido em incidente",
  FALSO_POSITIVO: "Falso positivo",
  ENCERRADO: "Encerrado",
};

export const phishingReportStatusTones: Record<PhishingReportStatus, Tone> = {
  NOVO: "amber",
  EM_ANALISE: "blue",
  CONVERTIDO_TICKET: "purple",
  CONVERTIDO_INCIDENTE: "red",
  FALSO_POSITIVO: "slate",
  ENCERRADO: "green",
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
