'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Send, Users, MessageSquare, CheckCheck, Check, Radio } from 'lucide-react'
import type { Usuario, Mensaje } from '@/types'

/* ─── Helpers ────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })
}

function Avatar({ name, size = 32, colorIdx = 0 }: { name: string; size?: number; colorIdx?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
      style={{
        width: size, height: size,
        background: `hsl(${(colorIdx * 61) % 360}, 55%, 38%)`,
      }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

/* ─── Types ──────────────────────────────────────────────── */

type ConversationId = string | 'general'

interface Conversation {
  id: ConversationId
  nombre: string
  lastMsg: string
  lastTime: string
  unread: number
  colorIdx: number
}

/* ─── Main Component ─────────────────────────────────────── */

export default function ChatPage() {
  const supabase = createClient()
  const { profile, isAdmin } = useAuth()

  const [choferes, setChoferes] = useState<Usuario[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<ConversationId>('general')
  const [messages, setMessages] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  /* ── Load choferes (admin only) ── */
  useEffect(() => {
    if (!isAdmin) return
    supabase.from('usuarios').select('*').eq('rol', 'chofer').order('nombre')
      .then(({ data }) => setChoferes(data ?? []))
  }, [isAdmin, supabase])

  /* ── Build conversation list ── */
  const buildConversations = useCallback(async () => {
    if (!profile) return
    const { data: msgs } = await supabase
      .from('mensajes')
      .select('*')
      .order('created_at', { ascending: false })

    const all = msgs ?? []

    if (isAdmin) {
      // Group by partner (general or specific chofer)
      const byPartner: Record<string, Mensaje[]> = { general: [] }
      all.forEach((m: Mensaje) => {
        if (!m.para_usuario_id) {
          byPartner.general.push(m)
        } else {
          const partner = m.de_usuario_id === profile.id ? m.para_usuario_id! : m.de_usuario_id
          if (!byPartner[partner]) byPartner[partner] = []
          byPartner[partner].push(m)
        }
      })

      const convList: Conversation[] = [
        {
          id: 'general',
          nombre: 'General',
          lastMsg: byPartner.general[0]?.contenido ?? 'Sin mensajes',
          lastTime: byPartner.general[0]?.created_at ?? '',
          unread: byPartner.general.filter(m => !m.leido && m.de_usuario_id !== profile.id).length,
          colorIdx: 0,
        },
        ...choferes.map((c, i) => {
          const conv = byPartner[c.id] ?? []
          return {
            id: c.id,
            nombre: c.nombre,
            lastMsg: conv[0]?.contenido ?? 'Sin mensajes',
            lastTime: conv[0]?.created_at ?? '',
            unread: conv.filter(m => !m.leido && m.de_usuario_id === c.id).length,
            colorIdx: i + 1,
          }
        }),
      ]
      setConversations(convList)
    } else {
      // Chofer: single conversation with admin
      const adminMsgs = all.filter((m: Mensaje) =>
        (m.de_usuario_id === profile.id) ||
        (m.para_usuario_id === profile.id) ||
        (!m.para_usuario_id)
      )
      setConversations([{
        id: 'admin',
        nombre: 'Administración',
        lastMsg: adminMsgs[0]?.contenido ?? 'Sin mensajes',
        lastTime: adminMsgs[0]?.created_at ?? '',
        unread: adminMsgs.filter(m => !m.leido && m.de_usuario_id !== profile.id).length,
        colorIdx: 0,
      }])
      setSelectedId('admin')
    }
  }, [profile, isAdmin, choferes, supabase])

  useEffect(() => { buildConversations() }, [buildConversations])

  /* ── Load messages for selected conversation ── */
  const loadMessages = useCallback(async () => {
    if (!profile || !selectedId) return
    setLoadingMsgs(true)

    let query = supabase.from('mensajes').select('*').order('created_at')

    if (selectedId === 'general') {
      query = query.is('para_usuario_id', null)
    } else if (selectedId === 'admin') {
      // Chofer view: messages with admin + broadcasts
      const { data: admins } = await supabase.from('usuarios').select('id').eq('rol', 'admin').limit(1)
      const adminId = admins?.[0]?.id
      if (adminId) {
        query = supabase.from('mensajes').select('*')
          .or(`para_usuario_id.is.null,and(de_usuario_id.eq.${profile.id},para_usuario_id.eq.${adminId}),and(de_usuario_id.eq.${adminId},para_usuario_id.eq.${profile.id})`)
          .order('created_at')
      }
    } else {
      // Admin direct conversation with a chofer
      query = supabase.from('mensajes').select('*')
        .or(`and(de_usuario_id.eq.${profile.id},para_usuario_id.eq.${selectedId}),and(de_usuario_id.eq.${selectedId},para_usuario_id.eq.${profile.id})`)
        .order('created_at')
    }

    const { data } = await query
    setMessages(data ?? [])
    setLoadingMsgs(false)

    // Mark as read
    if ((data ?? []).length > 0) {
      const unreadIds = (data ?? [])
        .filter((m: Mensaje) => !m.leido && m.de_usuario_id !== profile.id)
        .map((m: Mensaje) => m.id)
      if (unreadIds.length > 0) {
        await supabase.from('mensajes').update({ leido: true }).in('id', unreadIds)
        buildConversations()
      }
    }
  }, [profile, selectedId, supabase, buildConversations])

  useEffect(() => { loadMessages() }, [loadMessages])

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const msg = payload.new as Mensaje
          const isForMe = !msg.para_usuario_id ||
            msg.para_usuario_id === profile.id ||
            msg.de_usuario_id === profile.id
          if (!isForMe) return

          // Append to current conversation if relevant
          const inCurrentConv =
            (selectedId === 'general' && !msg.para_usuario_id) ||
            (selectedId === 'admin' && (
              !msg.para_usuario_id ||
              (msg.de_usuario_id === profile.id) ||
              (msg.para_usuario_id === profile.id)
            )) ||
            (selectedId !== 'general' && selectedId !== 'admin' && (
              (msg.de_usuario_id === profile.id && msg.para_usuario_id === selectedId) ||
              (msg.de_usuario_id === selectedId && msg.para_usuario_id === profile.id)
            ))

          if (inCurrentConv) {
            setMessages(prev => [...prev, msg])
          }
          buildConversations()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile, selectedId, supabase, buildConversations])

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!texto.trim() || !profile || sending) return
    setSending(true)

    let paraId: string | null = null
    if (selectedId === 'general') {
      paraId = null
    } else if (selectedId === 'admin') {
      const { data } = await supabase.from('usuarios').select('id').eq('rol', 'admin').limit(1)
      paraId = data?.[0]?.id ?? null
    } else {
      paraId = selectedId
    }

    const { error } = await supabase.from('mensajes').insert({
      de_usuario_id: profile.id,
      para_usuario_id: paraId,
      contenido: texto.trim(),
      tipo: 'texto',
      leido: false,
    })

    if (!error) setTexto('')
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const selectedConv = conversations.find(c => c.id === selectedId)

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-8rem)] bg-bg-secondary border border-border-color rounded-2xl overflow-hidden">

      {/* ── Conversation list ── */}
      <div className={`${isAdmin ? 'w-72' : 'w-64'} border-r border-border-color flex flex-col flex-shrink-0`}>
        <div className="px-4 py-4 border-b border-border-color">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <MessageSquare size={15} className="text-accent-cyan" />
            Mensajes
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button key={conv.id} onClick={() => setSelectedId(conv.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-border-color/40 hover:bg-bg-tertiary ${
                selectedId === conv.id ? 'bg-accent-cyan/10 border-l-2 border-l-accent-cyan' : ''
              }`}
            >
              {conv.id === 'general' ? (
                <div className="w-8 h-8 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center flex-shrink-0">
                  <Radio size={13} className="text-accent-cyan" />
                </div>
              ) : (
                <Avatar name={conv.nombre} size={32} colorIdx={conv.colorIdx} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary truncate">{conv.nombre}</span>
                  {conv.lastTime && (
                    <span className="text-[10px] text-text-secondary flex-shrink-0 ml-1">{timeAgo(conv.lastTime)}</span>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary truncate mt-0.5">{conv.lastMsg}</p>
              </div>
              {conv.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-accent-cyan text-bg-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {conv.unread > 9 ? '9+' : conv.unread}
                </span>
              )}
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="py-8 text-center text-xs text-text-secondary">
              <Users size={24} className="mx-auto mb-2 opacity-30" />
              Sin conversaciones
            </div>
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-color bg-bg-secondary">
          {selectedConv?.id === 'general' ? (
            <div className="w-9 h-9 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center">
              <Radio size={15} className="text-accent-cyan" />
            </div>
          ) : (
            <Avatar name={selectedConv?.nombre ?? '?'} size={36} colorIdx={selectedConv?.colorIdx ?? 0} />
          )}
          <div>
            <p className="text-sm font-semibold text-text-primary">{selectedConv?.nombre ?? '—'}</p>
            <p className="text-[11px] text-text-secondary">
              {selectedConv?.id === 'general' ? 'Mensaje a todos los choferes' : 'Conversación directa'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loadingMsgs ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-secondary">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No hay mensajes aún</p>
              <p className="text-xs mt-1">Enviá el primero</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.de_usuario_id === profile?.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isMe && (
                    <Avatar name={msg.de_usuario?.nombre ?? '?'} size={28} colorIdx={3} />
                  )}
                  <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-accent-cyan text-bg-primary rounded-br-sm'
                        : 'bg-bg-tertiary border border-border-color text-text-primary rounded-bl-sm'
                    }`}>
                      {msg.contenido}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] text-text-secondary ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span>{timeAgo(msg.created_at)}</span>
                      {isMe && (msg.leido
                        ? <CheckCheck size={11} className="text-accent-cyan" />
                        : <Check size={11} />
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-border-color bg-bg-secondary">
          <div className="flex items-end gap-3">
            <textarea
              className="flex-1 input resize-none min-h-[40px] max-h-[100px] py-2.5 text-sm"
              placeholder="Escribí un mensaje..."
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!texto.trim() || sending}
              className="btn-primary p-2.5 rounded-xl flex-shrink-0 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] text-text-secondary mt-1.5">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  )
}
