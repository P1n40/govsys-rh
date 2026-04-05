'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  atualizarUsuario,
  criarUsuario,
  excluirUsuario,
  listProcessos,
  listUsuarios,
  type Processo,
  type UserRole,
  type Usuario,
} from '@/lib/services/govsys'
import { useGovContext } from '@/components/providers/gov-provider'
import { supabase } from '@/lib/supabase'

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
type ConfirmacoesPorProcesso = Record<
  string,
  {
    principal?: boolean
    secundario?: boolean
  }
>

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

export default function EquipePage() {
  const { canManage, refreshUsers, currentUser } = useGovContext()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [responsabilidadesPorProcesso, setResponsabilidadesPorProcesso] = useState<ResponsabilidadesPorProcesso>({})
  const [confirmacoesPorProcesso, setConfirmacoesPorProcesso] = useState<ConfirmacoesPorProcesso>({})

  const [loading, setLoading] = useState(true)
  const [userSaving, setUserSaving] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState<string | null>(null)

  const [userMessage, setUserMessage] = useState<Message | null>(null)
  const [assignmentMessage, setAssignmentMessage] = useState<Message | null>(null)
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

  async function carregarUsuarios() {
    const data = await listUsuarios()
    setUsuarios(data)
  }

  async function carregarProcessos() {
    const data = await listProcessos()
    setProcessos(data)
  }

  function atualizarResponsavelLocal(processoId: string, tipo: ResponsabilidadeTipo, userId: string) {
    setResponsabilidadesPorProcesso((current) => ({
      ...current,
      [processoId]: {
        ...(current[processoId] ?? {}),
        [tipo]: userId || undefined,
      },
    }))
    setConfirmacoesPorProcesso((current) => ({
      ...current,
      [processoId]: {
        ...(current[processoId] ?? {}),
        [tipo]: false,
      },
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

  async function salvarAtribuicao(processoId: string, tipo: ResponsabilidadeTipo) {
    if (!responsabilidadesDisponivel) {
      setAssignmentMessage({
        type: 'error',
        text: 'Tabela de responsabilidades indisponivel. Execute o script sql/create_responsabilidades.sql.',
      })
      return
    }

    const principal = responsabilidadesPorProcesso[processoId]?.principal ?? ''
    const secundario = responsabilidadesPorProcesso[processoId]?.secundario ?? ''
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
      setAssignmentSaving(`${processoId}:${tipo}`)
      setAssignmentMessage(null)

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

      setConfirmacoesPorProcesso((current) => ({
        ...current,
        [processoId]: {
          ...(current[processoId] ?? {}),
          [tipo]: true,
        },
      }))
      setAssignmentMessage({ type: 'success', text: 'Atribuicao salva com sucesso.' })
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao atribuir funcao.') })
    } finally {
      setAssignmentSaving(null)
    }
  }

  async function limparAtribuicao(processoId: string, tipo: ResponsabilidadeTipo) {
    if (!responsabilidadesDisponivel) return

    try {
      setAssignmentSaving(`${processoId}:clear:${tipo}`)
      setAssignmentMessage(null)

      const { error } = await supabase
        .from('responsabilidades')
        .delete()
        .eq('processo_id', processoId)
        .eq('tipo', tipo)

      if (error) throw new Error(error.message)

      setResponsabilidadesPorProcesso((current) => ({
        ...current,
        [processoId]: {
          ...(current[processoId] ?? {}),
          [tipo]: undefined,
        },
      }))
      setConfirmacoesPorProcesso((current) => ({
        ...current,
        [processoId]: {
          ...(current[processoId] ?? {}),
          [tipo]: false,
        },
      }))

      setAssignmentMessage({ type: 'success', text: 'Atribuicao removida com sucesso.' })
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: getErrorMessage(error, 'Erro ao remover atribuicao.') })
    } finally {
      setAssignmentSaving(null)
    }
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
              {processos.map((processo) => {
                const principal = responsabilidadesPorProcesso[processo.id]?.principal ?? ''
                const secundario = responsabilidadesPorProcesso[processo.id]?.secundario ?? ''
                const principalConfirmado = Boolean(confirmacoesPorProcesso[processo.id]?.principal)
                const secundarioConfirmado = Boolean(confirmacoesPorProcesso[processo.id]?.secundario)

                const savingPrincipal = assignmentSaving === `${processo.id}:principal` || assignmentSaving === `${processo.id}:clear:principal`
                const savingSecundario = assignmentSaving === `${processo.id}:secundario` || assignmentSaving === `${processo.id}:clear:secundario`

                return (
                  <tr key={processo.id}>
                    <td className="border border-slate-300 px-4 py-2 font-medium text-slate-800">{processo.nome}</td>
                    <td className="border border-slate-300 px-4 py-2">
                      <select
                        value={principal}
                        onChange={(e) => atualizarResponsavelLocal(processo.id, 'principal', e.target.value)}
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
                        onChange={(e) => atualizarResponsavelLocal(processo.id, 'secundario', e.target.value)}
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
                          onClick={() => void salvarAtribuicao(processo.id, 'principal')}
                          disabled={!responsabilidadesDisponivel || savingPrincipal}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                            principalConfirmado ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {savingPrincipal ? 'Salvando...' : principalConfirmado ? 'Principal salvo' : 'Salvar principal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void salvarAtribuicao(processo.id, 'secundario')}
                          disabled={!responsabilidadesDisponivel || savingSecundario}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                            secundarioConfirmado ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                        >
                          {savingSecundario ? 'Salvando...' : secundarioConfirmado ? 'Substituto salvo' : 'Salvar substituto'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void limparAtribuicao(processo.id, 'principal')}
                          disabled={!responsabilidadesDisponivel || savingPrincipal || !principal}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Limpar principal
                        </button>
                        <button
                          type="button"
                          onClick={() => void limparAtribuicao(processo.id, 'secundario')}
                          disabled={!responsabilidadesDisponivel || savingSecundario || !secundario}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Limpar substituto
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Usuarios Cadastrados</h3>
        <ul className="divide-y divide-slate-100">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-3">
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

                  <div className="flex gap-2">
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

                  <div className="flex items-center gap-2">
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
