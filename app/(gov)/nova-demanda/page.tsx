'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  atualizarStatusDemanda,
  criarDemanda,
  existeDemandaComProtocolo,
  gerarProximoProtocoloAnual,
  listDemandas,
  listProcessos,
  listUsuarios,
  type Processo,
  type Usuario,
} from '@/lib/services/govsys'
import type { FormEvent } from 'react'
import { useGovContext } from '@/components/providers/gov-provider'
import {
  PROCESS_TEMPLATES,
  appendGovernanceLog,
  inferTypeFromProcessName,
  saveGovernanceMeta,
  type OriginChannel,
  type ProcessType,
} from '@/lib/services/governance-local'
import { getResponsaveisPorProcesso } from '@/lib/services/demandas'

function calcularPrazoISO(slaHours: number): string {
  const date = new Date()
  date.setHours(date.getHours() + slaHours)
  return date.toISOString()
}

export default function NovaDemandaPage() {
  const router = useRouter()
  const { currentUser } = useGovContext()

  const [processos, setProcessos] = useState<{ id: string; nome: string }[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [protocolo, setProtocolo] = useState('')
  const [processoId, setProcessoId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [substitutoId, setSubstitutoId] = useState('')
  const [manualProcessType, setManualProcessType] = useState<ProcessType>('FP03_ATENDIMENTO')
  const [channel, setChannel] = useState<OriginChannel>('SISTEMA')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [mpNumber, setMpNumber] = useState('')
  const [dismissalType, setDismissalType] = useState('TRABALHADO')
  const [attendanceSubject, setAttendanceSubject] = useState('ORIENTACAO_GERAL')
  const [immediateResolution, setImmediateResolution] = useState(false)
  const [resolutionType, setResolutionType] = useState('INFORMACAO')
  const [absencyType, setAbsencyType] = useState('ATESTADO')
  const [hoursStart, setHoursStart] = useState('')
  const [hoursEnd, setHoursEnd] = useState('')
  const [uniformItems, setUniformItems] = useState('')
  const [errorType, setErrorType] = useState('ERRO_SISTEMA')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingProtocol, setGeneratingProtocol] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deadlinePreview, setDeadlinePreview] = useState<string | null>(null)
  const [protocoloTouched, setProtocoloTouched] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [p, u] = await Promise.all([listProcessos(), listUsuarios()])
        setProcessos(p)
        setUsuarios(u)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar cadastros')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  useEffect(() => {
    if (!processoId) {
      setResponsavelId('')
      setSubstitutoId('')
      return
    }

    let active = true

    async function fetchResponsaveis() {
      try {
        const { principal, secundario } = await getResponsaveisPorProcesso(processoId)
        if (!active) return
        setResponsavelId(principal?.id || '')
        setSubstitutoId(secundario?.id || '')
      } catch {
        if (!active) return
        setResponsavelId('')
        setSubstitutoId('')
      }
    }

    void fetchResponsaveis()
    return () => {
      active = false
    }
  }, [processoId])

  const selectedProcess = useMemo(
    () => processos.find((p) => p.id === processoId) ?? null,
    [processos, processoId]
  )
  const processOptions = useMemo(() => {
    const order: ProcessType[] = [
      'FP01_ADMISSAO',
      'FP02_DEMISSAO',
      'FP03_ATENDIMENTO',
      'FP04_PONTO',
      'FP05_FARDAMENTO',
      'FP06_BENEFICIOS',
    ]

    const typedMap = new Map<ProcessType, Processo | null>()
    const unknown: Processo[] = []

    for (const type of order) {
      typedMap.set(type, null)
    }

    for (const processo of processos) {
      const inferred = inferTypeFromProcessName(processo.nome)
      if (inferred) {
        if (!typedMap.get(inferred)) typedMap.set(inferred, processo)
      } else {
        unknown.push(processo)
      }
    }

    const typed = order.map((type) => {
      const processo = typedMap.get(type)
      return {
        key: type,
        value: processo?.id ?? '',
        label: PROCESS_TEMPLATES[type].title,
        available: Boolean(processo),
      }
    })

    const unknownOptions = unknown.map((item) => {
      const type = inferTypeFromProcessName(item.nome)
      return {
        key: item.id,
        value: item.id,
        label: type ? PROCESS_TEMPLATES[type].title : item.nome,
        available: true,
      }
    })

    return [...typed, ...unknownOptions]
  }, [processos])

  const missingTypes = useMemo(
    () =>
      processOptions
        .filter((option) => !option.available && option.key in PROCESS_TEMPLATES)
        .map((option) => option.label),
    [processOptions]
  )
  const inferredProcessType = useMemo(
    () => inferTypeFromProcessName(selectedProcess?.nome),
    [selectedProcess?.nome]
  )
  const effectiveProcessType = inferredProcessType ?? manualProcessType
  const template = PROCESS_TEMPLATES[effectiveProcessType]
  const impacts = template.mandatoryImpacts
  const prazoPreview = useMemo(
    () => (deadlinePreview ? new Date(deadlinePreview).toLocaleDateString('pt-BR') : ''),
    [deadlinePreview]
  )

  useEffect(() => {
    if (!processoId) return
    if (!title) {
      const subject = template.title.split(' - ')[1] ?? template.title
      setTitle(`${subject}: `)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId, effectiveProcessType])

  useEffect(() => {
    if (!processoId) {
      setDeadlinePreview(null)
      return
    }
    setDeadlinePreview(calcularPrazoISO(template.slaHours))
  }, [processoId, template.slaHours])

  async function gerarProtocoloUnico() {
    try {
      setGeneratingProtocol(true)
      setError(null)
      const candidate = await gerarProximoProtocoloAnual('GOV')
      setProtocolo(candidate)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar protocolo')
    } finally {
      setGeneratingProtocol(false)
    }
  }

  useEffect(() => {
    if (protocoloTouched) return
    void gerarProtocoloUnico()
  }, [protocoloTouched])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const protocoloLimpo = protocolo.trim().toUpperCase()

    if (!protocoloLimpo || !processoId || !responsavelId || !substitutoId) {
      setError('Preencha protocolo, processo, responsavel e substituto.')
      return
    }

    if (effectiveProcessType === 'FP01_ADMISSAO' && !candidateName.trim()) {
      setError('Informe o nome do candidato para FP 01.')
      return
    }
    if (effectiveProcessType === 'FP02_DEMISSAO' && !mpNumber.trim()) {
      setError('Informe o numero da MP (Prefeitura) para FP 02.')
      return
    }
    if (effectiveProcessType === 'FP04_PONTO' && absencyType === 'DECLARACAO' && (!hoursStart || !hoursEnd)) {
      setError('Para Declaracao, informe hora inicio e hora fim.')
      return
    }
    if ((effectiveProcessType === 'FP05_FARDAMENTO' || effectiveProcessType === 'FP06_BENEFICIOS') && !beneficiaryName.trim()) {
      setError('Informe o nome do beneficiario para este processo.')
      return
    }

    if (responsavelId === substitutoId) {
      setError('Responsavel e substituto devem ser diferentes.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const duplicate = await existeDemandaComProtocolo(protocoloLimpo)
      if (duplicate) {
        setError('Protocolo ja existe. Clique em "Gerar novo" ou altere manualmente.')
        return
      }

      await criarDemanda({ protocolo: protocoloLimpo, processoId, responsavelId, substitutoId })

      const lista = await listDemandas()
      const created = lista.find((d) => d.protocolo === protocoloLimpo)

      if (created && currentUser) {
        const processData = {
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          candidateName: candidateName.trim() || undefined,
          beneficiaryName: beneficiaryName.trim() || undefined,
          mpNumber: mpNumber.trim() || undefined,
          dismissalType: dismissalType || undefined,
          attendanceSubject: attendanceSubject || undefined,
          immediateResolution,
          resolutionType: immediateResolution ? resolutionType : undefined,
          absencyType: absencyType || undefined,
          hoursStart: hoursStart || undefined,
          hoursEnd: hoursEnd || undefined,
          uniformItems: uniformItems.trim() || undefined,
          errorType: errorType || undefined,
        }

        saveGovernanceMeta(created.id, {
          processType: effectiveProcessType,
          risk: template.risk,
          impacts,
          channel,
          deadline: calcularPrazoISO(template.slaHours),
          localStepState:
            effectiveProcessType === 'FP03_ATENDIMENTO' && immediateResolution
              ? Object.fromEntries(
                  template.steps.map((step) => [
                    step.id,
                    {
                      completed: true,
                      completedAt: new Date().toISOString(),
                      completedBy: currentUser.nome,
                      completedById: currentUser.id,
                    },
                  ])
                )
              : {},
          processData,
        })

        if (effectiveProcessType === 'FP03_ATENDIMENTO' && immediateResolution) {
          await atualizarStatusDemanda(created.id, 'concluida')
          appendGovernanceLog({
            demandaId: created.id,
            userId: currentUser.id,
            userName: currentUser.nome,
            userRole: currentUser.role,
            action: 'RESOLUCAO_IMEDIATA',
            details: `Demanda encerrada no atendimento. Tipo: ${resolutionType}.`,
            severity: 'INFO',
          })
        }

        appendGovernanceLog({
          demandaId: created.id,
          userId: currentUser.id,
          userName: currentUser.nome,
          userRole: currentUser.role,
          action: 'DEMANDA_CRIADA',
          details: `Criada via ${channel}. Tipo ${effectiveProcessType}. SLA ${template.slaHours}h. Impactos: ${impacts.join(', ')}. Protocolo ${protocoloLimpo}.`,
          severity: 'INFO',
        })
      }

      router.push('/demandas')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar demanda')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Nova Demanda</h2>
        <p className="text-slate-500">Cadastro operacional conectado ao Supabase.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {effectiveProcessType === 'FP03_ATENDIMENTO' ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-semibold">Axioma de Registro (FP 03):</p>
            <p>&quot;O que nao esta no sistema, nao existe&quot;. Registre a origem real da demanda para controle de canais.</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Processo (Ficha de Procedimento)</label>
            <select value={processoId} onChange={(e) => setProcessoId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" disabled={loading}>
              <option value="">Selecione</option>
              {processOptions.map((p) => (
                <option key={p.key} value={p.value || `missing-${p.key}`} disabled={!p.available}>
                  {p.label}
                  {!p.available ? ' (nao cadastrado no banco)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Canal de origem (Rastreabilidade)</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as OriginChannel)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="SISTEMA">Plataforma (Direto)</option>
              <option value="WHATSAPP">WhatsApp (Importado)</option>
              <option value="EMAIL">Email</option>
              <option value="PRESENCIAL">Presencial (Balcao)</option>
              <option value="OFICIO">Oficio</option>
              <option value="TELEFONE">Telefone</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Protocolo</label>
          <div className="flex gap-2">
            <input
              value={protocolo}
              onChange={(e) => {
                setProtocoloTouched(true)
                setProtocolo(e.target.value.toUpperCase())
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="GOV-2026-0001"
            />
            <button
              type="button"
              onClick={() => void gerarProtocoloUnico()}
              disabled={generatingProtocol || saving}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              {generatingProtocol ? 'Gerando...' : 'Gerar novo'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Formato simples: GOV-ANO-SEQUENCIA (reinicia no ano seguinte).</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          Processo selecionado: <strong>{processoId ? PROCESS_TEMPLATES[effectiveProcessType].title : '-'}</strong> | Risco default:{' '}
          <strong>{processoId ? template.risk : '-'}</strong> | SLA: <strong>{processoId ? `${template.slaHours}h` : '-'}</strong> | Prazo estimado:{' '}
          <strong>{deadlinePreview ? new Date(deadlinePreview).toLocaleString('pt-BR') : '-'}</strong>
          <div className="mt-2 flex flex-wrap gap-2">
            {impacts.map((impact) => (
              <span key={impact} className="rounded border border-slate-300 bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700">
                {impact} (POP)
              </span>
            ))}
          </div>
        </div>

        {missingTypes.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Processos ainda nao cadastrados na tabela <strong>processos</strong>: {missingTypes.join(' | ')}.
          </div>
        ) : null}

        {processoId && !inferredProcessType ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs text-amber-800">
              Nao foi possivel inferir automaticamente a classificacao deste processo. Selecione manualmente:
            </p>
            <select
              value={manualProcessType}
              onChange={(e) => setManualProcessType(e.target.value as ProcessType)}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
            >
              {Object.entries(PROCESS_TEMPLATES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {effectiveProcessType === 'FP01_ADMISSAO' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome do Candidato</label>
            <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
        ) : null}

        {effectiveProcessType === 'FP02_DEMISSAO' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">MP (Prefeitura)</label>
              <input value={mpNumber} onChange={(e) => setMpNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Aviso</label>
              <select value={dismissalType} onChange={(e) => setDismissalType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="TRABALHADO">Trabalhado</option>
                <option value="INDENIZADO">Indenizado</option>
                <option value="ANTECIPADO">Antecipado</option>
                <option value="JUSTA_CAUSA">Justa Causa</option>
              </select>
            </div>
          </div>
        ) : null}

        {effectiveProcessType === 'FP03_ATENDIMENTO' ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Assunto do Atendimento</label>
              <select value={attendanceSubject} onChange={(e) => setAttendanceSubject(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="ORIENTACAO_GERAL">Orientacao Geral</option>
                <option value="SLRH">Suporte SLRH (Cadastro)</option>
                <option value="MENTORY">Acesso Banco Mentory</option>
                <option value="PONTO_DIGITAL">Acesso Ponto Digital</option>
                <option value="EVENTO_ATIPICO">Registro Evento Atipico</option>
              </select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={immediateResolution} onChange={(e) => setImmediateResolution(e.target.checked)} />
                <span>
                  <strong>Resolucao imediata (Balcao)</strong>
                  <span className="block text-sm text-slate-600">Marque se a solicitacao foi resolvida durante o atendimento. O protocolo sera encerrado automaticamente.</span>
                </span>
              </label>
              {immediateResolution ? (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase">Tipo de Resolucao</label>
                  <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="INFORMACAO">Prestacao de Informacao</option>
                    <option value="CORRECAO">Correcao Simples</option>
                    <option value="ENCAMINHAMENTO">Encaminhamento</option>
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {effectiveProcessType === 'FP04_PONTO' ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Documento</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="absency_type" value="ATESTADO" checked={absencyType === 'ATESTADO'} onChange={(e) => setAbsencyType(e.target.value)} />
                  Atestado (Abono de Dias)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="absency_type" value="DECLARACAO" checked={absencyType === 'DECLARACAO'} onChange={(e) => setAbsencyType(e.target.value)} />
                  Declaracao (Abono de Horas)
                </label>
              </div>
            </div>
            {absencyType === 'DECLARACAO' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Hora Inicio</label>
                  <input type="time" value={hoursStart} onChange={(e) => setHoursStart(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Hora Fim</label>
                  <input type="time" value={hoursEnd} onChange={(e) => setHoursEnd(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {(effectiveProcessType === 'FP05_FARDAMENTO' || effectiveProcessType === 'FP06_BENEFICIOS') ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome do Colaborador (Beneficiario)</label>
            <input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
        ) : null}

        {effectiveProcessType === 'FP05_FARDAMENTO' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Itens Solicitados</label>
            <textarea value={uniformItems} onChange={(e) => setUniformItems(e.target.value)} className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
        ) : null}

        {effectiveProcessType === 'FP06_BENEFICIOS' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Classificacao do Erro</label>
            <select value={errorType} onChange={(e) => setErrorType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="ERRO_CADASTRO">Erro de Cadastro</option>
              <option value="ERRO_SISTEMA">Erro Sistemico</option>
              <option value="ERRO_INFORMACAO">Erro de Informacao</option>
              <option value="AJUSTE_BENEFICIO">Ajuste de Beneficio</option>
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Titulo da Demanda</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descricao / Detalhes</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Prazo (SLA Automatico)</label>
            <input value={prazoPreview} readOnly className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700" />
            <p className="mt-1 text-xs text-slate-500">Baseado no SLA da FP selecionada.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Responsavel principal</label>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" disabled={loading}>
              <option value="">Selecione</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>
              ))}
            </select>
            {currentUser ? <p className="mt-1 text-xs text-slate-500">Usuario atual: {currentUser.nome} ({currentUser.role})</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Substituto</label>
            <select value={substitutoId} onChange={(e) => setSubstitutoId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" disabled={loading}>
              <option value="">Selecione</option>
              {usuarios.filter((u) => u.id !== responsavelId).map((u) => (
                <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Salvando...' : 'Criar demanda'}
        </button>
      </form>
    </div>
  )
}
