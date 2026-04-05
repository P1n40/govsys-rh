import { demandasRepository, type ExecucaoRegistro } from '@/lib/services/demandas'

export type Demanda = {
  id: string
  protocolo: string | null
  status: string | null
  processoId: string | null
  responsavelId: string | null
  substitutoId: string | null
  deadline: string | null
}

export type Etapa = {
  id: string
  nome: string
  ordem: number | null
  required: boolean
}

export type ChecklistItem = {
  id: string
  etapaId: string
  descricao: string
  required: boolean
  done: boolean
}

export type Pendencia = {
  id: string
  descricao: string
  tipo: string | null
  status: string | null
  resolvida: boolean | null
}

export type WorkflowSnapshot = {
  demanda: Demanda
  etapas: Etapa[]
  checklist: ChecklistItem[]
  execucoes: ExecucaoRegistro[]
  pendencias: Pendencia[]
}

export type ValidationIssue = {
  code: string
  message: string
  blocking: boolean
}

export type ChecklistValidationResult = {
  checklistCompleto: boolean
  itensObrigatoriosPendentes: ChecklistItem[]
  issues: ValidationIssue[]
}

export type EtapasValidationResult = {
  etapasCompletas: boolean
  etapasObrigatoriasPendentes: Etapa[]
  issues: ValidationIssue[]
}

export type ConclusaoValidationResult = {
  podeConcluir: boolean
  bloqueios: ValidationIssue[]
  avisos: ValidationIssue[]
}

export type GeracaoPendenciasResult = {
  criadas: number
  descricoes: string[]
}

export type ExecutarEtapaInput = {
  demandaId: string
  etapaId: string
  actorRole?: string | null
}

export type ExecutarEtapaResult = {
  ok: boolean
  pendenciasGeradas: number
  validacaoChecklist: ChecklistValidationResult
  validacaoEtapas: EtapasValidationResult
}

export type ConcluirDemandaInput = {
  demandaId: string
  force?: boolean
  actorRole?: string | null
  strictSLA?: boolean
}

export type ConcluirDemandaResult = {
  ok: boolean
  bloqueado: boolean
  status?: string
  bloqueios: ValidationIssue[]
  avisos: ValidationIssue[]
  pendenciasGeradas: number
}

export type WorkflowRepository = {
  loadWorkflowSnapshot: (demandaId: string) => Promise<WorkflowSnapshot>
  createPendencia: (params: { demandaId: string; descricao: string; tipo?: string; status?: string }) => Promise<void>
  upsertExecucaoEtapa: (params: { demandaId: string; etapaId: string; status?: string }) => Promise<void>
  updateDemandaStatus: (params: { demandaId: string; status: string }) => Promise<void>
}

const MANAGER_ROLES = new Set(['ADMIN', 'GERENTE', 'COORDENADOR', 'SUPERVISOR'])
const OPEN_PENDING_STATUSES = new Set(['aberta', 'aberto', 'pendente', 'em_aberto', 'open', 'pending', 'in_progress'])
const RESOLVED_PENDING_STATUSES = new Set(['resolvida', 'resolvido', 'concluida', 'concluido', 'fechada', 'fechado', 'closed', 'done'])

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function normalizeStatus(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, '_')
}

