'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  atualizarUsuario,
  criarUsuario,
  excluirUsuario,
  listUsuarios,
  type UserRole,
  type Usuario,
} from '@/lib/services/govsys'
import { useGovContext } from '@/components/providers/gov-provider'

const ROLES: UserRole[] = ['ADMIN', 'GERENTE', 'COORDENADOR', 'SUPERVISOR', 'ANALISTA', 'AUXILIAR_ADMINISTRATIVO', 'JOVEM_APRENDIZ']
const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  COORDENADOR: 'COORDENADOR',
  SUPERVISOR: 'SUPERVISOR',
  ANALISTA: 'ANALISTA',
  AUXILIAR_ADMINISTRATIVO: 'AUXILIAR ADMINISTRATIVO',
  JOVEM_APRENDIZ: 'JOVEM APRENDIZ',
}

export default function EquipePage() {
  const { canManage, strictSLA, setStrictSLA, refreshUsers, currentUser } = useGovContext()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
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

  async function carregarEquipe() {
    try {
      setLoading(true)
      setError(null)
      const data = await listUsuarios()
      setUsuarios(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarEquipe()
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.nome.trim()) {
      setError('Nome obrigatorio.')
      return
    }

    if (form.createLogin) {
      if (!form.email.trim() || !form.password.trim()) {
        setError('Email e senha obrigatorios para criar login.')
        return
      }
      if (form.password.length < 6) {
        setError('Senha deve ter pelo menos 6 caracteres.')
        return
      }
    }

    try {
      setSaving(true)
      const created = await criarUsuario({
        nome: form.nome.trim(),
        role: form.role,
        setor: form.setor.trim() || null,
        email: form.createLogin ? form.email.trim() : undefined,
        password: form.createLogin ? form.password : undefined,
      })

      setSuccess(
        form.createLogin
          ? `Usuario ${created.nome} criado com login ${form.email.trim()}.`
          : `Usuario ${created.nome} criado sem login.`
      )
      setForm({
        nome: '',
        role: 'ANALISTA',
        setor: '',
        createLogin: false,
        email: '',
        password: '',
      })
      await Promise.all([carregarEquipe(), refreshUsers()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar usuario')
    } finally {
      setSaving(false)
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
    setError(null)
    setSuccess(null)
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
      setError('Nome obrigatorio para atualizar usuario.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const updated = await atualizarUsuario({
        id: userId,
        nome: editForm.nome.trim(),
        role: editForm.role,
        setor: editForm.setor.trim() || null,
        email: editForm.email.trim() || null,
      })

      setSuccess(`Usuario ${updated.nome} atualizado com sucesso.`)
      cancelEdit()
      await Promise.all([carregarEquipe(), refreshUsers()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar usuario')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteUser(user: Usuario) {
    const isCurrent = currentUser?.id === user.id
    if (isCurrent) {
      setError('Nao e permitido excluir o usuario atualmente ativo no sistema.')
      return
    }

    const confirmed = window.confirm(`Excluir usuario ${user.nome}? Esta acao nao pode ser desfeita.`)
    if (!confirmed) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      await excluirUsuario(user.id)
      setSuccess(`Usuario ${user.nome} excluido com sucesso.`)
      if (editingUserId === user.id) cancelEdit()
      await Promise.all([carregarEquipe(), refreshUsers()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir usuario')
    } finally {
      setSaving(false)
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
        <p className="text-slate-500">Cadastre responsaveis, crie logins e ajuste regras de governanca.</p>
        <p className="text-xs text-slate-500">Hierarquia: Admin &gt; Gerente &gt; Coordenador &gt; Supervisor &gt; Analista &gt; Auxiliar Administrativo &gt; Jovem Aprendiz.</p>
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Cadastrar usuario'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">SLA rigido (global)</p>
          <p className="mb-3 text-xs text-slate-600">
            Quando ativo, bloqueia conclusao de demanda atrasada para perfis nao gerenciais.
          </p>
          <button
            onClick={() => setStrictSLA(!strictSLA)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              strictSLA ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
            {strictSLA ? 'Desativar modo rigido' : 'Ativar modo rigido'}
          </button>
        </div>

        {error ? <p className="text-red-600">{error}</p> : null}

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
                      disabled={saving}
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
                      {(u.setor ?? 'Setor nao informado')}
                      {u.email ? ` | ${u.email}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400">ID: {u.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{ROLE_LABELS[u.role]}</span>
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
                      disabled={saving || currentUser?.id === u.id}
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
