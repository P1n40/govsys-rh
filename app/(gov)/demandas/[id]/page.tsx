'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Clock3, FileWarning, ShieldAlert, Sparkles, User } from 'lucide-react'
import { GanttChartSquare } from 'lucide-react'
import {
  atualizarStatusDemanda,
  cancelarDemanda,
  criarDemanda,
  getDemandaDetalhe,
  listDemandas,
  listEtapasByProcesso,
  listExecucoesByDemanda,
  listPendenciasByDemanda,
  listProcessos,
  listUsuarios,
  resolvePendencia,
  type DemandaDetalhe,
  type Etapa,
  type ExecucaoEtapa,
  type Pendencia,
  type Processo,
  type Usuario,
} from '@/lib/services/govsys'
import { executarEtapa } from '@/lib/services/workflow'
import { workflowEngine } from '@/lib/engine/workflow-engine'
import { useGovContext } from '@/components/providers/gov-provider'
import {
  PROCESS_TEMPLATES,
  appendGovernanceLog,
  getGovernanceMeta,
  inferTypeFromProcessName,
  linkDerivedDemand,
  listDemandLogs,
  saveGovernanceMeta,
  setLocalStepState,
  type GovernanceLog,
  type ProcessTemplateStep,
  type ProcessType,
} from '@/lib/services/governance-local'

