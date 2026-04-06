import { supabase } from '@/lib/supabase'
import { workflowEngine } from '@/lib/engine/workflow-engine'

export type DemandaListItem = {
  id: string
  protocolo: string
  status: string
  created_at: string
  deadline: string | null
  processo_nome: string
  responsavel_id: string | null
  substituto_id: string | null
}

export type DashboardStats = {
  total: number
  abertas: number
  emAndamento: number
  concluidas: number
  bloqueadas: number
}

export type Processo = {
  id: string
  nome: string
}

export type Usuario = {
  id: string
  nome: string
  role: UserRole
  setor: string | null
  email?: string | null
}

export type UserRole =
  | 'ADMIN'
  | 'GERENTE'
  | 'COORDENADOR'
  | 'SUPERVISOR'
  | 'ANALISTA'
  | 'AUXILIAR_ADMINISTRATIVO'
  | 'JOVEM_APRENDIZ'

export const MANAGER_ROLES: UserRole[] = ['ADMIN', 'GERENTE', 'COORDENADOR', 'SUPERVISOR']
export type CreateUsuarioInput = {
  nome: string
  role: UserRole
  setor?: string | null
  email?: string
  password?: string
}

export type UpdateUsuarioInput = {
  id: string
  nome: string
  role: UserRole
  setor?: string | null
  email?: string | null
}

export type DemandaDetalhe = {
  id: string
  protocolo: string
  status: string
  created_at: string
  deadline: string | null
  processo: Processo | null
  responsavel: Usuario | null
  substituto: Usuario | null
}

export type Etapa = {
  id: string
  nome: string
  ordem: number | null
}

export type ExecucaoEtapa = {
  id: string
  etapa_id: string
  status: string | null
  demanda_id: string
}

export type Pendencia = {
  id: string
  descricao: string
  tipo: string | null
  status: string | null
  resolvida: boolean | null
  created_at: string | null
}

type ConclusaoOptions = {
  force?: boolean
  actorRole?: UserRole
  strictSLA?: boolean
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.from('demandas').select('status')
  if (error) throw new Error(error.message)

  const rows = data ?? []
  return {
    total: rows.length,
    abertas: rows.filter((r) => normalizeStatus(r.status) === 'registrada').length,
    emAndamento: rows.filter((r) => normalizeStatus(r.status) === 'em_andamento').length,
    concluidas: rows.filter((r) => normalizeStatus(r.status) === 'concluida').length,
    bloqueadas: rows.filter((r) => normalizeStatus(r.status) === 'bloqueada').length,
  }
}

