import type { UserRole } from '@/lib/services/govsys'

export type ProcessType =
  | 'FP01_ADMISSAO'
  | 'FP02_DEMISSAO'
  | 'FP03_ATENDIMENTO'
  | 'FP04_PONTO'
  | 'FP05_FARDAMENTO'
  | 'FP06_BENEFICIOS'

export type RiskLevel = 'LEGAL' | 'CONTRACTUAL' | 'OPERATIONAL' | 'FINANCIAL'
export type OriginChannel =
  | 'SISTEMA'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'PRESENCIAL'
  | 'OFICIO'
  | 'TELEFONE'

export type GovernanceLog = {
  id: string
  demandaId: string
  timestamp: string
  userId: string
  userName: string
  userRole: UserRole
  action: string
  details?: string
  severity?: 'INFO' | 'CRITICAL'
}

export type GovernanceMeta = {
  demandaId: string
  processType?: ProcessType
  risk?: RiskLevel
  impacts?: RiskLevel[]
  channel?: OriginChannel
  deadline?: string | null
  localStepState?: Record<
    string,
    {
      completed: boolean
      completedAt?: string
      completedBy?: string
      completedById?: string
    }
  >
  processData?: {
    title?: string
    description?: string
    candidateName?: string
    beneficiaryName?: string
    mpNumber?: string
    dismissalType?: string
    attendanceSubject?: string
    immediateResolution?: boolean
    resolutionType?: string
    absencyType?: string
    hoursStart?: string
    hoursEnd?: string
    uniformItems?: string
    errorType?: string
  }
  parentDemandaId?: string | null
  childDemandaIds?: string[]
  canceledReason?: string | null
  overrideReasons?: string[]
}

const META_KEY = 'govsys.governance.meta.v1'
const LOGS_KEY = 'govsys.governance.logs.v1'

const DEFAULT_META: Omit<GovernanceMeta, 'demandaId'> = {
  processType: undefined,
  risk: undefined,
  impacts: [],
  channel: 'SISTEMA',
  deadline: null,
  localStepState: {},
  processData: {},
  parentDemandaId: null,
  childDemandaIds: [],
  canceledReason: null,
  overrideReasons: [],
}

export type ProcessTemplateStep = {
  id: string
  label: string
  required: boolean
  critical: boolean
  documentRequired: boolean
}

export const PROCESS_TEMPLATES: Record<
  ProcessType,
  {
    title: string
    risk: RiskLevel
    mandatoryImpacts: RiskLevel[]
    slaHours: number
    steps: ProcessTemplateStep[]
  }
