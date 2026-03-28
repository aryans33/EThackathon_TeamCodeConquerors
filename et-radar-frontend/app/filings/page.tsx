'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type ApiFiling = {
  symbol: string
  company_name: string
  title: string
  category: string
  filing_date: string
  confidence_score: number
  summary: string
  source_url: string | null
}

type FilingCard = {
  id: number
  symbol: string
  company: string
  category: string
  title: string
  summary: string
  date: string
  confidence: number
  sourceUrl?: string | null
}

const DEMO_FILINGS: FilingCard[] = [
  { id: 1, symbol: 'TATAMOTORS', company: 'Tata Motors Limited', category: 'Earnings', title: 'Board meeting to consider Q3 results', summary: 'Board meeting scheduled for quarterly results and margin outlook update with management commentary.', date: '2 days ago', confidence: 84 },
  { id: 2, symbol: 'HDFCBANK', company: 'HDFC Bank Limited', category: 'Bulk Deals', title: 'Bulk deal: Goldman Sachs acquires 1.2cr shares', summary: 'Large institutional acquisition disclosed through exchange filing, indicating accumulation at current levels.', date: '3 days ago', confidence: 76 },
  { id: 3, symbol: 'RELIANCE', company: 'Reliance Industries Limited', category: 'Expansion', title: 'Capex announcement: INR 8,000cr greenfield plant', summary: 'Board approved multi-year expansion capex for new capacity with phased commissioning timeline.', date: '1 day ago', confidence: 73 },
  { id: 4, symbol: 'SBIN', company: 'State Bank of India', category: 'Management', title: 'Management change: CFO resignation announced', summary: 'Company disclosed CFO resignation with interim transition committee and search process details.', date: '4 days ago', confidence: 69 },
  { id: 5, symbol: 'INFY', company: 'Infosys Limited', category: 'Earnings', title: 'Pre-quarter update indicates stable order book', summary: 'Company shared pre-quarter business update and reiterated guidance on revenue and operating margin.', date: '2 days ago', confidence: 82 },
  { id: 6, symbol: 'TCS', company: 'Tata Consultancy Services Limited', category: 'Management', title: 'Board appoints new independent director', summary: 'Board approved appointment of independent director with sector expertise effective next month.', date: '5 days ago', confidence: 69 },
  { id: 7, symbol: 'BAJFINANCE', company: 'Bajaj Finance Limited', category: 'Bulk Deals', title: 'Block trade: domestic mutual fund raises stake', summary: 'Domestic institution disclosed block trade purchase in the company at a marginal premium.', date: '1 day ago', confidence: 76 },
]

const CATEGORY_BADGES: Record<string, { bg: string; text: string }> = {
  Earnings: { bg: '#166534', text: '#86efac' },
  'Bulk Deals': { bg: '#000000', text: '#d4af37' },
  Expansion: { bg: '#3b0764', text: '#d8b4fe' },
  Management: { bg: '#7c2d12', text: '#fdba74' },
}

type FilterKey = 'All' | 'Earnings' | 'Bulk Deals' | 'Management' | 'Expansion'

function toRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function normalizeApiRows(rows: ApiFiling[]): FilingCard[] {
  return rows.map((r, idx) => ({
    id: idx + 1,
    symbol: r.symbol,
    company: r.company_name || r.symbol,
    category: r.category,
    title: r.title,
    summary: r.summary,
    date: toRelativeDate(r.filing_date),
    confidence: r.confidence_score,
    sourceUrl: r.source_url,
  }))
}

function matchesFilter(filing: FilingCard, activeFilter: FilterKey): boolean {
  if (activeFilter === 'All') return true
  if (activeFilter === 'Earnings') return filing.category === 'Earnings'
  if (activeFilter === 'Bulk Deals') return filing.category === 'Bulk Deals'
  if (activeFilter === 'Management') return filing.category === 'Management'
  return filing.category === 'Expansion'
}

