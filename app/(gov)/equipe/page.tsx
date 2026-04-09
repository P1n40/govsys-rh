'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  atualizarUsuario,
  atualizarProcesso,
  criarProcesso,
  criarUsuario,
  excluirProcesso,
  excluirUsuario,
  listProcessos,
  listUsuarios,
  type Processo,
  type UserRole,
  type Usuario,
} from '@/lib/services/govsys'
import { useGovContext } from '@/components/providers/gov-provider'
import { supabase } from '@/lib/supabase'
import { PROCESS_TEMPLATES, inferTypeFromProcessName } from '@/lib/services/governance-local'

type Message = {
  type: 'error' | 'success'
  text: string
}

type ResponsabilidadeTipo = 'principal' | 'secundario'

type ProcessoResponsaveis = {
  principal?: string
  secundario?: string
}

type ResponsabilidadesPorProcesso = Record<string, ProcessoResponsaveis>

type ProcessoAgrupado = {
  key: string
  nome: string
  ids: string[]
}

type EtapaEditorItem = {
  id: string
  processoId: string
  nome: string
  ordem: number
  nomeEdit: string
  ordemEdit: string
}

type ChecklistEditorItem = {
  id: string
  etapaId: string
  nome: string
  obrigatorio: boolean
  nomeEdit: string
  obrigatorioEdit: boolean
}

const ROLES: UserRole[] = [
  'ADMIN',
  'GERENTE',
  'COORDENADOR',
  'SUPERVISOR',
  'ANALISTA',
  'AUXILIAR_ADMINISTRATIVO',
  'JOVEM_APRENDIZ',
]

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  COORDENADOR: 'COORDENADOR',
  SUPERVISOR: 'SUPERVISOR',
  ANALISTA: 'ANALISTA',
  AUXILIAR_ADMINISTRATIVO: 'AUXILIAR ADMINISTRATIVO',
  JOVEM_APRENDIZ: 'JOVEM APRENDIZ',
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function normalizeProcessKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getFpOrder(value: string): number {
  const match = value.match(/FP\s*0?(\d{1,2})/i)
  if (!match) return 999
  const n = Number(match[1])
  return Number.isFinite(n) ? n : 999
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'sim' || normalized === 'yes'
}

