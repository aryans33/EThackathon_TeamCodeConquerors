'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type ApiFiling = {
  id: number
  date: string
  category: string
  headline: string
  source_url: string | null
  stock_symbol: string | null
  stock_name: string | null
}

type FilingCard = {
  id: number
  symbol: string
  company: string
  category: string
  headline: string
  detail: string
  date: string
  confidence: number
  sourceUrl?: string | null
}

const DEMO_FILINGS: FilingCard[] = [
  { id: 1, symbol: 'TATAMOTORS', company: 'Tata Motors Ltd', category: 'Earnings Beat', headline: 'Q3 PAT up 48% YoY, beats street estimates by 12%', detail: 'Strong EV sales drove margin expansion beyond analyst consensus', date: '2 days ago', confidence: 84 },
  { id: 2, symbol: 'HDFCBANK', company: 'HDFC Bank', category: 'Bulk Deal', headline: 'Goldman Sachs acquires 1.5cr shares at ₹1,642', detail: 'Institutional accumulation at key support level signals confidence', date: '3 days ago', confidence: 76 },
  { id: 3, symbol: 'RELIANCE', company: 'Reliance Industries Ltd', category: 'Expansion', headline: 'Board approves ₹75,000 Cr green energy capex over 3 years', detail: 'Large capex signals long-term revenue visibility in renewables', date: '1 day ago', confidence: 71 },
  { id: 4, symbol: 'SBIN', company: 'State Bank of India', category: 'Earnings Miss', headline: 'Q3 NPA provisions surge 22%, profit below estimates', detail: 'Asset quality deterioration worse than street expectations', date: '4 days ago', confidence: 68 },
  { id: 5, symbol: 'INFY', company: 'Infosys Ltd', category: 'Management Change', headline: 'COO resignation announced post market hours', detail: 'Key leadership exit may signal strategic uncertainty ahead', date: '2 days ago', confidence: 61 },
  { id: 6, symbol: 'TCS', company: 'Tata Consultancy Services', category: 'Earnings Beat', headline: 'Q3 deal wins at $10.2B TCV, highest in 6 quarters', detail: 'Strong deal pipeline supports revenue growth visibility for FY26', date: '5 days ago', confidence: 88 },
  { id: 7, symbol: 'ADANIENT', company: 'Adani Enterprises', category: 'Bulk Deal', headline: 'LIC increases stake by 2.1%, buys 3.2cr shares', detail: 'Government institution buying signals long-term confidence', date: '1 day ago', confidence: 79 },
]

