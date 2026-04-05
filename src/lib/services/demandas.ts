import { supabase } from '@/lib/supabase'
import type { ChecklistItem, Demanda, Etapa, Pendencia, WorkflowRepository, WorkflowSnapshot } from '@/lib/engine/workflow-engine'

export interface Usuario {
  id: string
  nome: string
  email?: string | null
  perfil?: string | null
  role?: string | null
}

export interface Responsaveis {
  principal: Usuario | null
  secundario: Usuario | null
}

export type ExecucaoRegistro = {
  id: string
  demandaId: string
  etapaId: string
  status: string | null
}

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

function isTrue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const normalized = normalizeText(value)
  return normalized === '1' || normalized === 'true' || normalized === 'sim' || normalized === 'yes'
}

function mapDemanda(row: Record<string, unknown>): Demanda {
  return {
    id: String(row.id),
    protocolo: row.protocolo ? String(row.protocolo) : null,
    status: row.status ? String(row.status) : null,
    processoId: row.processo_id ? String(row.processo_id) : null,
    responsavelId: row.responsavel_id ? String(row.responsavel_id) : null,
    substitutoId: row.substituto_id ? String(row.substituto_id) : null,
    deadline: resolveDeadline(row),
  }
}

function mapEtapa(row: Record<string, unknown>): Etapa {
  return {
    id: String(row.id),
    nome: String(row.nome ?? 'Etapa sem nome'),
    ordem: typeof row.ordem === 'number' ? row.ordem : null,
    required: isRequired(row),
  }
}

function mapChecklist(row: Record<string, unknown>): ChecklistItem | null {
  const etapaIdRaw = row.etapa_id ?? row.etapaId ?? row.step_id
  if (!etapaIdRaw) return null

  const status = normalizeStatus(row.status)
  const doneByStatus = status === 'concluida' || status === 'concluido' || status === 'done' || status === 'checked'

  return {
    id: String(row.id ?? `${etapaIdRaw}-${row.descricao ?? row.nome ?? 'item'}`),
    etapaId: String(etapaIdRaw),
    descricao: String(row.descricao ?? row.nome ?? 'Checklist'),
    required: isRequired(row),
    done: isTrue(row.concluido ?? row.checked ?? row.done) || doneByStatus,
  }
}

function mapExecucao(row: Record<string, unknown>): ExecucaoRegistro | null {
  const etapa = row.etapa_id ?? row.etapaId
  const demanda = row.demanda_id ?? row.demandaId
  if (!etapa || !demanda) return null

  return {
    id: String(row.id),
    demandaId: String(demanda),
    etapaId: String(etapa),
    status: row.status ? String(row.status) : null,
  }
}

function mapPendencia(row: Record<string, unknown>): Pendencia {
  return {
    id: String(row.id),
    descricao: String(row.descricao ?? row.descricao_curta ?? 'Pendencia'),
    tipo: row.tipo ? String(row.tipo) : null,
    status: row.status ? String(row.status) : null,
    resolvida: typeof row.resolvida === 'boolean' ? row.resolvida : null,
  }
}

function resolveDeadline(row: Record<string, unknown>): string | null {
  const raw = row.deadline ?? row.prazo ?? row.due_date
  if (!raw) return null
  const value = String(raw)
  return Number.isNaN(new Date(value).getTime()) ? null : value
}

function isRequired(row: Record<string, unknown>): boolean {
  const marker = row.required ?? row.obrigatoria ?? row.obrigatorio ?? row.mandatory
  if (marker !== undefined) return isTrue(marker)
  return true
}

async function getDemandaById(demandaId: string): Promise<Demanda> {
  const { data, error } = await supabase.from('demandas').select('*').eq('id', demandaId).single()
  if (error || !data) throw new Error(error?.message ?? 'Demanda nao encontrada.')
  return mapDemanda(data as Record<string, unknown>)
}

async function listEtapasByProcesso(processoId: string): Promise<Etapa[]> {
  const { data, error } = await supabase
    .from('etapas')
    .select('*')
    .eq('processo_id', processoId)
    .order('ordem', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapEtapa)
}

async function listChecklistByEtapaIds(etapaIds: string[]): Promise<ChecklistItem[]> {
  if (etapaIds.length === 0) return []

  const attempts = [
    () => supabase.from('checklist').select('*').in('etapa_id', etapaIds),
    () => supabase.from('checklist').select('*').in('etapaId', etapaIds),
    () => supabase.from('checklist').select('*'),
  ]

  let lastError: Error | null = null

  for (const attempt of attempts) {
    const { data, error } = await attempt()
    if (error) {
      lastError = new Error(error.message)
      continue
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    return rows
      .map(mapChecklist)
      .filter((item): item is ChecklistItem => Boolean(item))
      .filter((item) => etapaIds.includes(item.etapaId))
  }

  throw lastError ?? new Error('Nao foi possivel carregar checklist.')
}

async function listExecucoesByDemanda(demandaId: string): Promise<ExecucaoRegistro[]> {
  const { data, error } = await supabase
    .from('execucao_etapas')
    .select('*')
    .eq('demanda_id', demandaId)

  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(mapExecucao)
    .filter((item): item is ExecucaoRegistro => Boolean(item))
}

async function listPendenciasByDemanda(demandaId: string): Promise<Pendencia[]> {
  const { data, error } = await supabase.from('pendencias').select('*').eq('demanda_id', demandaId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapPendencia)
}

async function createPendencia(params: {
  demandaId: string
  descricao: string
  tipo?: string
  status?: string
}): Promise<void> {
  const payloadCandidates: Array<Record<string, unknown>> = [
    {
      demanda_id: params.demandaId,
      descricao: params.descricao,
      tipo: params.tipo ?? 'critica',
      status: params.status ?? 'aberta',
      resolvida: false,
    },
    {
      demanda_id: params.demandaId,
      descricao: params.descricao,
      tipo: params.tipo ?? 'critica',
      resolvida: false,
    },
    {
      demanda_id: params.demandaId,
      descricao: params.descricao,
      status: params.status ?? 'aberta',
    },
    {
      demanda_id: params.demandaId,
      descricao: params.descricao,
    },
  ]

  for (const payload of payloadCandidates) {
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    )
    const { error } = await supabase.from('pendencias').insert(cleanPayload)
    if (!error) return
  }

  throw new Error('Nao foi possivel criar pendencia automatica.')
}

