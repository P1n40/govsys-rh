'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react'
import { getDashboardStats, type DashboardStats } from '@/lib/services/govsys'
import type { ReactNode } from 'react'
import { useGovContext } from '@/components/providers/gov-provider'

const emptyStats: DashboardStats = {
  total: 0,
  abertas: 0,
  emAndamento: 0,
  concluidas: 0,
  bloqueadas: 0,
}

export default function DashboardPage() {
  const { canManage } = useGovContext()
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getDashboardStats()
        setStats(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  if (!canManage) {
    return <p className="text-slate-700">Acesso restrito a perfis gerenciais (Admin, Gerente, Coordenador, Supervisor).</p>
  }

  if (loading) return <p>Carregando dashboard...</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500">Visao operacional de demandas e riscos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={<Clock3 className="h-5 w-5 text-blue-700" />} className="bg-blue-50" />
        <StatCard title="Abertas" value={stats.abertas} icon={<AlertTriangle className="h-5 w-5 text-amber-700" />} className="bg-amber-50" />
        <StatCard title="Em andamento" value={stats.emAndamento} icon={<ShieldAlert className="h-5 w-5 text-indigo-700" />} className="bg-indigo-50" />
        <StatCard title="Concluidas" value={stats.concluidas} icon={<CheckCircle2 className="h-5 w-5 text-emerald-700" />} className="bg-emerald-50" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Resumo de Governanca</h3>
        <p className="mt-2 text-sm text-slate-600">Demandas bloqueadas: <strong>{stats.bloqueadas}</strong>. Use a tela de demandas para validar pendencias e concluir com rastreabilidade.</p>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, className }: { title: string; value: number; icon: ReactNode; className: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