export async function listDemandas(search?: string): Promise<DemandaListItem[]> {
  const { data, error } = await supabase
    .from('demandas')
    .select(
      `
      *,
      processos:processo_id (
        nome
      )
    `
    )

  if (error) throw new Error(error.message)

  const normalized = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const processosRaw = row.processos as { nome?: string } | Array<{ nome?: string }> | null
    const processoNome = Array.isArray(processosRaw)
      ? processosRaw[0]?.nome
      : processosRaw?.nome

    return {
      id: String(row.id),
      protocolo: String(row.protocolo ?? ''),
      status: String(row.status ?? 'registrada'),
      created_at: getDemandaCreatedAt(row),
      deadline: getDemandaDeadline(row),
      processo_nome: formatProcessoNome(processoNome ? String(processoNome) : 'Processo nao encontrado'),
      responsavel_id: row.responsavel_id ? String(row.responsavel_id) : null,
      substituto_id: row.substituto_id ? String(row.substituto_id) : null,
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (!search) return normalized
  const query = search.toLowerCase().trim()
  return normalized.filter(
    (d) =>
      d.protocolo.toLowerCase().includes(query) ||
      d.processo_nome.toLowerCase().includes(query) ||
      d.status.toLowerCase().includes(query)
  )
}

export async function getDemandaDetalhe(demandaId: string): Promise<DemandaDetalhe> {
  const { data, error } = await supabase
    .from('demandas')
    .select(
      `
      *,
      processos:processo_id (
        id,
        nome
      )
    `
    )
    .eq('id', demandaId)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Demanda nao encontrada')

  const processo = (data.processos?.[0] ?? null) as { id: string; nome: string } | null

  const [responsavel, substituto] = await Promise.all([
    data.responsavel_id ? getUsuarioById(String(data.responsavel_id)) : Promise.resolve(null),
    data.substituto_id ? getUsuarioById(String(data.substituto_id)) : Promise.resolve(null),
  ])

  return {
    id: String(data.id),
    protocolo: String(data.protocolo ?? ''),
    status: String(data.status ?? ''),
    created_at: getDemandaCreatedAt(data as Record<string, unknown>),
    deadline: getDemandaDeadline(data),
    processo: processo ? { id: String(processo.id), nome: formatProcessoNome(String(processo.nome)) } : null,
    responsavel,
    substituto,
  }
}

export async function listEtapasByProcesso(processoId: string): Promise<Etapa[]> {
  const { data, error } = await supabase
    .from('etapas')
    .select('id, nome, ordem')
    .eq('processo_id', processoId)
    .order('ordem', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((e) => ({
    id: String(e.id),
    nome: String(e.nome),
    ordem: typeof e.ordem === 'number' ? e.ordem : null,
  }))
}

export async function listPendenciasByDemanda(demandaId: string): Promise<Pendencia[]> {
  const { data, error } = await supabase
    .from('pendencias')
    .select('*')
    .eq('demanda_id', demandaId)

  if (error) throw new Error(error.message)

  return (data ?? []).map((p) => ({
    id: String(p.id),
    descricao: String(p.descricao ?? ''),
    tipo: p.tipo ? String(p.tipo) : null,
    status: p.status ? String(p.status) : null,
    resolvida: typeof p.resolvida === 'boolean' ? p.resolvida : null,
    created_at: getGenericCreatedAt(p),
  })).sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0
    return bt - at
  })
}

export async function listExecucoesByDemanda(demandaId: string): Promise<ExecucaoEtapa[]> {
  const { data, error } = await supabase
    .from('execucao_etapas')
    .select('id, etapa_id, status, demanda_id')
    .eq('demanda_id', demandaId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    etapa_id: String(row.etapa_id),
    status: row.status ? String(row.status) : null,
    demanda_id: String(row.demanda_id),
  }))
}

export async function resolvePendencia(pendenciaId: string): Promise<void> {
  const payloads: Array<Record<string, unknown>> = [
    { resolvida: true, status: 'resolvida' },
    { resolvida: true },
    { status: 'resolvida' },
  ]

  for (const payload of payloads) {
    const { error } = await supabase.from('pendencias').update(payload).eq('id', pendenciaId)
    if (!error) return
  }

  throw new Error('Nao foi possivel resolver pendencia')
}

export async function concluirDemanda(demandaId: string, options: ConclusaoOptions = {}): Promise<void> {
  const result = await workflowEngine.concluirDemanda({
    demandaId,
    force: options.force,
    actorRole: options.actorRole ?? null,
    strictSLA: options.strictSLA,
  })

  if (!result.ok) {
    const mensagem = result.bloqueios.map((b) => b.message).join(' | ')
    throw new Error(mensagem || 'Demanda bloqueada pelas regras da workflow engine.')
  }
}

export async function atualizarStatusDemanda(demandaId: string, status: string): Promise<void> {
  const { error } = await supabase.from('demandas').update({ status }).eq('id', demandaId)
  if (error) throw new Error(error.message)
}

export async function cancelarDemanda(demandaId: string): Promise<void> {
  const { error } = await supabase.from('demandas').update({ status: 'cancelada' }).eq('id', demandaId)
  if (error) throw new Error(error.message)
}

export async function listProcessos(): Promise<Processo[]> {
  const { data, error } = await supabase.from('processos').select('id, nome').order('nome')
  if (error) throw new Error(error.message)

  return (data ?? []).map((p) => ({ id: String(p.id), nome: formatProcessoNome(String(p.nome)) }))
}

