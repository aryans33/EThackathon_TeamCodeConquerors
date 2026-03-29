'use client'
import { useState, useEffect, useRef } from 'react'
import { streamChat, type Citation } from '@/lib/api'
import { getSessionId } from '@/lib/session'

const CHAT_STORAGE_KEY = 'et_radar_chat_v1'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isError?: boolean
  followUps?: string[]
  citations?: Citation[]
}

interface ChatSession {
  id: string
  date: string
  messages: Message[]
}

interface ChatStorage {
  sessions: ChatSession[]
}

// Simple markdown formatter
function renderMarkdown(text: string) {
  // Bold
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Lists
  html = html.split('\n').map(line => {
    if (line.trim().startsWith('•')) {
      return `<li class="ml-4 list-disc">${line.replace(/^•\s*/, '')}</li>`
    }
    return line
  }).join('<br/>')

  return <div dangerouslySetInnerHTML={{ __html: html }} className="leading-relaxed" />
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })
}

function groupMessagesByDate(rawSessions: ChatSession[]): ChatSession[] {
  const all = rawSessions
    .flatMap((s) => s.messages)
    .filter((m) => m?.role && m?.content && m?.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const grouped: ChatSession[] = []
  const byDay = new Map<string, number>()

  for (const msg of all) {
    const key = dayKey(msg.timestamp)
    const idx = byDay.get(key)
    if (idx === undefined) {
      grouped.push({
        id: `session-${key}-${makeId()}`,
        date: msg.timestamp,
        messages: [{ ...msg, id: msg.id || makeId() }],
      })
      byDay.set(key, grouped.length - 1)
    } else {
      grouped[idx].messages.push({ ...msg, id: msg.id || makeId() })
    }
  }

  return grouped
}

function capSessions(sessions: ChatSession[]): ChatSession[] {
  if (sessions.length <= 10) return sessions
  return sessions.slice(sessions.length - 10)
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const [input, setInput] = useState('')
  const [hasPortfolio, setHasPortfolio] = useState(false)
  const [includePortfolio, setIncludePortfolio] = useState(true)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const allMessages = sessions.flatMap((s) => s.messages)

  const persistSessions = (next: ChatSession[]) => {
    const capped = capSessions(next)
    setSessions(capped)
    if (typeof window !== 'undefined') {
      const payload: ChatStorage = { sessions: capped }
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload))
    }
  }

  const appendMessage = (message: Message) => {
    setSessions((prev) => {
      const next = [...prev]
      const msgDate = message.timestamp || new Date().toISOString()
      const key = dayKey(msgDate)
      const idx = next.findIndex((s) => dayKey(s.date) === key)

      if (idx === -1) {
        next.push({
          id: `session-${key}-${makeId()}`,
          date: msgDate,
          messages: [message],
        })
      } else {
        next[idx] = {
          ...next[idx],
          messages: [...next[idx].messages, message],
        }
      }

      const capped = capSessions(next)
      if (typeof window !== 'undefined') {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ sessions: capped }))
      }
      return capped
    })
  }

  const updateMessageById = (messageId: string, updater: (msg: Message) => Message) => {
    setSessions((prev) => {
      const next = prev.map((session) => ({
        ...session,
        messages: session.messages.map((msg) => (msg.id === messageId ? updater(msg) : msg)),
      }))

      const capped = capSessions(next)
      if (typeof window !== 'undefined') {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ sessions: capped }))
      }
      return capped
    })
  }

  const updateLastAssistantFollowUps = (followUps: string[]) => {
    setSessions((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        const msgs = [...next[i].messages]
        for (let j = msgs.length - 1; j >= 0; j--) {
          if (msgs[j].role === 'assistant') {
            msgs[j] = { ...msgs[j], followUps }
            next[i] = { ...next[i], messages: msgs }
            const capped = capSessions(next)
            if (typeof window !== 'undefined') {
              localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ sessions: capped }))
            }
            return capped
          }
        }
      }
      return prev
    })
  }

  async function getFollowUps(lastResponse: string): Promise<string[]> {
    try {
      const res = await fetch('http://localhost:8000/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Based on this answer: "${lastResponse.slice(0, 200)}", suggest 2 very short follow-up questions (max 8 words each) an Indian retail investor would ask. Return ONLY a JSON array: ["question 1", "question 2"] No explanation, no markdown.`,
        }),
      })
      const data = await res.json()
      try {
        const parsed = JSON.parse(data.response)
        return Array.isArray(parsed) ? parsed.slice(0, 2) : []
      } catch {
        return []
      }
    } catch {
      return []
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('et_radar_portfolio')
      if (stored) setHasPortfolio(true)

      const raw = localStorage.getItem(CHAT_STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ChatStorage
          const loaded = Array.isArray(parsed.sessions) ? parsed.sessions : []
          const grouped = groupMessagesByDate(loaded)
          persistSessions(grouped)
        } catch {
          persistSessions([])
        }
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, showTyping])

  const submitQuestion = (text: string) => {
    setInput(text)
    handleSubmit(text)
  }

  const handleSubmit = async (text: string = input.trim()) => {
    if (!text || isLoading) return

    setInput('')
    appendMessage({
      id: makeId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    })

    setIsLoading(true)
    setShowTyping(true)

    try {
      const assistantMessageId = makeId()
      appendMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        citations: [],
      })

      let full = ''
      let latestCitations: Citation[] = []

      for await (const evt of streamChat(
        text,
        getSessionId(),
        includePortfolio,
      )) {
        if (typeof evt === 'string') {
          if (showTyping) {
            setShowTyping(false)
          }
          full += evt
          updateMessageById(assistantMessageId, (msg) => ({
            ...msg,
            content: msg.content + evt,
          }))
        } else if (evt.type === 'citations') {
          latestCitations = evt.citations
          updateMessageById(assistantMessageId, (msg) => ({
            ...msg,
            citations: evt.citations,
          }))
        }
      }

      if (!full.trim()) {
        updateMessageById(assistantMessageId, (msg) => ({
          ...msg,
          content: 'AI is temporarily unavailable. Please try again.',
          isError: true,
        }))
      } else {
        const followUps = await getFollowUps(full)
        if (followUps.length > 0) {
          updateMessageById(assistantMessageId, (msg) => ({
            ...msg,
            followUps,
            citations: latestCitations,
          }))
        }
      }

      setShowTyping(false)
      setIsLoading(false)
    } catch {
      appendMessage({
        id: makeId(),
        role: 'assistant',
        content: 'AI is temporarily unavailable. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      })
      setShowTyping(false)
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const starterChips = [
    "What are today's top signals?",
    "Which stocks show breakout patterns?",
    "Analyse my portfolio risk",
    "Explain the biggest bulk deal today"
  ]

  const clearHistory = () => {
    const ok = window.confirm('Clear all chat history? This cannot be undone.')
    if (!ok) return
    localStorage.removeItem(CHAT_STORAGE_KEY)
    setSessions([])
    setIsLoading(false)
    setShowTyping(false)
  }

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <main className="flex flex-col min-h-[calc(100dvh-65px)] md:h-[calc(100vh-65px)] dark:bg-black bg-gray-50 transition-colors">
      {/* TOP BAR */}
      <div className="flex flex-wrap justify-between items-center gap-2 px-4 md:px-6 py-3 md:py-4 dark:border-[#2a2a2a] border-gray-300 border-b dark:bg-black/80 bg-white">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg md:text-xl font-bold dark:text-[#f0fdf4] text-[#1f2937]">ET Radar AI</h1>
          <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse mt-1" />
        </div>
        
        <div className="flex items-center gap-2">
          {hasPortfolio && (
            <label className="flex items-center space-x-2 cursor-pointer dark:bg-black bg-gray-200 px-3 py-1.5 rounded-lg dark:border-[#2a2a2a] border-gray-400 border dark:hover:border-[#d4af37] hover:border-gray-500 transition-colors">
              <input 
                type="checkbox" 
                checked={includePortfolio}
                onChange={(e) => setIncludePortfolio(e.target.checked)}
                className="accent-[#d4af37] w-4 h-4 cursor-pointer"
              />
              <span className="text-sm font-medium dark:text-[#9ca3af] text-gray-700 select-none">Portfolio context</span>
            </label>
          )}
          <button
            type="button"
            onClick={clearHistory}
            className="bg-transparent border border-transparent px-2 py-1 rounded-md text-[#6b7280] hover:text-red-400 transition-colors"
            title="Clear history"
          >
            Clear
          </button>
        </div>
      </div>

      {/* MESSAGE AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {allMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 dark:bg-slate-700 bg-slate-300 rounded-2xl flex items-center justify-center mb-6 dark:border-slate-800 border-slate-200 border">
              <svg className="w-8 h-8 dark:text-[#d4af37] text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h2 className="text-2xl font-bold dark:text-[#f0fdf4] text-[#1f2937] mb-2">What would you like to know?</h2>
            <p className="dark:text-[#64748b] text-gray-600 mb-8">Ask about signals, your portfolio, or any NSE/BSE stock.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {starterChips.map(chip => (
                <button
                  key={chip}
                  onClick={() => submitQuestion(chip)}
                  className="rounded-full dark:border-[#22314a] border-gray-300 border dark:bg-[#101827] bg-gray-100 px-4 py-3 text-sm dark:text-[#9ca3af] text-gray-700 dark:hover:border-[#d4af37] hover:border-[#d4af37] dark:hover:text-white hover:text-[#1f2937] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {sessions.map((session) => (
              <div key={session.id} className="space-y-4">
                <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 12, margin: '16px 0' }}>
                  <span style={{ background: '#161b22', padding: '4px 12px', borderRadius: 20 }}>
                    {formatSessionDate(session.date)}
                  </span>
                </div>

                {session.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full dark:bg-black/30 bg-black/5 dark:border-black/50 border-black/10 border flex items-center justify-center text-xs dark:text-[#d4af37] text-[#d4af37] font-bold mr-3 mt-1 select-none">
                        ET
                      </div>
                    )}

                    <div className="flex flex-col max-w-[80%]">
                      <div className={`group relative px-5 py-3 text-sm ${
                        msg.role === 'user' 
                            ? 'dark:bg-black bg-black/5 rounded-2xl rounded-tr-sm dark:text-white text-black dark:border-[#2a2a2a] border-black/20 border' 
                          : msg.isError
                            ? 'dark:bg-red-900/20 bg-red-100 dark:border-red-900 border-red-300 border rounded-2xl rounded-tl-sm dark:text-red-400 text-red-700'
                            : 'dark:bg-black bg-white rounded-2xl rounded-tl-sm dark:text-[#e2e8f0] text-[#1f2937] dark:border-[#2a2a2a] border-gray-300 border shadow-sm'
                      }`}>
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}

                        {msg.role === 'assistant' && !msg.isError && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="absolute top-2 right-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-200"
                            title="Copy"
                          >
                            {copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>

                      <span className={`text-xs dark:text-[#64748b] text-gray-600 mt-1.5 ${msg.role === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {msg.role === 'assistant' && msg.followUps && msg.followUps.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 ml-1">
                          {msg.followUps.map((q, idx) => (
                            <button
                              key={`${msg.id}-fu-${idx}`}
                              onClick={() => submitQuestion(q)}
                              className="px-3.5 py-1.5 text-xs rounded-full border transition-colors"
                              style={{
                                background: '#1f2937',
                                border: '1px solid #374151',
                                color: '#9ca3af',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#d4af37'
                                e.currentTarget.style.color = '#d4af37'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#374151'
                                e.currentTarget.style.color = '#9ca3af'
                              }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 ml-1 rounded-lg border border-[#2f4f75] bg-[#101827] px-3 py-2">
                          <p className="text-[11px] font-medium text-[#9ca3af] mb-1">Sources</p>
                          <div className="space-y-1">
                            {msg.citations.map((c) => (
                              <div key={`${msg.id}-${c.id}`} className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    c.type === 'filing' ? 'bg-[#d4af37]' : c.type === 'signal' ? 'bg-green-500' : 'bg-amber-500'
                                  }`}
                                />
                                <span className="truncate">{c.label}</span>
                                <span className="ml-auto whitespace-nowrap">{c.date} · {c.source}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {isLoading && showTyping && (
              <div className="flex justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full dark:bg-black/30 bg-black/5 dark:border-black/50 border-black/10 border flex items-center justify-center text-xs dark:text-[#d4af37] text-[#d4af37] font-bold mr-3 mt-1 select-none">
                  ET
                </div>
                <div style={{ display: 'flex', gap: 4, padding: '12px 16px', alignItems: 'center' }} className="dark:bg-slate-800 bg-slate-200 dark:border-slate-700 border-slate-300 border shadow-sm rounded-2xl rounded-tl-sm">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4af37', animation: 'bounce 1s infinite' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4af37', animation: 'bounce 1s infinite 0.2s' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4af37', animation: 'bounce 1s infinite 0.4s' }} />
                </div>
              </div>
            )}
            
            {/* INVISIBLE SCROLL ANCHOR */}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="p-4 dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border-t">
        <div className="max-w-3xl mx-auto relative flex items-end space-x-2">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about any stock, signal, or your portfolio..."
            rows={1}
            className="flex-1 dark:bg-black bg-gray-100 dark:border-[#2a2a2a] border-gray-300 border rounded-xl px-4 py-3 text-sm dark:text-white text-[#1f2937] dark:placeholder-[#64748b] placeholder-gray-500 resize-none focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] disabled:opacity-50 min-h-[46px] max-h-32 overflow-y-auto transition-colors"
          />
          <button 
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 dark:bg-[#d4af37] dark:hover:bg-[#e4c06a] bg-[#d4af37] hover:bg-[#c49f33] dark:disabled:bg-[#22314a] disabled:bg-gray-300 dark:disabled:text-[#64748b] disabled:text-gray-600 dark:text-[#07130f] text-black rounded-xl w-12 h-12 flex items-center justify-center transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 dark:border-[#64748b] border-gray-400 border-2 dark:border-t-white border-t-black rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            )}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </main>
  )
}

