import { workflowEngine } from '@/lib/engine/workflow-engine'
import { demandasRepository } from '@/lib/services/demandas'

type Demanda = {
  id: string
  status: string | null
  protocolo: string | null
  processo_id: string | null
}

type Etapa = {
  id: string
  nome: string
  processo_id: string
}

type WorkflowData = {
  demanda: Demanda
  etapas: Etapa[]
}

export async function carregarWorkflow(demandaId: string): Promise<WorkflowData> {
  const snapshot = await demandasRepository.loadWorkflowSnapshot(demandaId)
  return {
    demanda: {
      id: snapshot.demanda.id,
      status: snapshot.demanda.status,
      protocolo: snapshot.demanda.protocolo,
      processo_id: snapshot.demanda.processoId,
    },
    etapas: snapshot.etapas.map((etapa) => ({
      id: etapa.id,
      nome: etapa.nome,
      processo_id: snapshot.demanda.processoId ?? '',
    })),
  }
}

export async function executarEtapa(demandaId: string, etapaId: string): Promise<void> {
  const result = await workflowEngine.executarEtapa({ demandaId, etapaId })
  if (!result.ok) {
    throw new Error('Falha ao executar etapa via engine.')
  }
}

export async function concluirDemanda(demandaId: string): Promise<{ erro?: string; ok?: true }> {
  const result = await workflowEngine.concluirDemanda({ demandaId })
  if (!result.ok) {
    const bloqueio = result.bloqueios.map((issue) => issue.message).join(' | ')
    return { erro: bloqueio || 'Demanda bloqueada pelas regras de governanca.' }
  }
  return { ok: true }
}
