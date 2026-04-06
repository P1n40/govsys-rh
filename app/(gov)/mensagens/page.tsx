'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Paperclip, Send, UserRound } from 'lucide-react'
import { useGovContext } from '@/components/providers/gov-provider'
import {
  anexarArquivoMensagem,
  criarMensagem,
  listarAnexosPorMensagens,
  listarMensagens,
  listUsuarios,
  type Mensagem,
  type MensagemAnexo,
  type Usuario,
} from '@/lib/services/govsys'
import { supabase } from '@/lib/supabase'

type MessageBanner = {
  type: 'success' | 'error'
  text: string
}

type MensagemView = Mensagem & {
  anexos: MensagemAnexo[]
  remetenteNome: string
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}

function toPublicUrl(path: string): string {
  if (!path) return '#'
  const fromStorage = supabase.storage.from('anexos').getPublicUrl(path).data.publicUrl
  return fromStorage || '#'
}

export default function MensagensPage() {
  const { currentUser, canManage } = useGovContext()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [mensagens, setMensagens] = useState<MensagemView[]>([])
  const [conteudo, setConteudo] = useState('')
  const [destinatarioId, setDestinatarioId] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])
  const [banner, setBanner] = useState<MessageBanner | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [mensageriaDisponivel, setMensageriaDisponivel] = useState(true)

  const usuariosPorId = useMemo(
    () => new Map(usuarios.map((user) => [user.id, user.nome])),
    [usuarios]
  )

  async function carregarMensagens() {
    try {
      if (!currentUser?.id) {
        setMensagens([])
        return
      }

      const allMessages = await listarMensagens({})
      const visibleMessages = allMessages.filter((msg) => {
        if (canManage) return true
        if (!msg.destinatario_id) return true
        return msg.remetente_id === currentUser.id || msg.destinatario_id === currentUser.id
      })

      const anexosRows = await listarAnexosPorMensagens(visibleMessages.map((msg) => msg.id))
      const anexosByMensagem = new Map<string, MensagemAnexo[]>()
      for (const item of anexosRows) {
        const current = anexosByMensagem.get(item.mensagem_id) ?? []
        current.push(item)
        anexosByMensagem.set(item.mensagem_id, current)
      }

      const enriched = visibleMessages.map((msg) => ({
        ...msg,
        anexos: anexosByMensagem.get(msg.id) ?? [],
        remetenteNome: usuariosPorId.get(msg.remetente_id) ?? 'Usuario',
      }))
      setMensageriaDisponivel(true)
      setMensagens(enriched)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Erro ao carregar mensagens.'
      setMensageriaDisponivel(false)
      setMensagens([])
      setBanner({ type: 'error', text })
    }
  }

  async function carregarTudo() {
    try {
      setLoading(true)
      setBanner(null)
      const users = await listUsuarios()
      setUsuarios(users)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Erro ao carregar usuarios.'
      setBanner({ type: 'error', text })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarTudo()
  }, [])

  useEffect(() => {
    if (!loading) {
      void carregarMensagens()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentUser?.id, canManage, usuarios])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBanner(null)

    if (!currentUser?.id) {
      setBanner({ type: 'error', text: 'Usuario atual nao identificado.' })
      return
    }
    if (!conteudo.trim() && anexos.length === 0) {
      setBanner({ type: 'error', text: 'Digite uma mensagem ou anexe ao menos um arquivo.' })
      return
    }

    try {
      setSending(true)
      const novaMensagem = await criarMensagem({
        remetenteId: currentUser.id,
        destinatarioId: destinatarioId || undefined,
        conteudo: conteudo.trim() || '[Arquivo enviado sem texto]',
      })

      for (const arquivo of anexos) {
        await anexarArquivoMensagem({
          mensagemId: novaMensagem.id,
          arquivo,
        })
      }

      setConteudo('')
      setAnexos([])
      setDestinatarioId('')
      setMensageriaDisponivel(true)
      setBanner({ type: 'success', text: 'Mensagem enviada com sucesso.' })
      await carregarMensagens()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Erro ao enviar mensagem.'
      if (text.includes('sql/create_mensagens.sql')) {
        setMensageriaDisponivel(false)
      }
      setBanner({ type: 'error', text })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <p>Carregando mensagens...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Mensagens</h2>
        <p className="text-slate-500">Canal interno para comunicacao entre colaboradores do RH com suporte a anexos.</p>
      </div>

      {banner ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            banner.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Nova Mensagem</h3>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destinatario</label>
            <select
              value={destinatarioId}
              onChange={(event) => setDestinatarioId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Canal aberto (todos podem ver)</option>
              {usuarios
                .filter((user) => user.id !== currentUser?.id)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nome} ({user.role})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mensagem</label>
            <textarea
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
              className="h-28 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Escreva sua mensagem..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Anexos</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Paperclip className="h-4 w-4" />
              Selecionar arquivos
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : []
                  setAnexos(files)
                }}
              />
            </label>
            {anexos.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
                {anexos.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={sending || !mensageriaDisponivel}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Enviando...' : 'Enviar mensagem'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Caixa de Mensagens</h3>
        <div className="space-y-3">
          {mensagens.map((mensagem) => {
            const ownMessage = mensagem.remetente_id === currentUser?.id
            return (
              <article
                key={mensagem.id}
                className={`rounded-xl border p-3 ${
                  ownMessage
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="font-semibold text-slate-700">{mensagem.remetenteNome}</span>
                  <span>-</span>
                  <span>{formatDate(mensagem.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800">{mensagem.conteudo}</p>
                {mensagem.anexos.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {mensagem.anexos.map((anexo) => (
                      <a
                        key={anexo.id}
                        href={toPublicUrl(anexo.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Anexo: {anexo.url.split('/').pop() ?? 'arquivo'}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            )
          })}
          {mensagens.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Nenhuma mensagem encontrada.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