> = {
  FP01_ADMISSAO: {
    title: 'FP 01 - Admissao de Colaboradores',
    risk: 'LEGAL',
    mandatoryImpacts: ['LEGAL', 'OPERATIONAL'],
    slaHours: 24,
    steps: [
      { id: 's1', label: 'Coleta Kit Documental (RG, CPF, End., CTPS)', required: true, critical: true, documentRequired: true },
      { id: 's2', label: 'ASO Admissional (Bloqueante)', required: true, critical: true, documentRequired: true },
      { id: 's3', label: 'Qualificacao Cadastral eSocial', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Assinatura do Contrato de Trabalho', required: true, critical: true, documentRequired: true },
      { id: 's5', label: 'Assinatura da Ficha de Registro', required: true, critical: true, documentRequired: true },
      { id: 's6', label: 'Inclusao no Relogio de Ponto', required: true, critical: false, documentRequired: false },
    ],
  },
  FP02_DEMISSAO: {
    title: 'FP 02 - Demissao / Desligamento',
    risk: 'LEGAL',
    mandatoryImpacts: ['LEGAL', 'FINANCIAL', 'CONTRACTUAL'],
    slaHours: 240,
    steps: [
      { id: 's1', label: 'Analise da MP (Restrito Supervisor)', required: true, critical: true, documentRequired: true },
      { id: 's2', label: 'Emissao do TRCT e Guias', required: true, critical: true, documentRequired: true },
      { id: 's3', label: 'ASO Demissional (Obrigatorio)', required: true, critical: true, documentRequired: true },
      { id: 's4', label: 'Calculo de Verbas (Art. 477)', required: true, critical: true, documentRequired: false },
      { id: 's5', label: 'Comprovante de Pagamento', required: true, critical: true, documentRequired: true },
      { id: 's6', label: 'Envio do Evento S-2299 (eSocial)', required: true, critical: true, documentRequired: false },
    ],
  },
  FP03_ATENDIMENTO: {
    title: 'FP 03 - Atendimento ao Colaborador',
    risk: 'OPERATIONAL',
    mandatoryImpacts: ['OPERATIONAL'],
    slaHours: 48,
    steps: [
      { id: 's1', label: 'Registro do Protocolo (Axioma de Registro)', required: true, critical: true, documentRequired: false },
      { id: 's2', label: 'Classificacao de Risco e Prioridade', required: true, critical: false, documentRequired: false },
      { id: 's3', label: 'Tratativa / Resolucao no Sistema', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Confirmacao / Ciencia do Colaborador', required: true, critical: false, documentRequired: false },
    ],
  },
  FP04_PONTO: {
    title: 'FP 04 - Ponto e Justificativas Medicas',
    risk: 'OPERATIONAL',
    mandatoryImpacts: ['OPERATIONAL', 'FINANCIAL'],
    slaHours: 48,
    steps: [
      { id: 's1', label: 'Recebimento do Original (Fisico/Digital)', required: true, critical: false, documentRequired: true },
      { id: 's2', label: 'Validacao (CID, Datas, Carimbo Medico)', required: true, critical: true, documentRequired: false },
      { id: 's3', label: 'Calculo de Horas Abonadas vs Descobertas', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Lancamento no Sistema de Ponto', required: true, critical: true, documentRequired: false },
      { id: 's5', label: 'Arquivamento na Pasta Digital', required: true, critical: false, documentRequired: false },
    ],
  },
  FP05_FARDAMENTO: {
    title: 'FP 05 - Fardamento e Materiais',
    risk: 'CONTRACTUAL',
    mandatoryImpacts: ['CONTRACTUAL', 'FINANCIAL'],
    slaHours: 120,
    steps: [
      { id: 's1', label: 'Verificacao de Estoque e Tamanhos', required: true, critical: false, documentRequired: false },
      { id: 's2', label: 'Separacao e Montagem do Kit', required: true, critical: false, documentRequired: false },
      { id: 's3', label: 'Assinatura do Termo de Entrega', required: true, critical: true, documentRequired: true },
      { id: 's4', label: 'Baixa no Controle de Estoque', required: true, critical: true, documentRequired: false },
    ],
  },
  FP06_BENEFICIOS: {
    title: 'FP 06 - Beneficios e Sistemas',
    risk: 'FINANCIAL',
    mandatoryImpacts: ['FINANCIAL', 'OPERATIONAL'],
    slaHours: 72,
    steps: [
      { id: 's1', label: 'Diagnostico (Causa Raiz)', required: true, critical: true, documentRequired: false },
      { id: 's2', label: 'Correcao no Portal/Sistema', required: true, critical: true, documentRequired: false },
      { id: 's3', label: 'Validacao do Ajuste (Conferencia)', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Comunicacao ao Colaborador', required: true, critical: true, documentRequired: false },
    ],
  },
}

export function listGovernanceMeta(): Record<string, GovernanceMeta> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(META_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, GovernanceMeta>
  } catch {
    return {}
  }
}

export function getGovernanceMeta(demandaId: string): GovernanceMeta {
  const all = listGovernanceMeta()
  return (
    all[demandaId] ?? {
      demandaId,
      ...DEFAULT_META,
    }
  )
}

export function saveGovernanceMeta(demandaId: string, partial: Partial<GovernanceMeta>): GovernanceMeta {
  if (typeof window === 'undefined') {
    return {
      demandaId,
      ...DEFAULT_META,
      ...partial,
    }
  }

  const all = listGovernanceMeta()
  const current = getGovernanceMeta(demandaId)
  const merged = {
    ...current,
    ...partial,
    demandaId,
  }
  all[demandaId] = merged
  window.localStorage.setItem(META_KEY, JSON.stringify(all))
  return merged
}

export function setLocalStepState(
  demandaId: string,
  stepId: string,
  completed: boolean,
  actor?: { userId?: string; userName?: string }
): GovernanceMeta {
  const current = getGovernanceMeta(demandaId)
  const state = { ...(current.localStepState ?? {}) }

  if (!completed) {
    delete state[stepId]
  } else {
    state[stepId] = {
      completed: true,
      completedAt: new Date().toISOString(),
      completedBy: actor?.userName,
      completedById: actor?.userId,
    }
  }

  return saveGovernanceMeta(demandaId, { localStepState: state })
}

export function linkDerivedDemand(parentDemandaId: string, childDemandaId: string): void {
  const parent = getGovernanceMeta(parentDemandaId)
  const children = new Set(parent.childDemandaIds ?? [])
  children.add(childDemandaId)

  saveGovernanceMeta(parentDemandaId, {
    childDemandaIds: Array.from(children),
  })
  saveGovernanceMeta(childDemandaId, {
    parentDemandaId,
  })
}

export function listGovernanceLogs(): GovernanceLog[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(LOGS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as GovernanceLog[]
  } catch {
    return []
  }
}

export function listDemandLogs(demandaId: string): GovernanceLog[] {
  return listGovernanceLogs()
    .filter((log) => log.demandaId === demandaId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function appendGovernanceLog(
  payload: Omit<GovernanceLog, 'id' | 'timestamp'> & { timestamp?: string }
): GovernanceLog {
  const current: GovernanceLog[] = listGovernanceLogs()
  const log: GovernanceLog = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    ...payload,
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOGS_KEY, JSON.stringify([log, ...current]))
  }
  return log
}

export function inferTypeFromProcessName(processName?: string | null): ProcessType | undefined {
  const n = String(processName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  if (n.includes('ADMIS')) return 'FP01_ADMISSAO'
  if (n.includes('DEMISS') || n.includes('DESLIG')) return 'FP02_DEMISSAO'
  if (n.includes('ATEND')) return 'FP03_ATENDIMENTO'
  if (n.includes('PONTO')) return 'FP04_PONTO'
  if (n.includes('FARD')) return 'FP05_FARDAMENTO'
  if (n.includes('BENEF')) return 'FP06_BENEFICIOS'
  return undefined
}