export default function EquipePage() {
  const { canManage, refreshUsers, currentUser } = useGovContext()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [responsabilidadesPorProcesso, setResponsabilidadesPorProcesso] = useState<ResponsabilidadesPorProcesso>({})
  const [editandoProcessoKey, setEditandoProcessoKey] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [userSaving, setUserSaving] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState<string | null>(null)

  const [userMessage, setUserMessage] = useState<Message | null>(null)
  const [assignmentMessage, setAssignmentMessage] = useState<Message | null>(null)
  const [processMessage, setProcessMessage] = useState<Message | null>(null)
  const [responsabilidadesDisponivel, setResponsabilidadesDisponivel] = useState(true)

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    nome: '',
    role: 'ANALISTA' as UserRole,
    setor: '',
    email: '',
  })

  const [form, setForm] = useState({
    nome: '',
    role: 'ANALISTA' as UserRole,
    setor: '',
    createLogin: false,
    email: '',
    password: '',
  })
  const [processForm, setProcessForm] = useState({ nome: '' })
  const [processSaving, setProcessSaving] = useState(false)
  const [editorProcesso, setEditorProcesso] = useState<ProcessoAgrupado | null>(null)
  const [editorProcessoNome, setEditorProcessoNome] = useState('')
  const [editorCarregando, setEditorCarregando] = useState(false)
  const [editorSalvando, setEditorSalvando] = useState(false)
  const [etapasAll, setEtapasAll] = useState<EtapaEditorItem[]>([])
  const [etapasBase, setEtapasBase] = useState<EtapaEditorItem[]>([])
  const [ordemEtapaSelecionada, setOrdemEtapaSelecionada] = useState<number | null>(null)
  const [checklistBase, setChecklistBase] = useState<ChecklistEditorItem[]>([])
  const [novaEtapa, setNovaEtapa] = useState({ nome: '', ordem: '' })
  const [novoChecklist, setNovoChecklist] = useState({ nome: '', obrigatorio: true })

  const processosAgrupados = useMemo<ProcessoAgrupado[]>(() => {
    const byKey = new Map<string, ProcessoAgrupado>()

    for (const processo of processos) {
      const key = normalizeProcessKey(processo.nome)
      const current = byKey.get(key)
      if (!current) {
        byKey.set(key, { key, nome: processo.nome, ids: [processo.id] })
        continue
      }
      current.ids.push(processo.id)
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const orderA = getFpOrder(a.nome)
      const orderB = getFpOrder(b.nome)
      if (orderA !== orderB) return orderA - orderB
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [processos])

  async function carregarUsuarios() {
    const data = await listUsuarios()
    setUsuarios(data)
  }

  async function carregarProcessos() {
    const data = await listProcessos()
    setProcessos(data)
  }

  function atualizarResponsavelLocal(processoIds: string[], tipo: ResponsabilidadeTipo, userId: string) {
    setResponsabilidadesPorProcesso((current) => ({
      ...current,
      ...Object.fromEntries(
        processoIds.map((processoId) => [
          processoId,
          {
            ...(current[processoId] ?? {}),
            [tipo]: userId || undefined,
          },
        ])
      ),
    }))
  }

  async function carregarResponsabilidades() {
    const { data, error } = await supabase
      .from('responsabilidades')
      .select('processo_id, responsavel_id, tipo, ativo')
      .eq('ativo', true)

    if (error) {
      const code = (error as { code?: string }).code
      if (code === 'PGRST205') {
        setResponsabilidadesDisponivel(false)
        setAssignmentMessage({
          type: 'error',
          text: 'Tabela public.responsabilidades nao existe. Execute o script sql/create_responsabilidades.sql no Supabase.',
        })
        return
      }
      throw new Error(error.message)
    }

    const mapped: ResponsabilidadesPorProcesso = {}

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const processoId = row.processo_id ? String(row.processo_id) : null
      const responsavelId = row.responsavel_id ? String(row.responsavel_id) : null
      const tipo = row.tipo === 'principal' || row.tipo === 'secundario' ? row.tipo : null

      if (!processoId || !responsavelId || !tipo) continue

      mapped[processoId] = {
        ...(mapped[processoId] ?? {}),
        [tipo]: responsavelId,
      }
    }

    setResponsabilidadesDisponivel(true)
    setResponsabilidadesPorProcesso(mapped)
  }

  async function carregarPagina() {
    try {
      setLoading(true)
      setUserMessage(null)
      setAssignmentMessage(null)
      setProcessMessage(null)

      await Promise.all([carregarUsuarios(), carregarProcessos()])
      await carregarResponsabilidades()
    } catch (error) {
      setUserMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao carregar equipe.') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarPagina()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUserMessage(null)

    if (!form.nome.trim()) {
      setUserMessage({ type: 'error', text: 'Nome obrigatorio.' })
      return
    }

    if (form.createLogin) {
      if (!form.email.trim() || !form.password.trim()) {
        setUserMessage({ type: 'error', text: 'Email e senha obrigatorios para criar login.' })
        return
      }
      if (form.password.length < 6) {
        setUserMessage({ type: 'error', text: 'Senha deve ter pelo menos 6 caracteres.' })
        return
      }
    }

    try {
      setUserSaving(true)

      const created = await criarUsuario({
        nome: form.nome.trim(),
        role: form.role,
        setor: form.setor.trim() || null,
        email: form.createLogin ? form.email.trim() : undefined,
        password: form.createLogin ? form.password : undefined,
      })

      setUserMessage({
        type: 'success',
        text: form.createLogin
          ? `Usuario ${created.nome} criado com login ${form.email.trim()}.`
          : `Usuario ${created.nome} criado sem login.`,
      })

      setForm({
        nome: '',
        role: 'ANALISTA',
        setor: '',
        createLogin: false,
        email: '',
        password: '',
      })

      await Promise.all([carregarUsuarios(), refreshUsers()])
    } catch (error) {
      setUserMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao criar usuario.') })
    } finally {
      setUserSaving(false)
    }
  }

  function startEdit(user: Usuario) {
    setEditingUserId(user.id)
    setEditForm({
      nome: user.nome,
      role: user.role,
      setor: user.setor ?? '',
      email: user.email ?? '',
    })
    setUserMessage(null)
  }

  function cancelEdit() {
    setEditingUserId(null)
    setEditForm({
      nome: '',
      role: 'ANALISTA',
      setor: '',
      email: '',
    })
  }

  async function onSaveEdit(userId: string) {
    if (!editForm.nome.trim()) {
      setUserMessage({ type: 'error', text: 'Nome obrigatorio para atualizar usuario.' })
      return
    }

    try {
      setUserSaving(true)
      setUserMessage(null)

      const updated = await atualizarUsuario({
        id: userId,
        nome: editForm.nome.trim(),
        role: editForm.role,
        setor: editForm.setor.trim() || null,
        email: editForm.email.trim() || null,
      })

      setUserMessage({ type: 'success', text: `Usuario ${updated.nome} atualizado com sucesso.` })
      cancelEdit()
      await Promise.all([carregarUsuarios(), refreshUsers()])
    } catch (error) {
      setUserMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao atualizar usuario.') })
    } finally {
      setUserSaving(false)
    }
  }

  async function onDeleteUser(user: Usuario) {
    if (currentUser?.id === user.id) {
      setUserMessage({ type: 'error', text: 'Nao e permitido excluir o usuario atualmente ativo no sistema.' })
      return
    }

    const confirmed = window.confirm(`Excluir usuario ${user.nome}? Esta acao nao pode ser desfeita.`)
    if (!confirmed) return

    try {
      setUserSaving(true)
      setUserMessage(null)

      await excluirUsuario(user.id)
      setUserMessage({ type: 'success', text: `Usuario ${user.nome} excluido com sucesso.` })

      if (editingUserId === user.id) cancelEdit()
      await Promise.all([carregarUsuarios(), refreshUsers()])
    } catch (error) {
      setUserMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao excluir usuario.') })
    } finally {
      setUserSaving(false)
    }
  }

  async function onCreateProcesso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProcessMessage(null)

    const nome = processForm.nome.trim()
    if (!nome) {
      setProcessMessage({ type: 'error', text: 'Informe o nome do processo.' })
      return
    }

    const key = normalizeProcessKey(nome)
    const duplicated = processosAgrupados.some((item) => item.key === key)
    if (duplicated) {
      setProcessMessage({ type: 'error', text: 'Ja existe um processo com esse nome/codigo.' })
      return
    }

    try {
      setProcessSaving(true)
      await criarProcesso(nome)
      setProcessForm({ nome: '' })
      setProcessMessage({ type: 'success', text: 'Processo criado com sucesso.' })
      await carregarProcessos()
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao criar processo.') })
    } finally {
      setProcessSaving(false)
    }
  }

  async function carregarChecklistEditor(etapas: EtapaEditorItem[], ordem: number | null) {
    if (ordem === null || !editorProcesso) {
      setChecklistBase([])
      return
    }

    const ligadas = etapas.filter((item) => item.ordem === ordem)
    if (ligadas.length === 0) {
      setChecklistBase([])
      return
    }

    const etapaBase = ligadas.find((item) => item.processoId === editorProcesso.ids[0]) ?? ligadas[0]
    const { data, error } = await supabase
      .from('checklist')
      .select('id, etapa_id, nome, obrigatorio')
      .in('etapa_id', ligadas.map((item) => item.id))
      .order('nome', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: String(row.id),
        etapaId: String(row.etapa_id ?? ''),
        nome: String(row.nome ?? ''),
        obrigatorio: toBool(row.obrigatorio),
      }))
      .filter((row) => row.etapaId === etapaBase.id)
      .map((row) => ({
        ...row,
        nomeEdit: row.nome,
        obrigatorioEdit: row.obrigatorio,
      }))

    setChecklistBase(rows)
  }

  async function carregarEditorProcesso(group: ProcessoAgrupado, ordemPreferida?: number | null) {
    try {
      setEditorCarregando(true)
      const { data, error } = await supabase
        .from('etapas')
        .select('id, processo_id, nome, ordem')
        .in('processo_id', group.ids)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw new Error(error.message)

      const rows = ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({
          id: String(row.id),
          processoId: String(row.processo_id ?? ''),
          nome: String(row.nome ?? ''),
          ordem: typeof row.ordem === 'number' ? row.ordem : 0,
          nomeEdit: String(row.nome ?? ''),
          ordemEdit: String(typeof row.ordem === 'number' ? row.ordem : ''),
        }))
        .filter((row) => row.processoId && row.ordem > 0)

      const baseProcessoId = group.ids.find((id) => rows.some((row) => row.processoId === id)) ?? group.ids[0]
      const baseRows = rows.filter((row) => row.processoId === baseProcessoId)

      setEtapasAll(rows)
      setEtapasBase(baseRows)
      const ordemAlvo = typeof ordemPreferida === 'number' ? ordemPreferida : baseRows[0]?.ordem ?? null
      setOrdemEtapaSelecionada(ordemAlvo)
      await carregarChecklistEditor(rows, ordemAlvo)
    } finally {
      setEditorCarregando(false)
    }
  }

  async function onAbrirEditorProcesso(group: ProcessoAgrupado) {
    setEditorProcesso(group)
    setEditorProcessoNome(group.nome)
    setNovaEtapa({ nome: '', ordem: '' })
    setNovoChecklist({ nome: '', obrigatorio: true })
    setProcessMessage(null)
    await carregarEditorProcesso(group)
  }

  async function onFecharEditorProcesso() {
    setEditorProcesso(null)
    setEditorProcessoNome('')
    setEtapasAll([])
    setEtapasBase([])
    setChecklistBase([])
    setOrdemEtapaSelecionada(null)
  }

  async function onSalvarNomeProcessoEditor() {
    if (!editorProcesso) return
    const nome = editorProcessoNome.trim()
    if (!nome) {
      setProcessMessage({ type: 'error', text: 'Nome do processo e obrigatorio.' })
      return
    }

    const key = normalizeProcessKey(nome)
    const duplicated = processosAgrupados.some((item) => item.key === key && item.key !== editorProcesso.key)
    if (duplicated) {
      setProcessMessage({ type: 'error', text: 'Ja existe outro processo com esse nome/codigo.' })
      return
    }

    try {
      setEditorSalvando(true)
      for (const id of editorProcesso.ids) {
        await atualizarProcesso(id, nome)
      }
      setEditorProcesso({ ...editorProcesso, nome, key })
      setProcessMessage({ type: 'success', text: 'Nome do processo atualizado com sucesso.' })
      await carregarProcessos()
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao atualizar processo.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onAdicionarEtapaEditor() {
    if (!editorProcesso) return
    const nome = novaEtapa.nome.trim()
    if (!nome) {
      setProcessMessage({ type: 'error', text: 'Informe o nome da etapa.' })
      return
    }

    const ordemParsed = Number(novaEtapa.ordem)
    const ordem = Number.isFinite(ordemParsed) && ordemParsed > 0
      ? Math.floor(ordemParsed)
      : (Math.max(0, ...etapasBase.map((item) => item.ordem)) + 1)

    if (etapasBase.some((item) => item.ordem === ordem)) {
      setProcessMessage({ type: 'error', text: 'Ja existe etapa com essa ordem.' })
      return
    }

    try {
      setEditorSalvando(true)
      for (const processoId of editorProcesso.ids) {
        const { error } = await supabase.from('etapas').insert({
          processo_id: processoId,
          nome,
          ordem,
        })
        if (error) throw new Error(error.message)
      }
      setNovaEtapa({ nome: '', ordem: '' })
      setProcessMessage({ type: 'success', text: 'Etapa adicionada com sucesso.' })
      await carregarEditorProcesso(editorProcesso, ordem)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao adicionar etapa.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onSalvarEtapaEditor(etapa: EtapaEditorItem) {
    if (!editorProcesso) return
    const nome = etapa.nomeEdit.trim()
    const ordemParsed = Number(etapa.ordemEdit)
    const novaOrdem = Number.isFinite(ordemParsed) && ordemParsed > 0 ? Math.floor(ordemParsed) : etapa.ordem
    if (!nome) {
      setProcessMessage({ type: 'error', text: 'Nome da etapa e obrigatorio.' })
      return
    }
    if (etapasBase.some((item) => item.id !== etapa.id && item.ordem === novaOrdem)) {
      setProcessMessage({ type: 'error', text: 'Ja existe outra etapa com essa ordem.' })
      return
    }

    try {
      setEditorSalvando(true)
      for (const processoId of editorProcesso.ids) {
        const target = etapasAll.find((item) => item.processoId === processoId && item.ordem === etapa.ordem)
        if (target) {
          const { error } = await supabase
            .from('etapas')
            .update({ nome, ordem: novaOrdem })
            .eq('id', target.id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase.from('etapas').insert({
            processo_id: processoId,
            nome,
            ordem: novaOrdem,
          })
          if (error) throw new Error(error.message)
        }
      }
      setProcessMessage({ type: 'success', text: 'Etapa atualizada com sucesso.' })
      await carregarEditorProcesso(editorProcesso, novaOrdem)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao atualizar etapa.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onImportarTemplateEditor() {
    if (!editorProcesso) return

    const type = inferTypeFromProcessName(editorProcesso.nome)
    if (!type) {
      setProcessMessage({
        type: 'error',
        text: 'Nao foi possivel inferir tipo FP pelo nome do processo. Use padrao "FP XX - Nome".',
      })
      return
    }

    const template = PROCESS_TEMPLATES[type]
    if (!template || template.steps.length === 0) {
      setProcessMessage({ type: 'error', text: 'Template POP sem etapas configuradas para esse processo.' })
      return
    }

    const deveSubstituir = etapasAll.length > 0
      ? window.confirm('Este processo ja possui etapas. Deseja substituir pelo checklist POP padrao?')
      : true

    if (!deveSubstituir) return

    try {
      setEditorSalvando(true)

      for (const processoId of editorProcesso.ids) {
        const { data: existentes, error: listError } = await supabase
          .from('etapas')
          .select('id')
          .eq('processo_id', processoId)
        if (listError) throw new Error(listError.message)

        const etapaIds = ((existentes ?? []) as Array<Record<string, unknown>>)
          .map((row) => String(row.id ?? ''))
          .filter(Boolean)

        if (etapaIds.length > 0) {
          const { error: delChecklistError } = await supabase.from('checklist').delete().in('etapa_id', etapaIds)
          if (delChecklistError) throw new Error(delChecklistError.message)

          const { error: delEtapasError } = await supabase.from('etapas').delete().in('id', etapaIds)
          if (delEtapasError) throw new Error(delEtapasError.message)
        }

        const etapasPayload = template.steps.map((step, idx) => ({
          processo_id: processoId,
          nome: step.label,
          ordem: idx + 1,
        }))

        const { data: novasEtapas, error: insertEtapaError } = await supabase
          .from('etapas')
          .insert(etapasPayload)
          .select('id, ordem, nome')

        if (insertEtapaError) throw new Error(insertEtapaError.message)

        const checklistPayload = ((novasEtapas ?? []) as Array<Record<string, unknown>>).map((row) => {
          const ordem = typeof row.ordem === 'number' ? row.ordem : 0
          const step = template.steps[ordem - 1]
          return {
            etapa_id: String(row.id),
            nome: String(row.nome ?? step?.label ?? 'Item'),
            obrigatorio: step?.required ?? true,
          }
        })

        if (checklistPayload.length > 0) {
          const { error: insertChecklistError } = await supabase.from('checklist').insert(checklistPayload)
          if (insertChecklistError) throw new Error(insertChecklistError.message)
        }
      }

      setProcessMessage({ type: 'success', text: 'Checklist POP padrao importado com sucesso.' })
      await carregarEditorProcesso(editorProcesso, 1)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao importar checklist POP padrao.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onExcluirEtapaEditor(etapa: EtapaEditorItem) {
    if (!editorProcesso) return
    const confirmed = window.confirm(`Excluir etapa "${etapa.nome}"?`)
    if (!confirmed) return

    try {
      setEditorSalvando(true)
      for (const target of etapasAll.filter((item) => item.ordem === etapa.ordem)) {
        const { error } = await supabase.from('etapas').delete().eq('id', target.id)
        if (error) throw new Error(error.message)
      }
      setProcessMessage({ type: 'success', text: 'Etapa excluida com sucesso.' })
      await carregarEditorProcesso(editorProcesso)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao excluir etapa.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onSelecionarEtapa(ordem: number) {
    if (!editorProcesso) return
    setOrdemEtapaSelecionada(ordem)
    await carregarChecklistEditor(etapasAll, ordem)
  }

  async function onAdicionarChecklistEditor() {
    if (!editorProcesso || ordemEtapaSelecionada === null) return
    const nome = novoChecklist.nome.trim()
    if (!nome) {
      setProcessMessage({ type: 'error', text: 'Informe o item de checklist.' })
      return
    }

    try {
      setEditorSalvando(true)
      const ligadas = etapasAll.filter((item) => item.ordem === ordemEtapaSelecionada)
      for (const etapa of ligadas) {
        const { error } = await supabase.from('checklist').insert({
          etapa_id: etapa.id,
          nome,
          obrigatorio: novoChecklist.obrigatorio,
        })
        if (error) throw new Error(error.message)
      }
      setNovoChecklist({ nome: '', obrigatorio: true })
      setProcessMessage({ type: 'success', text: 'Checklist adicionado com sucesso.' })
      await carregarEditorProcesso(editorProcesso, ordemEtapaSelecionada)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao adicionar checklist.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onSalvarChecklistEditor(item: ChecklistEditorItem) {
    if (!editorProcesso || ordemEtapaSelecionada === null) return
    const nome = item.nomeEdit.trim()
    if (!nome) {
      setProcessMessage({ type: 'error', text: 'Nome do checklist e obrigatorio.' })
      return
    }

    try {
      setEditorSalvando(true)
      const ligadas = etapasAll.filter((etapa) => etapa.ordem === ordemEtapaSelecionada)

      for (const etapa of ligadas) {
        if (etapa.id === item.etapaId) {
          const { error } = await supabase
            .from('checklist')
            .update({ nome, obrigatorio: item.obrigatorioEdit })
            .eq('id', item.id)
          if (error) throw new Error(error.message)
        } else {
          const { data, error } = await supabase
            .from('checklist')
            .select('id')
            .eq('etapa_id', etapa.id)
            .eq('nome', item.nome)
          if (error) throw new Error(error.message)
          for (const row of (data ?? []) as Array<Record<string, unknown>>) {
            const { error: updateError } = await supabase
              .from('checklist')
              .update({ nome, obrigatorio: item.obrigatorioEdit })
              .eq('id', row.id)
            if (updateError) throw new Error(updateError.message)
          }
        }
      }

      setProcessMessage({ type: 'success', text: 'Checklist atualizado com sucesso.' })
      await carregarEditorProcesso(editorProcesso, ordemEtapaSelecionada)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao atualizar checklist.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onExcluirChecklistEditor(item: ChecklistEditorItem) {
    if (!editorProcesso || ordemEtapaSelecionada === null) return
    const confirmed = window.confirm(`Excluir checklist "${item.nome}"?`)
    if (!confirmed) return

    try {
      setEditorSalvando(true)
      const ligadas = etapasAll.filter((etapa) => etapa.ordem === ordemEtapaSelecionada)
      for (const etapa of ligadas) {
        if (etapa.id === item.etapaId) {
          const { error } = await supabase.from('checklist').delete().eq('id', item.id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase
            .from('checklist')
            .delete()
            .eq('etapa_id', etapa.id)
            .eq('nome', item.nome)
          if (error) throw new Error(error.message)
        }
      }
      setProcessMessage({ type: 'success', text: 'Checklist excluido com sucesso.' })
      await carregarEditorProcesso(editorProcesso, ordemEtapaSelecionada)
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao excluir checklist.') })
    } finally {
      setEditorSalvando(false)
    }
  }

  async function onDeleteProcesso(group: ProcessoAgrupado) {
    const confirmed = window.confirm(`Excluir processo "${group.nome}"? Esta acao pode impactar responsabilidades e demandas vinculadas.`)
    if (!confirmed) return

    try {
      setProcessSaving(true)
      for (const id of group.ids) {
        await excluirProcesso(id)
      }
      setProcessMessage({ type: 'success', text: 'Processo excluido com sucesso.' })
      if (editandoProcessoKey === group.key) setEditandoProcessoKey(null)
      if (editorProcesso?.key === group.key) await onFecharEditorProcesso()
      await carregarProcessos()
    } catch (error) {
      setProcessMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao excluir processo.') })
    } finally {
      setProcessSaving(false)
    }
  }

  async function salvarAtribuicao(processoIds: string[], tipo: ResponsabilidadeTipo, groupKey: string) {
    if (!responsabilidadesDisponivel) {
      setAssignmentMessage({
        type: 'error',
        text: 'Tabela de responsabilidades indisponivel. Execute o script sql/create_responsabilidades.sql.',
      })
      return
    }

    const principal = processoIds
      .map((id) => responsabilidadesPorProcesso[id]?.principal ?? '')
      .find(Boolean) ?? ''
    const secundario = processoIds
      .map((id) => responsabilidadesPorProcesso[id]?.secundario ?? '')
      .find(Boolean) ?? ''
    const userId = tipo === 'principal' ? principal : secundario

    if (!userId) {
      setAssignmentMessage({ type: 'error', text: 'Selecione um usuario para salvar a atribuicao.' })
      return
    }

    if (principal && secundario && principal === secundario) {
      setAssignmentMessage({ type: 'error', text: 'Responsavel principal e substituto devem ser pessoas diferentes.' })
      return
    }

    try {
      setAssignmentSaving(`${groupKey}:${tipo}`)
      setAssignmentMessage(null)

      for (const processoId of processoIds) {
        const payload = {
          processo_id: processoId,
          responsavel_id: userId,
          tipo,
          ativo: true,
        }

        const { error } = await supabase
          .from('responsabilidades')
          .upsert(payload, { onConflict: 'processo_id,tipo' })

        if (error) {
          const code = (error as { code?: string }).code
          if (code === 'PGRST205') {
            setResponsabilidadesDisponivel(false)
            throw new Error('Tabela public.responsabilidades nao existe. Execute sql/create_responsabilidades.sql no Supabase.')
          }
          throw new Error(error.message)
        }
      }

      setAssignmentMessage({ type: 'success', text: 'Atribuicao salva com sucesso.' })
      setEditandoProcessoKey(null)
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao atribuir funcao.') })
    } finally {
      setAssignmentSaving(null)
    }
  }

  async function cancelarEdicaoProcesso() {
    setEditandoProcessoKey(null)
    await carregarResponsabilidades()
  }

  if (loading) {
    return <p>Carregando equipe...</p>
  }

  if (!canManage) {
    return <p className="text-slate-700">Acesso restrito a perfis gerenciais (Admin, Gerente, Coordenador, Supervisor).</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Gestao de Equipe</h2>
        <p className="text-slate-500">Cadastro de usuarios e matriz de responsabilidades por processo.</p>
      </div>

      {usuarios.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Nenhum usuario encontrado. Cadastre o primeiro usuario (recomendado: perfil ADMIN).
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Novo Usuario / Responsavel</h3>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Perfil</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Setor</label>
            <input
              value={form.setor}
              onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Ex.: RH, DP, Juridico"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.createLogin}
              onChange={(e) => setForm((f) => ({ ...f, createLogin: e.target.checked }))}
            />
            Criar login no Supabase Auth
          </label>

          {form.createLogin ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Senha inicial</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="minimo 6 caracteres"
                />
              </div>
            </div>
          ) : null}

          {userMessage ? (
            <p className={userMessage.type === 'error' ? 'text-sm text-red-600' : 'text-sm text-emerald-700'}>{userMessage.text}</p>
          ) : null}

          <button
            type="submit"
            disabled={userSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {userSaving ? 'Salvando...' : 'Cadastrar usuario'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Catalogo de Processos (POP)</h3>
        <p className="mb-3 text-sm text-slate-500">
          Boas praticas: manter padrao `FP XX - Nome do Processo`, evitar duplicatas e versionar alteracoes de passos em etapas/checklist.
        </p>

        <form onSubmit={onCreateProcesso} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={processForm.nome}
            onChange={(e) => setProcessForm({ nome: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:max-w-xl"
            placeholder="Ex.: FP 07 - Medicina Ocupacional"
          />
          <button
            type="submit"
            disabled={processSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {processSaving ? 'Salvando...' : 'Novo processo'}
          </button>
        </form>

        {processMessage ? (
          <p className={processMessage.type === 'error' ? 'mb-3 text-sm text-red-600' : 'mb-3 text-sm text-emerald-700'}>
            {processMessage.text}
          </p>
        ) : null}

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 px-3 py-2 text-left">Processo</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Registros</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {processosAgrupados.map((group) => {
                const emEdicao = editorProcesso?.key === group.key
                return (
                  <tr key={`crud-${group.key}`}>
                    <td className="border border-slate-300 px-3 py-2">
                      <span className="font-medium text-slate-800">{group.nome}</span>
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-sm text-slate-600">{group.ids.length}</td>
                    <td className="border border-slate-300 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void onAbrirEditorProcesso(group)}
                          disabled={processSaving || editorCarregando || editorSalvando}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-60 ${
                            emEdicao
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          {emEdicao ? 'Editando...' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteProcesso(group)}
                          disabled={processSaving || editorSalvando}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>

        {editorProcesso ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Editor do Processo</h4>
                <p className="text-xs text-slate-600">
                  Atualize nome, etapas e checklist do POP selecionado. Alteracoes sao aplicadas em todos os registros duplicados desse processo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onFecharEditorProcesso()}
                disabled={editorSalvando}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Fechar editor
              </button>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={editorProcessoNome}
                onChange={(e) => setEditorProcessoNome(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                placeholder="Nome do processo"
              />
              <button
                type="button"
                onClick={() => void onSalvarNomeProcessoEditor()}
                disabled={editorSalvando || editorCarregando}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Salvar nome
              </button>
            </div>

            {editorCarregando ? (
              <p className="text-sm text-slate-600">Carregando etapas e checklist...</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h5 className="text-sm font-semibold text-slate-900">Etapas do Processo (Checklist POP)</h5>
                    <button
                      type="button"
                      onClick={() => void onImportarTemplateEditor()}
                      disabled={editorSalvando}
                      className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Importar checklist POP padrao
                    </button>
                  </div>

                  <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                    <input
                      value={novaEtapa.nome}
                      onChange={(e) => setNovaEtapa((current) => ({ ...current, nome: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Nova etapa"
                    />
                    <input
                      value={novaEtapa.ordem}
                      onChange={(e) => setNovaEtapa((current) => ({ ...current, ordem: e.target.value }))}
                      type="number"
                      min={1}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Ordem"
                    />
                    <button
                      type="button"
                      onClick={() => void onAdicionarEtapaEditor()}
                      disabled={editorSalvando}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Adicionar
                    </button>
                  </div>

                  {etapasBase.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma etapa cadastrada para este processo.</p>
                  ) : (
                    <ul className="space-y-2">
                      {etapasBase.map((etapa) => {
                        const selected = ordemEtapaSelecionada === etapa.ordem
                        return (
                          <li key={etapa.id} className="rounded-lg border border-slate-200 p-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => void onSelecionarEtapa(etapa.ordem)}
                                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                  selected ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                Ordem {etapa.ordem}
                              </button>
                              <button
                                type="button"
                                onClick={() => void onExcluirEtapaEditor(etapa)}
                                disabled={editorSalvando}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                Excluir
                              </button>
                            </div>
                              <div className="flex gap-2">
                                <input
                                  value={etapa.nomeEdit}
                                onChange={(e) =>
                                  setEtapasBase((current) =>
                                    current.map((item) =>
                                      item.id === etapa.id ? { ...item, nomeEdit: e.target.value } : item
                                    )
                                  )
                                }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                                <input
                                  value={etapa.ordemEdit}
                                  onChange={(e) =>
                                    setEtapasBase((current) =>
                                      current.map((item) =>
                                        item.id === etapa.id ? { ...item, ordemEdit: e.target.value } : item
                                      )
                                    )
                                  }
                                  type="number"
                                  min={1}
                                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => void onSalvarEtapaEditor(etapa)}
                                disabled={editorSalvando}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                Salvar
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <h5 className="mb-3 text-sm font-semibold text-slate-900">
                    Checklist da Etapa {ordemEtapaSelecionada ? `(ordem ${ordemEtapaSelecionada})` : ''}
                  </h5>
                  <p className="mb-3 text-xs text-slate-500">
                    Use este painel para sub-itens/compliance da etapa selecionada. O checklist principal exibido na demanda vem das etapas.
                  </p>

                  {ordemEtapaSelecionada === null ? (
                    <p className="text-sm text-slate-500">Selecione uma etapa para gerenciar o checklist.</p>
                  ) : (
                    <>
                      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <input
                          value={novoChecklist.nome}
                          onChange={(e) => setNovoChecklist((current) => ({ ...current, nome: e.target.value }))}
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          placeholder="Novo item de checklist"
                        />
                        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={novoChecklist.obrigatorio}
                            onChange={(e) =>
                              setNovoChecklist((current) => ({ ...current, obrigatorio: e.target.checked }))
                            }
                          />
                          Obrigatorio
                        </label>
                        <button
                          type="button"
                          onClick={() => void onAdicionarChecklistEditor()}
                          disabled={editorSalvando}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          Adicionar
                        </button>
                      </div>

                      {checklistBase.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhum checklist cadastrado nesta etapa.</p>
                      ) : (
                        <ul className="space-y-2">
                          {checklistBase.map((item) => (
                            <li key={item.id} className="rounded-lg border border-slate-200 p-2">
                              <div className="flex flex-col gap-2">
                                <input
                                  value={item.nomeEdit}
                                  onChange={(e) =>
                                    setChecklistBase((current) =>
                                      current.map((row) =>
                                        row.id === item.id ? { ...row, nomeEdit: e.target.value } : row
                                      )
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={item.obrigatorioEdit}
                                      onChange={(e) =>
                                        setChecklistBase((current) =>
                                          current.map((row) =>
                                            row.id === item.id
                                              ? { ...row, obrigatorioEdit: e.target.checked }
                                              : row
                                          )
                                        )
                                      }
                                    />
                                    Obrigatorio
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => void onSalvarChecklistEditor(item)}
                                    disabled={editorSalvando}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void onExcluirChecklistEditor(item)}
                                    disabled={editorSalvando}
                                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Responsaveis Por Processo</h3>

        {!responsabilidadesDisponivel ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            A tabela <strong>public.responsabilidades</strong> nao foi encontrada no Supabase. Execute o script
            <strong> sql/create_responsabilidades.sql</strong> e recarregue a pagina.
          </div>
        ) : null}

        {assignmentMessage ? (
          <p className={assignmentMessage.type === 'error' ? 'mb-3 text-sm text-red-600' : 'mb-3 text-sm text-emerald-700'}>
            {assignmentMessage.text}
          </p>
        ) : null}

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 px-4 py-2 text-left">Processo</th>
                <th className="border border-slate-300 px-4 py-2 text-left">Responsavel principal</th>
                <th className="border border-slate-300 px-4 py-2 text-left">Substituto</th>
                <th className="border border-slate-300 px-4 py-2 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {processosAgrupados.map((processo) => {
                const principal =
                  processo.ids.map((id) => responsabilidadesPorProcesso[id]?.principal ?? '').find(Boolean) ?? ''
                const secundario =
                  processo.ids.map((id) => responsabilidadesPorProcesso[id]?.secundario ?? '').find(Boolean) ?? ''
                const principalSalvo = Boolean(principal)
                const secundarioSalvo = Boolean(secundario)
                const linhaCompleta = principalSalvo && secundarioSalvo
                const emEdicao = !linhaCompleta || editandoProcessoKey === processo.key

                const savingPrincipal = assignmentSaving === `${processo.key}:principal`
                const savingSecundario = assignmentSaving === `${processo.key}:secundario`

                return (
                  <tr key={processo.key}>
                    <td className="border border-slate-300 px-4 py-2 font-medium text-slate-800">{processo.nome}</td>
                    <td className="border border-slate-300 px-4 py-2">
                      <select
                        value={principal}
                        onChange={(e) => atualizarResponsavelLocal(processo.ids, 'principal', e.target.value)}
                        disabled={!emEdicao}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="">Selecione</option>
                        {usuarios.map((usuario) => (
                          <option key={usuario.id} value={usuario.id}>
                            {usuario.nome} ({ROLE_LABELS[usuario.role]})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-300 px-4 py-2">
                      <select
                        value={secundario}
                        onChange={(e) => atualizarResponsavelLocal(processo.ids, 'secundario', e.target.value)}
                        disabled={!emEdicao}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="">Selecione</option>
                        {usuarios.map((usuario) => (
                          <option key={usuario.id} value={usuario.id}>
                            {usuario.nome} ({ROLE_LABELS[usuario.role]})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-300 px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void salvarAtribuicao(processo.ids, 'principal', processo.key)}
                          disabled={!responsabilidadesDisponivel || !emEdicao || savingPrincipal || !principal}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                            !emEdicao
                              ? principalSalvo
                                ? 'bg-emerald-600'
                                : 'bg-slate-400'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {savingPrincipal
                            ? 'Salvando...'
                            : !emEdicao
                              ? principalSalvo
                                ? 'Principal salvo'
                                : 'Principal pendente'
                              : 'Salvar principal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void salvarAtribuicao(processo.ids, 'secundario', processo.key)}
                          disabled={!responsabilidadesDisponivel || !emEdicao || savingSecundario || !secundario}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                            !emEdicao
                              ? secundarioSalvo
                                ? 'bg-emerald-600'
                                : 'bg-slate-400'
                              : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                        >
                          {savingSecundario
                            ? 'Salvando...'
                            : !emEdicao
                              ? secundarioSalvo
                                ? 'Substituto salvo'
                                : 'Substituto pendente'
                              : 'Salvar substituto'}
                        </button>
                        {linhaCompleta && !emEdicao ? (
                          <button
                            type="button"
                            onClick={() => setEditandoProcessoKey(processo.key)}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            Editar
                          </button>
                        ) : null}
                        {linhaCompleta && emEdicao ? (
                          <button
                            type="button"
                            onClick={() => void cancelarEdicaoProcesso()}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancelar edicao
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Usuarios Cadastrados</h3>
        <ul className="divide-y divide-slate-100">
          {usuarios.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editingUserId === u.id ? (
                <div className="w-full space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={editForm.nome}
                      onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Nome"
                    />
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={editForm.setor}
                      onChange={(e) => setEditForm((f) => ({ ...f, setor: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Setor"
                    />
                    <input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Email (se existir coluna)"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void onSaveEdit(u.id)}
                      disabled={userSaving}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Salvar alteracoes
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <span className="font-medium text-slate-800">{u.nome}</span>
                    <p className="text-xs text-slate-500">
                      {u.setor ?? 'Setor nao informado'}
                      {u.email ? ` | ${u.email}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400">ID: {u.id}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {ROLE_LABELS[u.role]}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteUser(u)}
                      disabled={userSaving || currentUser?.id === u.id}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {usuarios.length === 0 ? <p>Sem usuarios cadastrados.</p> : null}
      </div>
    </div>
  )
}
