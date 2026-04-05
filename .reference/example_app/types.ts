export type UserRole = 'ADMIN' | 'ATTENDANT' | 'RESPONSIBLE' | 'SUBSTITUTE' | 'SUPERVISOR';

export type HRSector = 
  | 'Administração de Pessoal (DP)'
  | 'Recrutamento e Seleção (R&S)'
  | 'Jurídico Trabalhista'
  | 'Segurança do Trabalho (SESMT)'
  | 'Benefícios Corporativos'
  | 'Remuneração e Cargos';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  sector?: HRSector; // New: Sector assignment
}

export type RiskLevel = 'OPERATIONAL' | 'CONTRACTUAL' | 'LEGAL' | 'FINANCIAL';

// Strict Governance Statuses added
export type DemandaStatus = 
  | 'OPEN' 
  | 'IN_PROGRESS' 
  | 'BLOCKED' 
  | 'GOVERNANCE_BLOCKED' // New: Specific for compliance failures
  | 'CRITICAL_PENDING'   // New: High risk pending items
  | 'WAITING_VALIDATION' 
  | 'COMPLETED'
  | 'CANCELED';

export type ProcessType = 'FP01_ADMISSAO' | 'FP02_DEMISSAO' | 'FP03_ATENDIMENTO' | 'FP04_PONTO' | 'FP05_FARDAMENTO' | 'FP06_BENEFICIOS';

export type OriginChannel = 'SISTEMA' | 'WHATSAPP' | 'EMAIL' | 'PRESENCIAL' | 'OFICIO' | 'TELEFONE';

export interface ProcessStep {
  id: string;
  label: string;
  required: boolean;
  critical: boolean; // Creates a Critical Alert if missing
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  documentRequired?: boolean;
  documentUrl?: string;
}

export interface DemandaLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
}

// Specific data fields based on Process Type
export interface DemandaData {
  // Common for FP05/FP06
  beneficiaryName?: string;

  // FP 01
  candidateName?: string;
  digitalFolderUrl?: string; // Google Drive
  admissionException?: boolean; // FP01: Started without ASO/Docs
  exceptionReason?: string;
  
  // FP 02
  mpNumber?: string; // Movimentação de Pessoal
  dismissalType?: 'TRABALHADO' | 'INDENIZADO' | 'ANTECIPADO' | 'JUSTA_CAUSA';

  // FP 03
  attendanceSubject?: 'SLRH' | 'MENTORY' | 'PONTO_DIGITAL' | 'EVENTO_ATIPICO' | 'ORIENTACAO';
  resolutionType?: 'INFORMACAO' | 'CORRECAO' | 'ENCAMINHAMENTO'; // FP03 Strict Resolution
  
  // FP 04
  absencyType?: 'ATESTADO' | 'DECLARACAO';
  hoursStart?: string;
  hoursEnd?: string;
  justifiedHours?: string; // Calculated
  uncoveredHours?: string; // Calculated remainder of shift
  
  // FP 05
  uniformItems?: string;
  partialDelivery?: boolean;

  // FP 06
  errorType?: 'ERRO_CADASTRO' | 'ERRO_SISTEMA' | 'ERRO_INFORMACAO' | 'AJUSTE_BENEFICIO';
}

export interface Demanda {
  protocol: string;
  type: ProcessType; 
  title: string;
  description: string;
  status: DemandaStatus;
  risk: RiskLevel;
  channel: OriginChannel; // FP 03 Compliance
  deadline: string;
  createdAt: string;
  completedAt?: string;
  responsibleId: string;
  substituteId: string;
  steps: ProcessStep[];
  logs: DemandaLog[];
  data?: DemandaData; // Flexible data for specific forms
  
  // Manual Derived Demand Fields
  parentProtocol?: string;
  linkedProtocols?: string[];
  targetSector?: string; // New: Sector Target
  impacts?: RiskLevel[]; // New: Multi-select impacts
}

export interface Stats {
  totalOpen: number;
  totalOverdue: number;
  totalCritical: number;
  totalBlocked: number;
}