export default function FilingsPage() {
  const router = useRouter()
  const [filings, setFilings] = useState<FilingCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')

  async function fetchFilings() {
    try {
      const res = await api.get('/filings?limit=20')
      const rows = Array.isArray(res.data) ? (res.data as ApiFiling[]) : []
      if (rows.length === 0) {
        setFilings(DEMO_FILINGS)
      } else {
        setFilings(normalizeApiRows(rows))
      }
    } catch {
      setFilings(DEMO_FILINGS)
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      await fetchFilings()
      if (mounted) {
        setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchFilings()
    setRefreshing(false)
  }

  const tabItems: FilterKey[] = ['All', 'Earnings', 'Bulk Deals', 'Management', 'Expansion']

  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = {
      All: filings.length,
      Earnings: filings.filter((f) => matchesFilter(f, 'Earnings')).length,
      'Bulk Deals': filings.filter((f) => matchesFilter(f, 'Bulk Deals')).length,
      Management: filings.filter((f) => matchesFilter(f, 'Management')).length,
      Expansion: filings.filter((f) => matchesFilter(f, 'Expansion')).length,
    }
    return map
  }, [filings])

  const visibleFilings = useMemo(() => filings.filter((f) => matchesFilter(f, activeFilter)), [filings, activeFilter])

  return (
    <main className="max-w-[900px] mx-auto px-4 py-6 md:py-8 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-content-primary text-2xl font-bold">Latest Filings</h1>
          <p className="text-content-secondary text-sm mt-1">AI-detected signals from BSE announcements</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-2 text-sm rounded-lg border border-border bg-surface-1 hover:border-amber-500 text-content-primary disabled:opacity-60 transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabItems.map((tab) => {
          const active = activeFilter === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                  ? 'bg-amber-500/20 border-amber-500 text-amber-500'
                  : 'bg-surface-1 border-border text-content-secondary hover:text-content-primary hover:border-amber-500'
              }`}
            >
              {tab} ({counts[tab]})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-[10px] border border-border bg-surface-1 p-5 animate-pulse">
              <div className="h-4 w-40 bg-slate-300 dark:bg-slate-700 rounded" />
              <div className="h-4 w-72 bg-slate-300 dark:bg-slate-700 rounded mt-3" />
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded mt-2" />
              <div className="h-2 w-48 bg-slate-300 dark:bg-slate-700 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : visibleFilings.length === 0 ? (
        <div className="rounded-[10px] border border-border bg-surface-1 px-6 py-10 text-center">
          <div className="text-5xl leading-none">-</div>
          <div className="text-content-primary text-lg font-semibold mt-3">No filings found</div>
          <div className="text-content-secondary text-sm mt-1">Try refreshing or check back after market hours</div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFilings.map((f) => {
            const badge = CATEGORY_BADGES[f.category] || { bg: '#1f2937', text: '#cbd5e1' }
            return (
              <article
                key={f.id}
                onClick={() => router.push(`/stock/${f.symbol}`)}
                className="rounded-[10px] border border-border bg-surface-1 p-5 transition-colors hover:border-amber-500 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-content-primary text-base font-bold">{f.symbol}</div>
                    <div className="text-content-secondary text-[13px]">{f.company}</div>
                  </div>
                  <span
                    className="px-2 py-1 rounded-md text-xs font-medium"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {f.category}
                  </span>
                </div>

                <h2 className="text-content-primary text-[15px] font-semibold mt-[10px]">{f.title}</h2>
                <p className="text-content-secondary text-[13px] mt-1">{f.summary}</p>
                {f.sourceUrl && (
                  <a
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex mt-2 text-xs text-[#d4af37] dark:text-[#d4af37] hover:text-[#c49f33] dark:hover:text-[#e4c06a]"
                  >
                    View source
                  </a>
                )}

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-content-secondary">
                      <span>Confidence</span>
                      <span className="text-content-primary font-medium">{f.confidence}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-200 dark:bg-[#0d1117] border border-border overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${f.confidence}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-content-secondary whitespace-nowrap">{f.date}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
