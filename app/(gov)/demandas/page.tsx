'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { listDemandas, type DemandaListItem } from '@/lib/services/govsys'
import { useGovContext } from '@/components/providers/gov-provider'
import { AlertTriangle, ChevronRight, Filter, Flame, Search, UserCheck, Users } from 'lucide-react'

export default function DemandasPage() {
  const { currentUser, canManage } = useGovContext()
  const [demandas, setDemandas] = useState<DemandaListItem[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [viewScope, setViewScope] = useState<'MINE' | 'ALL'>(canManage ? 'ALL' : 'MINE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function carregar() {
    try {
      setLoading(true)
      setError(null)
      const data = await listDemandas(search)
      setDemandas(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar demandas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setViewScope(canManage ? 'ALL' : 'MINE')
  }, [canManage])

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtradas = useMemo(() => {
    const statusNormalized = statusFilter.toLowerCase()

    return demandas.filter((d) => {
      const assigned = Boolean(
        currentUser && (d.responsavel_id === currentUser.id || d.substituto_id === currentUser.id)
      )

      const visible = viewScope === 'ALL' ? canManage || assigned : assigned
      if (!visible) return false

      if (statusFilter === 'ALL') return true
      if (statusFilter === 'OVERDUE') {
        if (!d.deadline) return false
        const overdue = new Date(d.deadline).getTime() < Date.now()
        return overdue && d.status.toLowerCase() !== 'concluida'
      }

      return d.status.toLowerCase() === statusNormalized
    })
  }, [canManage, currentUser, demandas, statusFilter, viewScope])

  function getStatusClasses(statusValue: string): string {
    const status = statusValue.toLowerCase()
    if (status === 'concluida') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'bloqueada') return 'bg-red-100 text-red-700 border-red-200'
    if (status === 'em_andamento') return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Demandas</h2>
          <p className="text-slate-500">Replica do app anexado, agora com dados do Supabase.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button onClick={() => void carregar()} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">Atualizar</button>
          <Link href="/nova-demanda" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto">Nova Demanda</Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
          <button
            onClick={() => setViewScope('MINE')}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${viewScope === 'MINE' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <UserCheck className="h-4 w-4" />
            Minhas Demandas
          </button>
          {canManage ? (
            <button
              onClick={() => setViewScope('ALL')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${viewScope === 'ALL' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Users className="h-4 w-4" />
              Visao da Equipe
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por protocolo/processo/status"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={() => void carregar()} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium sm:w-auto">Buscar</button>
          <div className="relative w-full sm:w-auto">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 sm:min-w-48"
            >
              <option value="ALL">Todos os status</option>
              <option value="OVERDUE">SLA estourado</option>
              <option value="registrada">Registrada</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluida</option>
              <option value="bloqueada">Bloqueada</option>
            </select>
          </div>
        </div>

        {loading ? <p>Carregando demandas...</p> : null}
        {error ? <p className="text-red-600">{error}</p> : null}

        {!loading && !error ? (
          <>
            <div className="space-y-3 md:hidden">
              {filtradas.map((d) => {
                const overdue = Boolean(d.deadline && new Date(d.deadline).getTime() < Date.now() && d.status.toLowerCase() !== 'concluida')
                return (
                  <article key={`card-${d.id}`} className={`rounded-lg border p-3 ${overdue ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
                    <p className="font-mono text-sm font-semibold text-slate-800 break-all">{d.protocolo}</p>
                    <p className="mt-1 text-sm text-slate-700">{d.processo_nome}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${getStatusClasses(d.status)}`}>
                        {d.status}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${overdue ? 'border-red-200 bg-red-50 font-semibold text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                        {d.deadline ? new Date(d.deadline).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                    <Link href={`/demandas/${d.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
                      Abrir <ChevronRight className="h-4 w-4" />
                    </Link>
                  </article>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3">Protocolo</th>
                    <th className="border-b border-slate-200 px-4 py-3">Processo</th>
                    <th className="border-b border-slate-200 px-4 py-3">Status</th>
                    <th className="border-b border-slate-200 px-4 py-3">Prazo</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d) => {
                    const overdue = Boolean(d.deadline && new Date(d.deadline).getTime() < Date.now() && d.status.toLowerCase() !== 'concluida')

                    return (
                      <tr key={d.id} className={overdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-sm font-medium">
                          {d.protocolo}
                          {overdue ? <Flame className="ml-2 inline h-4 w-4 text-red-500" /> : null}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">{d.processo_nome}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${getStatusClasses(d.status)}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="inline-flex items-center gap-1">
                            {overdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : null}
                            <span className={overdue ? 'font-semibold text-red-600' : ''}>
                              {d.deadline ? new Date(d.deadline).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-right">
                          <Link href={`/demandas/${d.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                            Abrir <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {!loading && !error && filtradas.length === 0 ? (
          <p className="py-6 text-center text-slate-500">Nenhuma demanda encontrada.</p>
        ) : null}
      </div>
    </div>
  )
}
