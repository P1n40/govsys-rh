'use client'

import { useMemo, useState } from 'react'
import { listGovernanceLogs, listGovernanceMeta } from '@/lib/services/governance-local'
import { useGovContext } from '@/components/providers/gov-provider'
import { listDemandas, type DemandaListItem } from '@/lib/services/govsys'
import { useEffect } from 'react'

export default function RelatoriosPage() {
  const { canManage } = useGovContext()
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'LOGS'>('REPORTS')
  const [rows, setRows] = useState<DemandaListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    risk: 'ALL',
    status: 'ALL',
    type: 'ALL',
  })

  const [logFilter, setLogFilter] = useState<'ALL' | 'CRITICAL'>('ALL')

  useEffect(() => {
    async function load() {
      const data = await listDemandas()
      setRows(data)
      setLoading(false)
    }

    void load()
  }, [])

  const metaMap = useMemo(() => listGovernanceMeta(), [])
  const logs = useMemo(() => listGovernanceLogs(), [])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const meta = metaMap[row.id]
      const created = new Date(row.created_at)
      const start = filters.startDate ? new Date(filters.startDate) : null
      const end = filters.endDate ? new Date(filters.endDate) : null

      if (start && created < start) return false
      if (end && created > end) return false
      if (filters.status !== 'ALL' && row.status.toLowerCase() !== filters.status.toLowerCase()) return false
      if (filters.risk !== 'ALL' && (meta?.risk ?? 'ALL') !== filters.risk) return false
      if (filters.type !== 'ALL' && (meta?.processType ?? 'ALL') !== filters.type) return false
      return true
    })
  }, [rows, metaMap, filters])

  const filteredLogs = useMemo(() => {
    if (logFilter === 'ALL') return logs
    return logs.filter((l) => (l.severity ?? 'INFO') === 'CRITICAL')
  }, [logs, logFilter])

  if (!canManage) {
    return <p className="text-slate-700">Acesso restrito a perfis gerenciais (Admin, Gerente, Coordenador, Supervisor).</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Relatorios & Auditoria</h2>
          <p className="text-slate-500">Centro de inteligencia e logs do sistema.</p>
        </div>
        {activeTab === 'REPORTS' ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button onClick={() => alert(`Exportando PDF com ${filteredRows.length} registros (simulacao)`) } className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto">Exportar PDF</button>
            <button onClick={() => alert(`Exportando Excel com ${filteredRows.length} registros (simulacao)`) } className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto">Exportar Excel</button>
          </div>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-slate-200 px-1 pb-1 sm:gap-4">
        <button onClick={() => setActiveTab('REPORTS')} className={`border-b-2 px-3 pb-2 text-sm font-medium ${activeTab === 'REPORTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Relatorios</button>
        <button onClick={() => setActiveTab('LOGS')} className={`border-b-2 px-3 pb-2 text-sm font-medium ${activeTab === 'LOGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Logs</button>
      </div>

      {activeTab === 'REPORTS' ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={filters.risk} onChange={(e) => setFilters((f) => ({ ...f, risk: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="ALL">Risco: Todos</option>
                <option value="LEGAL">LEGAL</option>
                <option value="CONTRACTUAL">CONTRACTUAL</option>
                <option value="OPERATIONAL">OPERATIONAL</option>
                <option value="FINANCIAL">FINANCIAL</option>
              </select>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="ALL">Status: Todos</option>
                <option value="registrada">registrada</option>
                <option value="em_andamento">em_andamento</option>
                <option value="bloqueada">bloqueada</option>
                <option value="concluida">concluida</option>
                <option value="cancelada">cancelada</option>
              </select>
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="ALL">Tipo: Todos</option>
                <option value="FP01_ADMISSAO">FP01_ADMISSAO</option>
                <option value="FP02_DEMISSAO">FP02_DEMISSAO</option>
                <option value="FP03_ATENDIMENTO">FP03_ATENDIMENTO</option>
                <option value="FP04_PONTO">FP04_PONTO</option>
                <option value="FP05_FARDAMENTO">FP05_FARDAMENTO</option>
                <option value="FP06_BENEFICIOS">FP06_BENEFICIOS</option>
              </select>
              <button onClick={() => setFilters({ startDate: '', endDate: '', risk: 'ALL', status: 'ALL', type: 'ALL' })} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white">Limpar</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            {loading ? <p className="p-4">Carregando...</p> : null}
            {!loading ? (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Protocolo</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Risco</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const meta = metaMap[row.id]
                      return (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{row.protocolo}</td>
                          <td className="px-4 py-3">{new Date(row.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3">{meta?.processType ?? '-'}</td>
                          <td className="px-4 py-3">{meta?.risk ?? '-'}</td>
                          <td className="px-4 py-3">{row.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredRows.length === 0 ? <p className="p-6 text-center text-slate-500">Nenhum registro encontrado.</p> : null}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setLogFilter('ALL')} className={`rounded-full border px-3 py-1 text-xs font-bold ${logFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-300'}`}>All</button>
            <button onClick={() => setLogFilter('CRITICAL')} className={`rounded-full border px-3 py-1 text-xs font-bold ${logFilter === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' : 'text-red-600 border-red-300'}`}>Critical</button>
          </div>
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div key={log.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('pt-BR')} - {log.userName} ({log.userRole})</p>
                {log.details ? <p className="mt-1 text-sm text-slate-700">{log.details}</p> : null}
              </div>
            ))}
            {filteredLogs.length === 0 ? <p className="text-sm text-slate-500">Sem logs para o filtro atual.</p> : null}
          </div>
        </div>
      )}
    </div>
  )
}