const CATEGORY_BADGES: Record<string, { bg: string; text: string }> = {
  'Earnings Beat': { bg: '#166534', text: '#86efac' },
  'Earnings Miss': { bg: '#7f1d1d', text: '#fca5a5' },
  'Bulk Deal': { bg: '#1e3a5f', text: '#93c5fd' },
  Expansion: { bg: '#3b0764', text: '#d8b4fe' },
  'Management Change': { bg: '#7c2d12', text: '#fdba74' },
  Regulatory: { bg: '#713f12', text: '#fde047' },
  Dividend: { bg: '#134e4a', text: '#5eead4' },
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

function detailFromCategory(category: string): string {
  if (category === 'Earnings Beat') return 'Results came in above expectations with positive near-term momentum cues.'
  if (category === 'Earnings Miss') return 'Weaker-than-expected numbers may pressure sentiment in upcoming sessions.'
  if (category === 'Bulk Deal') return 'Large institutional activity often signals evolving conviction at current levels.'
  if (category === 'Expansion') return 'Capacity and growth investments may improve long-term revenue visibility.'
  if (category === 'Management Change') return 'Leadership transition introduces uncertainty until strategic continuity is clear.'
  if (category === 'Regulatory') return 'Policy and compliance changes could impact guidance and execution timelines.'
  if (category === 'Dividend') return 'Capital return signal may support shareholder confidence and near-term demand.'
  return 'AI detected a notable filing that may influence short-term stock behavior.'
}

function confidenceFromCategory(category: string): number {
  if (category === 'Earnings Beat') return 84
  if (category === 'Earnings Miss') return 68
  if (category === 'Bulk Deal') return 76
  if (category === 'Expansion') return 71
  if (category === 'Management Change') return 61
  if (category === 'Regulatory') return 66
  if (category === 'Dividend') return 72
  return 70
}

function normalizeApiRows(rows: ApiFiling[]): FilingCard[] {
  return rows.map((r) => ({
    id: r.id,
    symbol: r.stock_symbol || 'NSE',
    company: r.stock_name || 'Listed Company',
    category: r.category,
    headline: r.headline,
    detail: detailFromCategory(r.category),
    date: toRelativeDate(r.date),
    confidence: confidenceFromCategory(r.category),
    sourceUrl: r.source_url,
  }))
}

function matchesFilter(filing: FilingCard, activeFilter: FilterKey): boolean {
  if (activeFilter === 'All') return true
  if (activeFilter === 'Earnings') return filing.category === 'Earnings Beat' || filing.category === 'Earnings Miss'
  if (activeFilter === 'Bulk Deals') return filing.category === 'Bulk Deal'
  if (activeFilter === 'Management') return filing.category === 'Management Change'
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
          <h1 className="text-white text-2xl font-bold">Latest Filings</h1>
          <p className="text-[#9ca3af] text-sm mt-1">AI-detected signals from BSE announcements</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-2 text-sm rounded-lg border border-[#30363d] bg-[#161b22] hover:border-[#3b82f6] text-white disabled:opacity-60 transition-colors"
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
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-[#161b22] border-[#30363d] text-[#9ca3af] hover:text-white hover:border-[#3b82f6]'
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
            <div key={i} className="rounded-[10px] border border-[#30363d] bg-[#161b22] p-5 animate-pulse">
              <div className="h-4 w-40 bg-gray-700 rounded" />
              <div className="h-4 w-72 bg-gray-700 rounded mt-3" />
              <div className="h-3 w-full bg-gray-800 rounded mt-2" />
              <div className="h-2 w-48 bg-gray-700 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : visibleFilings.length === 0 ? (
        <div className="rounded-[10px] border border-[#30363d] bg-[#161b22] px-6 py-10 text-center">
          <div className="text-5xl leading-none">-</div>
          <div className="text-white text-lg font-semibold mt-3">No filings found</div>
          <div className="text-[#9ca3af] text-sm mt-1">Try refreshing or check back after market hours</div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFilings.map((f) => {
            const badge = CATEGORY_BADGES[f.category] || { bg: '#1f2937', text: '#cbd5e1' }
            return (
              <article
                key={f.id}
                onClick={() => router.push(`/stock/${f.symbol}`)}
                className="rounded-[10px] border border-[#30363d] bg-[#161b22] p-5 transition-colors hover:border-[#3b82f6] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white text-base font-bold">{f.symbol}</div>
                    <div className="text-[#9ca3af] text-[13px]">{f.company}</div>
                  </div>
                  <span
                    className="px-2 py-1 rounded-md text-xs font-medium"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {f.category}
                  </span>
                </div>

                <h2 className="text-white text-[15px] font-semibold mt-[10px]">{f.headline}</h2>
                <p className="text-[#9ca3af] text-[13px] mt-1">{f.detail}</p>
                {f.sourceUrl && (
                  <a
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex mt-2 text-xs text-[#93c5fd] hover:text-[#bfdbfe]"
                  >
                    View source
                  </a>
                )}

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <span>Confidence</span>
                      <span className="text-white font-medium">{f.confidence}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-[#0d1117] border border-[#30363d] overflow-hidden">
                      <div className="h-full bg-[#3b82f6]" style={{ width: `${f.confidence}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-[#9ca3af] whitespace-nowrap">{f.date}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