function normalizeRole(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

function isManagerRole(role: string | null | undefined): boolean {
  if (!role) return false
  return MANAGER_ROLES.has(normalizeRole(role))
}

function isPendenciaAberta(pendencia: Pendencia): boolean {
  if (pendencia.resolvida === true) return false
  const status = normalizeStatus(pendencia.status)
  if (!status) return true
  if (RESOLVED_PENDING_STATUSES.has(status)) return false
  if (OPEN_PENDING_STATUSES.has(status)) return true
  return true
}

function isEtapaConcluida(etapaId: string, execucoes: ExecucaoRegistro[]): boolean {
  const execucao = execucoes.find((item) => item.etapaId === etapaId)
  if (!execucao) return false
  return normalizeStatus(execucao.status).includes('conclu')
}

function pendingDescriptionExists(pendencias: Pendencia[], ruleCode: string): boolean {
  return pendencias.some((p) => {
    if (!isPendenciaAberta(p)) return false
    const normalized = normalizeText(p.descricao)
    return normalized.includes(normalizeText(ruleCode))
  })
}

export function createWorkflowEngine(repository: WorkflowRepository) {
  async function carregarSnapshot(demandaId: string): Promise<WorkflowSnapshot> {
    return repository.loadWorkflowSnapshot(demandaId)
  }

  function validarChecklist(snapshot: WorkflowSnapshot): ChecklistValidationResult {
    const obrigatorios = snapshot.checklist.filter((item) => item.required)
    const pendentes = obrigatorios.filter((item) => {
      if (item.done) return false
      return !isEtapaConcluida(item.etapaId, snapshot.execucoes)
    })

    if (pendentes.length === 0) {
      return {
        checklistCompleto: true,
        itensObrigatoriosPendentes: [],
        issues: [],
      }
    }

    return {
      checklistCompleto: false,
      itensObrigatoriosPendentes: pendentes,
      issues: [
        {
          code: 'CHECKLIST_INCOMPLETO',
          message: `Checklist obrigatorio incompleto: ${pendentes.length} item(ns) pendente(s).`,
          blocking: true,
        },
      ],
    }
  }

  function validarEtapas(snapshot: WorkflowSnapshot): EtapasValidationResult {
    const etapasObrigatorias = snapshot.etapas.filter((etapa) => etapa.required)
    const pendentes = etapasObrigatorias.filter((etapa) => !isEtapaConcluida(etapa.id, snapshot.execucoes))

    if (pendentes.length === 0) {
      return {
        etapasCompletas: true,
        etapasObrigatoriasPendentes: [],
        issues: [],
      }
    }

    return {
      etapasCompletas: false,
      etapasObrigatoriasPendentes: pendentes,
      issues: [
        {
          code: 'ETAPAS_OBRIGATORIAS_PENDENTES',
          message: `Existem ${pendentes.length} etapa(s) obrigatoria(s) pendente(s).`,
          blocking: true,
        },
      ],
    }
  }

  async function gerarPendenciasAutomaticas(params: {
    snapshot: WorkflowSnapshot
    checklistValidation?: ChecklistValidationResult
    etapasValidation?: EtapasValidationResult
  }): Promise<GeracaoPendenciasResult> {
    const checklistValidation = params.checklistValidation ?? validarChecklist(params.snapshot)
    const etapasValidation = params.etapasValidation ?? validarEtapas(params.snapshot)
    const openPendencias = params.snapshot.pendencias.filter(isPendenciaAberta)

    let criadas = 0
    const descricoes: string[] = []

    if (!checklistValidation.checklistCompleto) {
      const descricao = `[RULE:CHECKLIST_INCOMPLETO] Checklist obrigatorio incompleto (${checklistValidation.itensObrigatoriosPendentes.length} item(ns)).`
      if (!pendingDescriptionExists(openPendencias, 'RULE:CHECKLIST_INCOMPLETO')) {
        await repository.createPendencia({
          demandaId: params.snapshot.demanda.id,
          descricao,
          tipo: 'critica',
          status: 'aberta',
        })
        criadas += 1
        descricoes.push(descricao)
      }
    }

    if (!etapasValidation.etapasCompletas) {
      const descricao = `[RULE:ETAPAS_OBRIGATORIAS_PENDENTES] Etapas obrigatorias ainda nao concluidas (${etapasValidation.etapasObrigatoriasPendentes.length}).`
      if (!pendingDescriptionExists(openPendencias, 'RULE:ETAPAS_OBRIGATORIAS_PENDENTES')) {
        await repository.createPendencia({
          demandaId: params.snapshot.demanda.id,
          descricao,
          tipo: 'critica',
          status: 'aberta',
        })
        criadas += 1
        descricoes.push(descricao)
      }
    }

    return { criadas, descricoes }
  }

  function validarConclusao(params: {
    snapshot: WorkflowSnapshot
    checklistValidation?: ChecklistValidationResult
    etapasValidation?: EtapasValidationResult
    force?: boolean
    actorRole?: string | null
    strictSLA?: boolean
  }): ConclusaoValidationResult {
    const checklistValidation = params.checklistValidation ?? validarChecklist(params.snapshot)
    const etapasValidation = params.etapasValidation ?? validarEtapas(params.snapshot)
    const force = Boolean(params.force)
    const manager = isManagerRole(params.actorRole)

    const bloqueios: ValidationIssue[] = []
    const avisos: ValidationIssue[] = []

    if (!params.snapshot.demanda.responsavelId || !params.snapshot.demanda.substitutoId) {
      bloqueios.push({
        code: 'RESPONSAVEL_SUBSTITUTO_OBRIGATORIO',
        message: 'Toda demanda deve possuir responsavel principal e substituto.',
        blocking: true,
      })
    }

    const pendenciasAbertas = params.snapshot.pendencias.filter(isPendenciaAberta)
    if (pendenciasAbertas.length > 0) {
      bloqueios.push({
        code: 'PENDENCIA_ABERTA',
        message: `Existem ${pendenciasAbertas.length} pendencia(s) em aberto.`,
        blocking: true,
      })
    }

    if (!checklistValidation.checklistCompleto) {
      bloqueios.push(...checklistValidation.issues)
    }

    if (!etapasValidation.etapasCompletas) {
      bloqueios.push(...etapasValidation.issues)
    }

    if (params.strictSLA && params.snapshot.demanda.deadline) {
      const isOverdue = new Date(params.snapshot.demanda.deadline).getTime() < Date.now()
      if (isOverdue && !manager) {
        bloqueios.push({
          code: 'SLA_RIGIDO_ATRASO',
          message: 'SLA rigido ativo: somente perfil gerencial pode concluir demanda atrasada.',
          blocking: true,
        })
      }
    }

    if (force) {
      if (!manager) {
        bloqueios.push({
          code: 'FORCE_SEM_PERMISSAO',
          message: 'Somente perfil gerencial pode forcar conclusao.',
          blocking: true,
        })
        return { podeConcluir: false, bloqueios, avisos }
      }

      for (const issue of bloqueios) {
        avisos.push({
          ...issue,
          blocking: false,
          message: `[IGNORADO POR OVERRIDE] ${issue.message}`,
        })
      }
      return { podeConcluir: true, bloqueios: [], avisos }
    }

    return {
      podeConcluir: bloqueios.length === 0,
      bloqueios,
      avisos,
    }
  }

  async function podeConcluirDemanda(input: ConcluirDemandaInput): Promise<boolean> {
    const snapshot = await carregarSnapshot(input.demandaId)
    const checklistValidation = validarChecklist(snapshot)
    const etapasValidation = validarEtapas(snapshot)
    const conclusao = validarConclusao({
      snapshot,
      checklistValidation,
      etapasValidation,
      force: input.force,
      actorRole: input.actorRole,
      strictSLA: input.strictSLA,
    })
    return conclusao.podeConcluir
  }

  async function executarEtapa(input: ExecutarEtapaInput): Promise<ExecutarEtapaResult> {
    const snapshot = await carregarSnapshot(input.demandaId)
    await repository.upsertExecucaoEtapa({
      demandaId: input.demandaId,
      etapaId: input.etapaId,
      status: 'concluida',
    })

    const statusAtual = normalizeStatus(snapshot.demanda.status)
    if (statusAtual === 'registrada' || statusAtual === 'aberta' || statusAtual === 'open') {
      await repository.updateDemandaStatus({ demandaId: input.demandaId, status: 'em_andamento' })
    }

    const atualizado = await carregarSnapshot(input.demandaId)
    const checklistValidation = validarChecklist(atualizado)
    const etapasValidation = validarEtapas(atualizado)
    const pendencias = await gerarPendenciasAutomaticas({
      snapshot: atualizado,
      checklistValidation,
      etapasValidation,
    })

    return {
      ok: true,
      pendenciasGeradas: pendencias.criadas,
      validacaoChecklist: checklistValidation,
      validacaoEtapas: etapasValidation,
    }
  }

  async function concluirDemanda(input: ConcluirDemandaInput): Promise<ConcluirDemandaResult> {
    const snapshot = await carregarSnapshot(input.demandaId)
    const checklistValidation = validarChecklist(snapshot)
    const etapasValidation = validarEtapas(snapshot)

    const pendencias = await gerarPendenciasAutomaticas({
      snapshot,
      checklistValidation,
      etapasValidation,
    })

    const atualizado = pendencias.criadas > 0 ? await carregarSnapshot(input.demandaId) : snapshot

    const conclusao = validarConclusao({
      snapshot: atualizado,
      checklistValidation: validarChecklist(atualizado),
      etapasValidation: validarEtapas(atualizado),
      force: input.force,
      actorRole: input.actorRole,
      strictSLA: input.strictSLA,
    })

    if (!conclusao.podeConcluir) {
      return {
        ok: false,
        bloqueado: true,
        bloqueios: conclusao.bloqueios,
        avisos: conclusao.avisos,
        pendenciasGeradas: pendencias.criadas,
      }
    }

    const finalStatus = input.force ? 'concluida_forcada' : 'concluida'
    await repository.updateDemandaStatus({
      demandaId: input.demandaId,
      status: finalStatus,
    })

    return {
      ok: true,
      bloqueado: false,
      status: finalStatus,
      bloqueios: [],
      avisos: conclusao.avisos,
      pendenciasGeradas: pendencias.criadas,
    }
  }

  return {
    validarChecklist,
    validarEtapas,
    gerarPendenciasAutomaticas,
    validarConclusao,
    podeConcluirDemanda,
    executarEtapa,
    concluirDemanda,
  }
}

export const workflowEngine = createWorkflowEngine(demandasRepository)
