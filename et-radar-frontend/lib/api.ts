import axios from 'axios'
import { getToken } from '@/lib/auth'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(
  config => {
    const token = getToken()
    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  err => Promise.reject(err)
)

// Add response interceptor for error handling
api.interceptors.response.use(
  res => res,
  err => {
    console.error('API Error:', err.response?.status, err.config?.url)
    return Promise.reject(err)
  }
)

export default api

// ── Typed API functions matching backend exactly ──────────────────

// Read app/routes/stocks.py for exact response shape
export async function getStocks() {
  const r = await api.get('/stocks')
  return r.data as Stock[]
}

export async function getStockPrices() {
  try {
    const r = await api.get('/stocks/prices')
    return r.data
  } catch {
    try {
      const r = await api.get('/stocks')
      return r.data.map((s: any) => ({
        ...s,
        latest_close: null,
        change: 0,
        change_pct: 0,
        date: null
      }))
    } catch {
      return []
    }
  }
}

export async function getOHLCV(symbol: string, days = 365) {
  const r = await api.get('/ohlcv', { params: { symbol, days } })
  return r.data as OHLCVRow[]
}

export async function getFilings(symbol?: string, limit = 10) {
  const r = await api.get('/filings', { params: { symbol, limit } })
  return r.data as Filing[]
}

export async function getBulkDeals(limit = 20) {
  const r = await api.get('/bulk-deals', { params: { limit } })
  return r.data as BulkDeal[]
}

// Read app/routes/signals.py for exact response shape
export async function getSignals(limit = 20, action_hint?: string) {
  const r = await api.get('/opportunity-radar', {
    params: { limit, ...(action_hint && { action_hint }) }
  })
  return r.data as { data: Signal[], total: number, page: number, pages: number }
}

// Read app/routes/patterns.py for exact response shape
export async function getPatterns(symbol: string) {
  const r = await api.get('/chart-patterns', { params: { symbol } })
  return r.data as Pattern[]
}

export async function getAllPatterns() {
  const r = await api.get('/chart-patterns/all')
  return r.data as { symbol: string, name: string, patterns: Pattern[] }[]
}

export async function getStatus() {
  const r = await api.get('/status')
  return r.data
}

export async function seedDemo() {
  const r = await api.get('/demo/seed')
  return r.data
}

// Read app/routes/portfolio.py for exact multipart upload shape
export async function uploadPortfolio(file: File, sessionId: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  const r = await api.post('/portfolio/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000  // portfolio analysis takes ~15s
  })
  return r.data as PortfolioResult
}

export async function getPortfolioHistory(sessionId: string) {
  const r = await api.get('/portfolio/history', { params: { session_id: sessionId } })
  return r.data as PortfolioHistoryItem[]
}

export async function getPortfolioById(portfolioId: number | string) {
  const r = await api.get(`/portfolio/${portfolioId}`)
  return r.data as { id: number; session_id: string; data: PortfolioResult; total_value: number; xirr: number | null; created_at: string }
}

// Read app/routes/chat.py — this is a streaming endpoint
export type ChatStreamEvent = string | { type: 'citations'; citations: Citation[] }

export async function* streamChat(
  message: string,
  sessionId: string,
  includePortfolio: boolean,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      include_portfolio: includePortfolio
    })
  })
  
  if (!res.ok) throw new Error(`Chat error: ${res.status}`)
  
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      // Flush leftover for legacy plain-text streams (no SSE framing).
      const tail = buffer.trim()
      if (tail) {
        if (tail.startsWith('data:')) {
          const data = tail.replace(/^data:\s*/, '').trim()
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data) as { type?: string; content?: string; citations?: Citation[] }
              if (parsed.type === 'token') {
                yield parsed.content || ''
              } else if (parsed.type === 'citations') {
                yield { type: 'citations', citations: (parsed.citations || []) as Citation[] }
              }
            } catch {
              yield data
            }
          }
        } else {
          yield tail
        }
      }
      break
    }

    buffer += decoder.decode(value, { stream: true })

    // Compatibility mode: legacy backend can stream plain text chunks directly.
    if (!buffer.includes('data:') && !buffer.includes('\n\n')) {
      const plain = buffer
      buffer = ''
      if (plain) {
        yield plain
      }
      continue
    }
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const evt of events) {
      const line = evt
        .split('\n')
        .find((l) => l.startsWith('data:'))

      // Legacy fallback for non-SSE framed event blocks.
      if (!line) {
        const legacy = evt.trim()
        if (legacy) {
          yield legacy
        }
        continue
      }
      const data = line.replace(/^data:\s*/, '').trim()

      if (data === '[DONE]') {
        return
      }

      try {
        const parsed = JSON.parse(data) as { type?: string; content?: string; citations?: Citation[] }
        if (parsed.type === 'token') {
          yield parsed.content || ''
        } else if (parsed.type === 'citations') {
          yield { type: 'citations', citations: (parsed.citations || []) as Citation[] }
        } else if (parsed.type === 'done') {
          return
        }
      } catch {
        // Backward compatibility for older plain-token streams.
        yield data
      }
    }
  }
}

// ── TypeScript types matching backend Pydantic models ─────────────

// Matches app/models/tables.py Stock model
export interface Stock {
  id: number
  symbol: string
  name: string
  exchange: string
  sector: string | null
}

// Matches app/routes/stocks.py OHLCVOut
export interface OHLCVRow {
  date: string    // "YYYY-MM-DD" string — backend serializes as str
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Matches app/routes/signals.py SignalOut
export interface Signal {
  id: number
  stock: { symbol: string; name: string; sector: string | null }
  signal_type: string
  confidence: number      // 0-100
  one_line_summary: string
  action_hint: 'buy_watch' | 'sell_watch' | 'neutral'
  reason: string
  created_at: string      // ISO string
}

// Matches app/routes/patterns.py PatternOut
export interface Pattern {
  pattern_name: string   // "52_week_breakout" | "golden_cross" | etc
  detected_today: boolean
  explanation: string
  backtest: {
    occurrences: number
    success_rate: number  // 0.0 to 1.0
    avg_return_pct: number
    win_rate?: number | null
    avg_return?: number | null
    best_return?: number | null
    worst_return?: number | null
    sample_size?: number
    forward_days?: number
    note?: string
  }
}

export interface Filing {
  id: number
  date: string
  category: string
  raw_text: string
  source_url: string | null
}

export interface BulkDeal {
  id: number
  date: string
  client_name: string
  deal_type: 'buy' | 'sell'
  quantity: number
  price: number
  stock: { symbol: string; name: string }
}

export interface PortfolioResult {
  session_id: string
  total_value: number
  xirr: number | null
  funds: {
    fund_name: string
    units: number
    current_nav: number
    current_value: number
    allocation_pct: number
  }[]
  overlap: {
    fund_a: string
    fund_b: string
    overlap_pct: number
  }[]
  expense_drag: number
  rebalancing_suggestion: string
}

export interface PortfolioHistoryItem {
  id: number
  created_at: string
  total_value: number
  xirr: number | null
}

export interface Citation {
  id: string
  type: 'filing' | 'signal' | 'portfolio' | string
  label: string
  date: string
  source: string
}