async function upsertExecucaoEtapa(params: {
  demandaId: string
  etapaId: string
  status?: string
}): Promise<void> {
  const status = params.status ?? 'concluida'

  const lookupAttempts = [
    () => supabase.from('execucao_etapas').select('id').eq('demanda_id', params.demandaId).eq('etapa_id', params.etapaId).maybeSingle(),
    () => supabase.from('execucao_etapas').select('id').eq('demandaId', params.demandaId).eq('etapaId', params.etapaId).maybeSingle(),
  ]

  for (const attempt of lookupAttempts) {
    const { data, error } = await attempt()
    if (error) continue

    if (data?.id) {
      const { error: updateError } = await supabase
        .from('execucao_etapas')
        .update({ status })
        .eq('id', data.id)
      if (updateError) throw new Error(updateError.message)
      return
    }
    break
  }

  const insertCandidates: Array<Record<string, unknown>> = [
    { demanda_id: params.demandaId, etapa_id: params.etapaId, status },
    { demandaId: params.demandaId, etapaId: params.etapaId, status },
  ]

  for (const payload of insertCandidates) {
    const { error } = await supabase.from('execucao_etapas').insert(payload)
    if (!error) return
  }

  throw new Error('Nao foi possivel registrar execucao da etapa.')
}

async function updateDemandaStatus(params: { demandaId: string; status: string }): Promise<void> {
  const { error } = await supabase.from('demandas').update({ status: params.status }).eq('id', params.demandaId)
  if (error) throw new Error(error.message)
}

async function loadWorkflowSnapshot(demandaId: string): Promise<WorkflowSnapshot> {
  const demanda = await getDemandaById(demandaId)
  const etapas = demanda.processoId ? await listEtapasByProcesso(demanda.processoId) : []
  const etapaIds = etapas.map((etapa) => etapa.id)

  const [checklist, execucoes, pendencias] = await Promise.all([
    listChecklistByEtapaIds(etapaIds),
    listExecucoesByDemanda(demandaId),
    listPendenciasByDemanda(demandaId),
  ])

  return {
    demanda,
    etapas,
    checklist,
    execucoes,
    pendencias,
  }
}

export const demandasRepository: WorkflowRepository = {
  loadWorkflowSnapshot,
  createPendencia,
  upsertExecucaoEtapa,
  updateDemandaStatus,
}

function normalizeRoleType(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export async function getResponsaveisPorProcesso(processoId: string): Promise<Responsaveis> {
  const { data, error } = await supabase
    .from('responsabilidades')
    .select('tipo, responsavel_id')
    .eq('processo_id', processoId)
    .eq('ativo', true)

  if (error || !data?.length) {
    return { principal: null, secundario: null }
  }

  const responsavelIds = Array.from(
    new Set(
      (data as Array<Record<string, unknown>>)
        .map((row) => row.responsavel_id)
        .filter((value): value is string => Boolean(value))
        .map((value) => String(value))
    )
  )

  if (responsavelIds.length === 0) {
    return { principal: null, secundario: null }
  }

  const { data: usuariosData, error: usuariosError } = await supabase
    .from('usuarios')
    .select('*')
    .in('id', responsavelIds)

  if (usuariosError || !usuariosData?.length) {
    return { principal: null, secundario: null }
  }

  const usuariosMap = new Map<string, Usuario>()
  for (const raw of usuariosData as Array<Record<string, unknown>>) {
    const id = raw.id ? String(raw.id) : ''
    if (!id) continue
    usuariosMap.set(id, {
      id,
      nome: raw.nome ? String(raw.nome) : id,
      email: raw.email ? String(raw.email) : null,
      role: raw.role ? String(raw.role) : raw.perfil ? String(raw.perfil) : null,
      perfil: raw.perfil ? String(raw.perfil) : null,
    })
  }

  let principal: Usuario | null = null
  let secundario: Usuario | null = null

  for (const row of data as Array<Record<string, unknown>>) {
    const tipo = normalizeRoleType(row.tipo)
    const responsavelId = row.responsavel_id ? String(row.responsavel_id) : ''
    const responsavel = responsavelId ? (usuariosMap.get(responsavelId) ?? null) : null
    if (!responsavel) continue

    if (!principal && tipo === 'principal') {
      principal = responsavel
      continue
    }

    if (!secundario && (tipo === 'secundario' || tipo === 'substituto')) {
      secundario = responsavel
    }
  }

  return { principal, secundario }
}