function normalize(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

type ChecklistStep = {
  id: string
  nome: string
  ordem: number | null
  required: boolean
  critical: boolean
  documentRequired: boolean
  source: 'db' | 'template'
  completed: boolean
  completedBy?: string
  status: string
}

export default function DemandaDetalhePage() {
  const params = useParams<{ id: string }>()
  const demandaId = params?.id
  const { currentUser, isManager, canManage, strictSLA } = useGovContext()
  const managerAccess = isManager || canManage
  const [demanda, setDemanda] = useState<DemandaDetalhe | null>(null)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [execucoes, setExecucoes] = useState<ExecucaoEtapa[]>([])
  const [pendencias, setPendencias] = useState<Pendencia[]>([])
  const [logs, setLogs] = useState<GovernanceLog[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideViolations, setOverrideViolations] = useState<string[]>([])
  const [showDerived, setShowDerived] = useState(false)
  const [derivedReason, setDerivedReason] = useState('')
  const [derivedType, setDerivedType] = useState<ProcessType>('FP01_ADMISSAO')
  const [derivedResponsavelId, setDerivedResponsavelId] = useState('')
  const [derivedSubstitutoId, setDerivedSubstitutoId] = useState('')
  const [allProcessos, setAllProcessos] = useState<Processo[]>([])
  const [allUsuarios, setAllUsuarios] = useState<Usuario[]>([])
  const [childrenRows, setChildrenRows] = useState<Array<{ id: string; protocolo: string; status: string }>>([])

  async function carregarTudo() {
    if (!demandaId) return
    try {
      setLoading(true)
      setError(null)
      const detalhe = await getDemandaDetalhe(demandaId)
      setDemanda(detalhe)
      const [etapasData, execData, pendData, procData, usuData, demandasData] = await Promise.all([
        detalhe.processo?.id ? listEtapasByProcesso(detalhe.processo.id) : Promise.resolve([]),
        listExecucoesByDemanda(demandaId),
        listPendenciasByDemanda(demandaId),
        listProcessos(),
        listUsuarios(),
        listDemandas(),
      ])
      setEtapas(etapasData)
      setExecucoes(execData)
      setPendencias(pendData)
      setAllProcessos(procData)
      setAllUsuarios(usuData)
      const meta = getGovernanceMeta(demandaId)
      const inferred = meta.processType ?? inferTypeFromProcessName(detalhe.processo?.nome)
      if (inferred && !meta.processType) saveGovernanceMeta(demandaId, { processType: inferred })
      const childIds = meta.childDemandaIds ?? []
      setChildrenRows(demandasData.filter((d) => childIds.includes(d.id)).map((d) => ({ id: d.id, protocolo: d.protocolo, status: d.status })))
      setLogs(listDemandLogs(demandaId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar demanda')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandaId])

  const hasAccess = useMemo(() => {
    if (!demanda || !currentUser) return false
    if (managerAccess) return true
    return demanda.responsavel?.id === currentUser.id || demanda.substituto?.id === currentUser.id
  }, [demanda, currentUser, managerAccess])
  const isOverdue = useMemo(() => Boolean(demanda?.deadline && new Date(demanda.deadline).getTime() < Date.now()), [demanda?.deadline])
  const pendenciasAbertas = useMemo(() => pendencias.filter((p) => !(p.resolvida === true || ['resolvida', 'concluida', 'fechada'].includes(String(p.status ?? '').toLowerCase()))), [pendencias])
  const currentType = useMemo(() => (demanda ? getGovernanceMeta(demanda.id).processType ?? inferTypeFromProcessName(demanda.processo?.nome) : undefined), [demanda])
  const derivedProcessoAuto = useMemo(
    () => allProcessos.find((p) => inferTypeFromProcessName(p.nome) === derivedType) ?? null,
    [allProcessos, derivedType]
  )
  const templateSteps = useMemo(() => (currentType ? PROCESS_TEMPLATES[currentType]?.steps ?? [] : []), [currentType])
  const checklistSteps = useMemo<ChecklistStep[]>(() => {
    if (!demanda) return []

    const meta = getGovernanceMeta(demanda.id)
    const localState = meta.localStepState ?? {}

    if (etapas.length > 0) {
      const templateByOrder = new Map<number, ProcessTemplateStep>()
      templateSteps.forEach((step, index) => templateByOrder.set(index + 1, step))

      return etapas.map((etapa) => {
        const execution = execucoes.find((item) => item.etapa_id === etapa.id)
        const completed = execution ? normalize(execution.status).includes('conclu') : false
        const template = etapa.ordem ? templateByOrder.get(etapa.ordem) : undefined

        return {
          id: etapa.id,
          nome: etapa.nome,
          ordem: etapa.ordem,
          required: template?.required ?? true,
          critical: template?.critical ?? false,
          documentRequired: template?.documentRequired ?? false,
          source: 'db',
          completed,
          status: completed ? 'concluida' : execution?.status ?? 'pendente',
        }
      })
    }

    return templateSteps.map((step, index) => {
      const local = localState[step.id]
      const completed = Boolean(local?.completed)
      return {
        id: step.id,
        nome: step.label,
        ordem: index + 1,
        required: step.required,
        critical: step.critical,
        documentRequired: step.documentRequired,
        source: 'template',
        completed,
        completedBy: local?.completedBy,
        status: completed ? 'concluida' : 'pendente',
      }
    })
  }, [demanda, etapas, execucoes, templateSteps])

  async function logAction(action: string, details?: string, severity: 'INFO' | 'CRITICAL' = 'INFO') {
    if (!demanda || !currentUser) return
    appendGovernanceLog({ demandaId: demanda.id, userId: currentUser.id, userName: currentUser.nome, userRole: currentUser.role, action, details, severity })
    setLogs(listDemandLogs(demanda.id))
  }

  async function onConcluir(force = false) {
    if (!demanda || !currentUser) return
    try {
      setSaving(true)
      const result = await workflowEngine.concluirDemanda({
        demandaId: demanda.id,
        force,
        actorRole: currentUser.role,
        strictSLA,
      })

      if (!result.ok) {
        const messages = result.bloqueios.map((issue) => issue.message)
        if (!force && managerAccess) {
          setOverrideViolations(messages)
          setShowOverride(true)
          return
        }
        alert(`BLOQUEIO:\n- ${messages.join('\n- ')}`)
        return
      }

      await logAction(
        force ? 'CONCLUSAO_FORCADA' : 'DEMANDA_CONCLUIDA',
        result.avisos.map((item) => item.message).join(' | '),
        force ? 'CRITICAL' : 'INFO'
      )
      await carregarTudo()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir')
    } finally {
      setSaving(false)
    }
  }

  async function onConfirmOverride() {
    if (!demanda || !overrideReason.trim()) return alert('Justificativa obrigatoria para override.')
    try {
      setSaving(true)
      saveGovernanceMeta(demanda.id, { overrideReasons: [...(getGovernanceMeta(demanda.id).overrideReasons ?? []), overrideReason.trim()] })
      await logAction('OVERRIDE_GERENCIAL', `Motivo: ${overrideReason.trim()} | ${overrideViolations.join(' ; ')}`, 'CRITICAL')
      await onConcluir(true)
    } finally {
      setShowOverride(false)
      setOverrideReason('')
      setOverrideViolations([])
      setSaving(false)
    }
  }

  async function onCancelDemanda() {
    if (!demanda || !cancelReason.trim()) return alert('Justificativa obrigatoria para cancelamento.')
    try {
      setSaving(true)
      await cancelarDemanda(demanda.id)
      saveGovernanceMeta(demanda.id, { canceledReason: cancelReason.trim() })
      await logAction('DEMANDA_CANCELADA', cancelReason.trim(), 'CRITICAL')
      await carregarTudo()
      setShowCancel(false)
      setCancelReason('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao cancelar demanda')
    } finally {
      setSaving(false)
    }
  }

  async function onCriarDerivada() {
    if (!demanda || !currentUser) return
    if (!derivedReason.trim() || !derivedResponsavelId || !derivedSubstitutoId) return alert('Preencha responsavel, substituto e justificativa.')
    if (derivedResponsavelId === derivedSubstitutoId) return alert('Responsavel e substituto da derivada devem ser diferentes.')
    if (!derivedProcessoAuto) return alert('Nao existe processo cadastrado para este tipo FP. Revise a tabela processos.')
    const protocolo = `DER-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`
    try {
      setSaving(true)
      await criarDemanda({ protocolo, processoId: derivedProcessoAuto.id, responsavelId: derivedResponsavelId, substitutoId: derivedSubstitutoId })
      const nova = (await listDemandas()).find((d) => d.protocolo === protocolo)
      if (!nova) throw new Error('Demanda derivada criada sem retorno de id.')
      const tpl = PROCESS_TEMPLATES[derivedType]
      const deadline = new Date()
      deadline.setHours(deadline.getHours() + tpl.slaHours)
      saveGovernanceMeta(nova.id, {
        processType: derivedType,
        risk: tpl.risk,
        channel: 'SISTEMA',
        deadline: deadline.toISOString(),
        localStepState: {},
      })
      linkDerivedDemand(demanda.id, nova.id)
      await logAction('GEROU_DERIVADA', `Protocolo ${protocolo}. Tipo ${derivedType}. Justificativa: ${derivedReason.trim()}`)
      await carregarTudo()
      setShowDerived(false)
      setDerivedReason('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao criar demanda derivada')
    } finally {
      setSaving(false)
    }
  }

  async function onToggleChecklistStep(step: ChecklistStep) {
    if (!demanda || !currentUser) return

    try {
      setSaving(true)
      if (step.source === 'db') {
        if (step.completed) return
        await executarEtapa(demanda.id, step.id)
        await logAction('ETAPA_EXECUTADA', step.nome)
      } else {
        const next = !step.completed
        setLocalStepState(demanda.id, step.id, next, {
          userId: currentUser.id,
          userName: currentUser.nome,
        })
        await logAction(next ? 'CHECKLIST_POP_CONCLUIDO' : 'CHECKLIST_POP_REABERTO', step.nome)
      }
      await carregarTudo()
    } finally {
      setSaving(false)
    }
  }

  async function onBloquearDemanda() {
    if (!demanda) return
    try {
      setSaving(true)
      await atualizarStatusDemanda(demanda.id, 'bloqueada')
      await logAction('PROCESSO_BLOQUEADO', 'Bloqueio manual executado no painel de governanca.', 'CRITICAL')
      await carregarTudo()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Carregando demanda...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!demanda) return <p>Demanda nao encontrada.</p>
  if (!hasAccess) return <p className="text-red-700">Acesso negado: demanda fora da sua responsabilidade.</p>

  const meta = getGovernanceMeta(demanda.id)
  const processoLabel = (currentType && PROCESS_TEMPLATES[currentType]?.title) ?? demanda.processo?.nome ?? 'Nao informado'
  const statusNorm = normalize(demanda.status)
  const statusClass = statusNorm.includes('concluida') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : statusNorm.includes('bloqueada') ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'
  const etapasConcluidas = checklistSteps.filter((step) => step.completed).length
  const progressoPercentual = checklistSteps.length > 0 ? Math.round((etapasConcluidas / checklistSteps.length) * 100) : 0
  const processData = meta.processData ?? {}
  const impacts = meta.impacts ?? (currentType ? PROCESS_TEMPLATES[currentType]?.mandatoryImpacts ?? [] : [])
  const hasSpecificData =
    Boolean(processData.candidateName) ||
    Boolean(processData.beneficiaryName) ||
    Boolean(processData.mpNumber) ||
    Boolean(processData.dismissalType) ||
    Boolean(processData.attendanceSubject) ||
    Boolean(processData.absencyType) ||
    Boolean(processData.uniformItems) ||
    Boolean(processData.errorType) ||
    Boolean(processData.description)

  return (
    <div className="space-y-6">
      {showOverride ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Override Gerencial</h3>
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{overrideViolations.map((v) => <p key={v}>- {v}</p>)}</div>
            <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="mt-3 h-28 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Justificativa obrigatoria" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowOverride(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancelar</button>
              <button onClick={() => void onConfirmOverride()} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Confirmar override</button>
            </div>
          </div>
        </div>
      ) : null}

      {showCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Cancelar Demanda</h3>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="mt-3 h-28 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Motivo detalhado do cancelamento" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowCancel(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Fechar</button>
              <button onClick={() => void onCancelDemanda()} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Confirmar cancelamento</button>
            </div>
          </div>
        </div>
      ) : null}

      {showDerived ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Criar Demanda Derivada</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select value={derivedType} onChange={(e) => setDerivedType(e.target.value as ProcessType)} className="rounded-lg border border-slate-300 px-3 py-2">{Object.entries(PROCESS_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}</select>
              <div className={`rounded-lg border px-3 py-2 text-sm ${derivedProcessoAuto ? 'border-slate-300 text-slate-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                {derivedProcessoAuto ? `Processo vinculado: ${derivedProcessoAuto.nome}` : 'Sem processo correspondente na tabela processos para este tipo FP'}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select value={derivedResponsavelId} onChange={(e) => setDerivedResponsavelId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Responsavel</option>{allUsuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}</select>
              <select value={derivedSubstitutoId} onChange={(e) => setDerivedSubstitutoId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Substituto</option>{allUsuarios.filter((u) => u.id !== derivedResponsavelId).map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}</select>
            </div>
            <textarea value={derivedReason} onChange={(e) => setDerivedReason(e.target.value)} className="mt-3 h-24 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Justificativa da derivacao" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowDerived(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancelar</button>
              <button onClick={() => void onCriarDerivada()} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white">Criar derivada</button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/demandas" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Voltar para demandas</Link>
            <h2 className="text-2xl font-bold text-slate-900">Demanda {demanda.protocolo}</h2>
            <p className="mt-1 text-slate-600">Processo: <strong>{processoLabel}</strong></p>
            <p className="text-sm text-slate-500">Responsavel: {demanda.responsavel?.nome ?? 'Nao vinculado'} | Substituto: {demanda.substituto?.nome ?? 'Nao vinculado'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}>{demanda.status}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isOverdue ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}>{isOverdue ? 'SLA estourado' : 'Dentro do SLA'}</span>
            {strictSLA ? <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">SLA rigido ativo</span> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={saving} onClick={() => setShowDerived(true)} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">Criar Demanda Derivada Manual</button>
          {statusNorm.includes('bloqueada') ? (
            <button disabled={saving || !managerAccess} onClick={async () => { setSaving(true); try { await atualizarStatusDemanda(demanda.id, 'em_andamento'); await logAction('DEMANDA_DESBLOQUEADA', 'Desbloqueio manual por perfil gerencial.'); await carregarTudo() } finally { setSaving(false) } }} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60">Desbloquear Processo</button>
          ) : (
            <button disabled={saving || !managerAccess} onClick={() => void onBloquearDemanda()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60">Bloquear Processo</button>
          )}
          <button disabled={saving} onClick={() => void onConcluir(false)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Concluir Demanda</button>
          <button disabled={saving} onClick={() => setShowCancel(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancelar Demanda</button>
        </div>
      </section>

      {strictSLA && isOverdue ? <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />SLA rigido ativo: demanda atrasada exige perfil gerencial para override/conclusao.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prazo</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock3 className="h-4 w-4 text-slate-500" />{demanda.deadline ? new Date(demanda.deadline).toLocaleString('pt-BR') : '-'}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Etapas Concluidas</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{etapasConcluidas} / {checklistSteps.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendencias Abertas</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><FileWarning className="h-4 w-4 text-amber-600" />{pendenciasAbertas.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risco / Tipo</p><p className="mt-2 text-sm font-semibold text-slate-800">{meta.risk ?? '-'}</p><p className="text-xs text-slate-500">{currentType ?? '-'}</p></div>
      </div>

      {hasSpecificData ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-slate-800">DADOS ESPECIFICOS DO PROCESSO</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {processData.candidateName ? <p className="text-sm"><span className="text-slate-500">Candidato:</span> <strong>{processData.candidateName}</strong></p> : null}
            {processData.beneficiaryName ? <p className="text-sm"><span className="text-slate-500">Beneficiario:</span> <strong>{processData.beneficiaryName}</strong></p> : null}
            {processData.mpNumber ? <p className="text-sm"><span className="text-slate-500">MP (Prefeitura):</span> <strong>{processData.mpNumber}</strong></p> : null}
            {processData.dismissalType ? <p className="text-sm"><span className="text-slate-500">Tipo de Aviso:</span> <strong>{processData.dismissalType}</strong></p> : null}
            {processData.attendanceSubject ? <p className="text-sm"><span className="text-slate-500">Assunto do Atendimento:</span> <strong>{processData.attendanceSubject}</strong></p> : null}
            {processData.immediateResolution ? <p className="text-sm"><span className="text-slate-500">Resolucao Imediata:</span> <strong>{processData.resolutionType ?? 'SIM'}</strong></p> : null}
            {processData.absencyType ? <p className="text-sm"><span className="text-slate-500">Justificativa:</span> <strong>{processData.absencyType}</strong></p> : null}
            {processData.absencyType === 'DECLARACAO' ? <p className="text-sm"><span className="text-slate-500">Horario:</span> <strong>{processData.hoursStart ?? '-'} as {processData.hoursEnd ?? '-'}</strong></p> : null}
            {processData.uniformItems ? <p className="text-sm sm:col-span-2"><span className="text-slate-500">Itens Solicitados:</span> <strong>{processData.uniformItems}</strong></p> : null}
            {processData.errorType ? <p className="text-sm"><span className="text-slate-500">Classificacao do Erro:</span> <strong>{processData.errorType}</strong></p> : null}
            {processData.description ? <p className="text-sm sm:col-span-2"><span className="text-slate-500">Descricao:</span> <strong>{processData.description}</strong></p> : null}
          </div>
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900"><GanttChartSquare className="h-4 w-4 text-blue-600" />Checklist (POPs)</h3>
              <span className="text-xs text-slate-500">Conformidade Obrigatoria</span>
            </div>
            <div className="space-y-2">
              {checklistSteps.map((step) => {
                const stClass = normalize(step.status).includes('conclu') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : normalize(step.status).includes('andamento') ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'
                return (
                  <div key={step.id} className={`rounded-lg border border-slate-200 p-3 ${step.completed ? 'bg-emerald-50/40' : ''}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={step.completed}
                            disabled={saving || (step.source === 'db' && step.completed)}
                            onChange={() => void onToggleChecklistStep(step)}
                            className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-600 disabled:cursor-not-allowed"
                          />
                          <div>
                            <p className={`font-medium ${step.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{step.nome}</p>
                            <p className="text-xs text-slate-500">Ordem: {step.ordem ?? '-'} {step.source === 'template' ? '| checklist POP padrao' : ''}</p>
                            {step.completedBy ? <p className="text-xs text-emerald-700">Concluido por {step.completedBy}</p> : null}
                            {step.documentRequired && !step.completed ? <p className="mt-1 text-xs font-medium text-blue-600">Anexar Comprovante (PDF)</p> : null}
                          </div>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 self-start">
                        {step.critical ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Critico</span> : null}
                        {!step.critical && step.required ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">Obrigatorio</span> : null}
                        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${stClass}`}>{step.status}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {checklistSteps.length === 0 ? <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Sem etapas cadastradas no banco para este processo e sem template POP associado.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-800">Progresso</p>
              <p className="text-xl font-bold text-blue-600">{progressoPercentual}%</p>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressoPercentual}%` }}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">Pendencias</h3>
            <div className="space-y-2">
              {pendencias.map((p) => {
                const resolvida = p.resolvida === true || ['resolvida', 'concluida', 'fechada'].includes(String(p.status ?? '').toLowerCase())
                return <div key={p.id} className="rounded-lg border border-slate-200 p-3"><p className="mb-2 text-sm text-slate-700">{p.descricao}</p><button disabled={saving || resolvida} onClick={async () => { setSaving(true); try { await resolvePendencia(p.id); await logAction('PENDENCIA_RESOLVIDA', p.descricao); await carregarTudo() } finally { setSaving(false) } }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">{resolvida ? 'Resolvida' : 'Resolver'}</button></div>
              })}
            </div>
          </section>
        </section>

        <section className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><ShieldAlert className="h-4 w-4 text-purple-600" />Acoes de Governanca</h3>
            <div className="grid gap-2">
              <button disabled={saving || !managerAccess} onClick={() => { setOverrideViolations(['Conclusao forcada solicitada manualmente.']); setShowOverride(true) }} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">Forcar conclusao</button>
              <p className="text-xs text-slate-500">As demais acoes operacionais estao no cabecalho da demanda.</p>
            </div>
          </section>

          {childrenRows.length > 0 ? <section className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm"><h3 className="mb-2 flex items-center gap-2 font-semibold text-purple-900"><Sparkles className="h-4 w-4" />Demandas Derivadas</h3><ul className="space-y-1 text-sm text-purple-800">{childrenRows.map((child) => <li key={child.id}><Link href={`/demandas/${child.id}`} className="hover:underline">{child.protocolo}</Link> - {child.status}</li>)}</ul></section> : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold text-slate-400">DETALHES DA DEMANDA</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Risco</p>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{meta.risk ?? '-'}</span>
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm text-slate-500"><FileWarning className="h-3.5 w-3.5" /> Canal de Entrada</p>
                <p className="text-xl font-medium text-slate-900">{meta.channel ?? '-'}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm text-slate-500"><Calendar className="h-3.5 w-3.5" /> Prazo Limite</p>
                <p className={`text-2xl font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>{demanda.deadline ? new Date(demanda.deadline).toLocaleDateString('pt-BR') : '-'}</p>
              </div>
              <hr className="border-slate-200" />
              <div>
                <p className="flex items-center gap-1 text-sm text-slate-500"><User className="h-3.5 w-3.5" /> Responsavel</p>
                <p className="text-xl font-medium text-slate-900">{demanda.responsavel?.nome ?? '-'}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm text-slate-500"><User className="h-3.5 w-3.5" /> Substituto</p>
                <p className="text-xl font-medium text-slate-900">{demanda.substituto?.nome ?? '-'}</p>
              </div>
              {impacts.length > 0 ? (
                <div>
                  <p className="text-sm text-slate-500">Impactos</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {impacts.map((impact) => (
                      <span key={impact} className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{impact}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <h3 className="mb-2 text-2xl font-bold text-blue-900">Compliance</h3>
            <p className="text-sm text-blue-800">O sistema realiza bloqueios automaticos para mitigar o risco {meta.risk ?? '-'}. Documentos e etapas criticas permanecem auditaveis.</p>
          </section>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">Trilha Auditavel</h3>
        <ul className="space-y-2">
          {logs.map((log) => <li key={log.id} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-semibold text-slate-800">{log.action}</p><p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('pt-BR')} - {log.userName} ({log.userRole})</p>{log.details ? <p className="mt-1 text-slate-700">{log.details}</p> : null}</li>)}
        </ul>
      </section>
    </div>
  )
}