export async function listUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from('usuarios').select('*').order('nome')
  if (error) throw new Error(error.message)

  return (data ?? []).map((u) => ({
    id: String(u.id),
    nome: String(u.nome ?? u.id),
    role: normalizeUserRole(u),
    setor: getUserSetor(u),
    email: u.email ? String(u.email) : null,
  }))
}

export async function criarUsuario(input: CreateUsuarioInput): Promise<Usuario> {
  const hasAuthCredentials = Boolean(input.email || input.password)

  if (!hasAuthCredentials) {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `usr-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    const baseWithId = { id, nome: input.nome }
    const baseWithoutId = { nome: input.nome }
    const candidates = [
      { ...baseWithId },
      { ...baseWithoutId },
      { ...baseWithId, role: input.role },
      { ...baseWithoutId, role: input.role },
      { ...baseWithId, perfil: input.role },
      { ...baseWithoutId, perfil: input.role },
      { ...baseWithId, papel: input.role },
      { ...baseWithoutId, papel: input.role },
      { ...baseWithId, cargo: input.role },
      { ...baseWithoutId, cargo: input.role },
      { ...baseWithId, tipo: input.role },
      { ...baseWithoutId, tipo: input.role },
      { ...baseWithId, nivel: input.role },
      { ...baseWithoutId, nivel: input.role },
      { ...baseWithId, permissao: input.role },
      { ...baseWithoutId, permissao: input.role },
      { ...baseWithId, acesso: input.role },
      { ...baseWithoutId, acesso: input.role },
      { ...baseWithId, setor: input.setor ?? undefined },
      { ...baseWithoutId, setor: input.setor ?? undefined },
      { ...baseWithId, sector: input.setor ?? undefined },
      { ...baseWithoutId, sector: input.setor ?? undefined },
      { ...baseWithId, departamento: input.setor ?? undefined },
      { ...baseWithoutId, departamento: input.setor ?? undefined },
    ]

    const errors: string[] = []
    for (const payload of candidates) {
      const compactPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      )
      const { data, error } = await supabase.from('usuarios').insert(compactPayload).select('*').single()
      if (!error && data) {
        const mutableRoleFields = ['role', 'perfil', 'papel', 'cargo', 'tipo', 'nivel', 'permissao', 'acesso']
        const mutableSetorFields = ['setor', 'sector', 'departamento']

        for (const field of mutableRoleFields) {
          if (field in data) {
            await supabase.from('usuarios').update({ [field]: input.role }).eq('id', data.id)
            break
          }
        }
        if (input.setor) {
          for (const field of mutableSetorFields) {
            if (field in data) {
              await supabase.from('usuarios').update({ [field]: input.setor }).eq('id', data.id)
              break
            }
          }
        }

        const { data: latest } = await supabase.from('usuarios').select('*').eq('id', data.id).maybeSingle()
        const user = latest ?? data
        return {
          id: String(user.id),
          nome: String(user.nome ?? user.id),
          role: normalizeUserRole(user),
          setor: getUserSetor(user),
          email: user.email ? String(user.email) : null,
        }
      }

      if (error) {
        errors.push(error.message)
      }
    }

    throw new Error(`Nao foi possivel cadastrar usuario na tabela usuarios. ${errors.join(' | ')}`)
  }

  const response = await fetch('/api/admin/usuarios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = (await response.json()) as { error?: string; user?: Usuario }
  if (!response.ok || !payload.user) {
    throw new Error(payload.error ?? 'Erro ao criar usuario')
  }

  return payload.user
}

export async function atualizarUsuario(input: UpdateUsuarioInput): Promise<Usuario> {
  const { data: existing, error: existingError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', input.id)
    .maybeSingle()

  if (existingError || !existing) {
    throw new Error(existingError?.message ?? 'Usuario nao encontrado para atualizacao.')
  }

  const roleFields = ['role', 'perfil', 'papel', 'cargo', 'tipo', 'nivel', 'permissao', 'acesso']
  const setorFields = ['setor', 'sector', 'departamento']

  const payload: Record<string, unknown> = {
    nome: input.nome,
  }

  const roleField = roleFields.find((field) => field in existing)
  if (roleField) payload[roleField] = input.role

  if (input.setor !== undefined) {
    const setorField = setorFields.find((field) => field in existing)
    if (setorField) payload[setorField] = input.setor
  }

  if (input.email !== undefined && 'email' in existing) {
    payload.email = input.email
  }

  const { data: updated, error } = await supabase
    .from('usuarios')
    .update(payload)
    .eq('id', input.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw new Error(error?.message ?? 'Nao foi possivel atualizar usuario.')
  }

  return {
    id: String(updated.id),
    nome: String(updated.nome ?? updated.id),
    role: normalizeUserRole(updated),
    setor: getUserSetor(updated),
    email: updated.email ? String(updated.email) : null,
  }
}

export async function excluirUsuario(usuarioId: string): Promise<void> {
  const { error } = await supabase.from('usuarios').delete().eq('id', usuarioId)
  if (error) throw new Error(error.message)
}

export async function criarDemanda(input: {
  protocolo: string
  processoId: string
  responsavelId: string
  substitutoId: string
}): Promise<void> {
  const { error } = await supabase.from('demandas').insert({
    protocolo: input.protocolo,
    processo_id: input.processoId,
    responsavel_id: input.responsavelId,
    substituto_id: input.substitutoId,
    status: 'registrada',
  })

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('Protocolo ja existe. Gere um novo protocolo e tente novamente.')
    }
    throw new Error(error.message)
  }
}

export async function existeDemandaComProtocolo(protocolo: string): Promise<boolean> {
  const value = protocolo.trim()
  if (!value) return false

  const { data, error } = await supabase
    .from('demandas')
    .select('id')
    .eq('protocolo', value)
    .limit(1)

  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

export async function gerarProximoProtocoloAnual(prefix = 'GOV'): Promise<string> {
  const normalizedPrefix = prefix.trim().toUpperCase() || 'GOV'
  const year = new Date().getFullYear()

  const { data, error } = await supabase.from('demandas').select('protocolo')
  if (error) throw new Error(error.message)

  let maxSequence = 0
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const value = String(row.protocolo ?? '').trim().toUpperCase()
    const match = value.match(/^([A-Z]+)-(\d{4})-(\d{4,})$/)
    if (!match) continue

    const rowPrefix = match[1]
    const rowYear = Number(match[2])
    const rowSeq = Number(match[3])

    if (rowPrefix === normalizedPrefix && rowYear === year && Number.isFinite(rowSeq)) {
      maxSequence = Math.max(maxSequence, rowSeq)
    }
  }

  const nextSequence = maxSequence + 1
  return `${normalizedPrefix}-${year}-${String(nextSequence).padStart(4, '0')}`
}

async function getUsuarioById(id: string): Promise<Usuario | null> {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return {
    id: String(data.id),
    nome: String(data.nome ?? data.id),
    role: normalizeUserRole(data),
    setor: getUserSetor(data),
    email: data.email ? String(data.email) : null,
  }
}

function normalizeStatus(status: unknown): string {
  return String(status ?? '').trim().toLowerCase()
}

function normalizeUserRole(user: Record<string, unknown>): UserRole {
  const raw = String(user.role ?? user.perfil ?? user.papel ?? user.cargo ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (raw === 'ADMIN') return 'ADMIN'
  if (raw === 'GERENTE' || raw === 'MANAGER') return 'GERENTE'
  if (raw === 'COORDENADOR' || raw === 'COORDINATOR') return 'COORDENADOR'
  if (raw === 'SUPERVISOR') return 'SUPERVISOR'
  if (raw === 'ANALISTA' || raw === 'ANALYST' || raw === 'RESPONSIBLE') return 'ANALISTA'
  if (raw === 'AUXILIAR_ADMINISTRATIVO' || raw === 'AUXILIAR' || raw === 'ASSISTANT' || raw === 'SUBSTITUTE' || raw === 'ATTENDANT') return 'AUXILIAR_ADMINISTRATIVO'
  if (raw === 'JOVEM_APRENDIZ' || raw === 'APRENDIZ') return 'JOVEM_APRENDIZ'

  return 'ANALISTA'
}

function getUserSetor(user: Record<string, unknown>): string | null {
  const setor = user.setor ?? user.sector
  return setor ? String(setor) : null
}

function getDemandaDeadline(demanda: Record<string, unknown>): string | null {
  const raw = demanda.deadline ?? demanda.prazo ?? demanda.due_date
  if (!raw) return null
  const value = String(raw)
  if (Number.isNaN(new Date(value).getTime())) return null
  return value
}

function getDemandaCreatedAt(demanda: Record<string, unknown>): string {
  const raw =
    demanda.created_at ??
    demanda.data_criacao ??
    demanda.data_abertura ??
    demanda.aberta_em ??
    demanda.cadastrado_em

  if (!raw) return new Date().toISOString()
  const value = String(raw)
  return Number.isNaN(new Date(value).getTime()) ? new Date().toISOString() : value
}

function getGenericCreatedAt(row: Record<string, unknown>): string | null {
  const raw = row.created_at ?? row.data_criacao ?? row.aberta_em ?? row.cadastrado_em
  if (!raw) return null
  const value = String(raw)
  return Number.isNaN(new Date(value).getTime()) ? null : value
}

function normalizeProcessName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function formatProcessoNome(nome: string): string {
  const normalized = normalizeProcessName(nome)
  if (!normalized || normalized === 'PROCESSO NAO ENCONTRADO') return nome

  if (normalized.includes('FP 01') || normalized.includes('ADMIS')) {
    return 'FP 01 - Admissao de Colaboradores'
  }
  if (normalized.includes('FP 02') || normalized.includes('DEMISS') || normalized.includes('DESLIG')) {
    return 'FP 02 - Demissao / Desligamento'
  }
  if (normalized.includes('FP 03') || normalized.includes('ATEND')) {
    return 'FP 03 - Atendimento ao Colaborador'
  }
  if (normalized.includes('FP 04') || normalized.includes('PONTO')) {
    return 'FP 04 - Ponto e Justificativas Medicas'
  }
  if (normalized.includes('FP 05') || normalized.includes('FARD')) {
    return 'FP 05 - Fardamento e Materiais'
  }
  if (normalized.includes('FP 06') || normalized.includes('BENEF')) {
    return 'FP 06 - Beneficios e Sistemas'
  }

  return nome
}

// Função para criar uma nova mensagem
export type Mensagem = {
  id: string
  conteudo: string
  remetente_id: string
  destinatario_id: string | null
  setor_id: string | null
  demanda_id: string | null
  created_at: string
}

export type MensagemAnexo = {
  id: string
  mensagem_id: string
  url: string
  tipo: string | null
  created_at: string
}

const MENSAGERIA_SETUP_HINT =
  'Infra de mensagens indisponivel. Execute o script sql/create_mensagens.sql no Supabase.'

function getMensagemCreatedAt(row: Record<string, unknown>): string {
  const raw = row.created_at ?? row.criado_em ?? row.cadastrado_em
  if (!raw) return new Date().toISOString()
  const value = String(raw)
  return Number.isNaN(new Date(value).getTime()) ? new Date().toISOString() : value
}

function normalizeMessage(value: unknown): string {
  return String(value ?? '').toLowerCase()
}

function isMissingTableError(error: { code?: string; message?: string }, table: string): boolean {
  const msg = normalizeMessage(error.message)
  const tableName = table.toLowerCase()
  return (
    error.code === 'PGRST205' ||
    msg.includes(`table 'public.${tableName}'`) ||
    msg.includes(`relation "public.${tableName}" does not exist`) ||
    msg.includes(`relation public.${tableName} does not exist`)
  )
}

export async function criarMensagem({
  remetenteId,
  destinatarioId,
  setorId,
  demandaId,
  conteudo,
}: {
  remetenteId: string
  destinatarioId?: string
  setorId?: string
  demandaId?: string
  conteudo: string
}): Promise<Mensagem> {
  const { data, error } = await supabase
    .from('mensagens')
    .insert({
      remetente_id: remetenteId,
      destinatario_id: destinatarioId,
      setor_id: setorId,
      demanda_id: demandaId,
      conteudo,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (error && isMissingTableError(error, 'mensagens')) {
      throw new Error(MENSAGERIA_SETUP_HINT)
    }
    throw new Error(error?.message ?? 'Erro ao criar mensagem')
  }

  return {
    id: String(data.id),
    conteudo: String(data.conteudo ?? conteudo),
    remetente_id: String(data.remetente_id ?? remetenteId),
    destinatario_id: data.destinatario_id ? String(data.destinatario_id) : null,
    setor_id: data.setor_id ? String(data.setor_id) : null,
    demanda_id: data.demanda_id ? String(data.demanda_id) : null,
    created_at: getMensagemCreatedAt(data as Record<string, unknown>),
  }
}

export async function listarMensagens(filtros: {
  demandaId?: string
  setorId?: string
  destinatarioId?: string
}): Promise<Mensagem[]> {
  const { demandaId, setorId, destinatarioId } = filtros
  let query = supabase.from('mensagens').select('*')

  if (demandaId) query = query.eq('demanda_id', demandaId)
  if (setorId) query = query.eq('setor_id', setorId)
  if (destinatarioId) query = query.eq('destinatario_id', destinatarioId)

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error, 'mensagens')) {
      throw new Error(MENSAGERIA_SETUP_HINT)
    }
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id),
      conteudo: String(row.conteudo ?? ''),
      remetente_id: String(row.remetente_id ?? ''),
      destinatario_id: row.destinatario_id ? String(row.destinatario_id) : null,
      setor_id: row.setor_id ? String(row.setor_id) : null,
      demanda_id: row.demanda_id ? String(row.demanda_id) : null,
      created_at: getMensagemCreatedAt(row),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function listarAnexosPorMensagens(mensagemIds: string[]): Promise<MensagemAnexo[]> {
  if (mensagemIds.length === 0) return []

  const { data, error } = await supabase
    .from('anexos_mensagens')
    .select('*')
    .in('mensagem_id', mensagemIds)

  if (error) {
    if (isMissingTableError(error, 'anexos_mensagens')) {
      throw new Error(MENSAGERIA_SETUP_HINT)
    }
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    mensagem_id: String(row.mensagem_id),
    url: String(row.url ?? ''),
    tipo: row.tipo ? String(row.tipo) : null,
    created_at: getMensagemCreatedAt(row),
  }))
}

export async function anexarArquivoMensagem({
  mensagemId,
  arquivo,
}: {
  mensagemId: string
  arquivo: File
}) {
  const safeName = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `mensagens/${mensagemId}/${Date.now()}-${safeName}`
  const { data, error } = await supabase.storage.from('anexos').upload(storagePath, arquivo)
  if (error) {
    const msg = normalizeMessage(error.message)
    if (msg.includes('bucket') && msg.includes('not found')) {
      throw new Error(`${MENSAGERIA_SETUP_HINT} Bucket "anexos" tambem precisa existir.`)
    }
    throw new Error(error.message)
  }

  const url = data?.path
  const { error: dbError } = await supabase.from('anexos_mensagens').insert({
    mensagem_id: mensagemId,
    url,
    tipo: arquivo.type,
  })

  if (dbError) {
    if (isMissingTableError(dbError, 'anexos_mensagens')) {
      throw new Error(MENSAGERIA_SETUP_HINT)
    }
    throw new Error(dbError.message)
  }
  return url
}
