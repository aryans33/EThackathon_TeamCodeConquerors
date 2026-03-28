'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { getSignals, getAllPatterns, getStocks, seedDemo, getStatus, getStockPrices } from '@/lib/api'
import type { Signal, Stock, Pattern } from '@/lib/api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import OnboardingTooltip, { ONBOARDING_STEPS } from '@/components/OnboardingTooltip'

function timeAgo(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatPattern(p: string): string {
  const map: Record<string, string> = {
    '52_week_breakout': '52W Breakout',
    'golden_cross': 'Golden Cross',
    'death_cross': 'Death Cross',
    'rsi_bounce': 'RSI Bounce',
    'support_bounce': 'Support Bounce',
  }
  return map[p] || p
}

function formatSignalCategory(signalType: string): string {
  const map: Record<string, string> = {
    earnings_beat: 'Earnings Beat',
    earnings_miss: 'Earnings Miss',
    bulk_deal: 'Bulk Deal',
    expansion: 'Expansion',
    management_change: 'Management Change',
  }
  return map[signalType] || signalType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

const CATEGORY_BADGES: Record<string, { bg: string; text: string }> = {
  'Earnings Beat': { bg: '#166534', text: '#86efac' },
  'Earnings Miss': { bg: '#7f1d1d', text: '#fca5a5' },
  'Bulk Deal': { bg: '#1e3a5f', text: '#93c5fd' },
  Expansion: { bg: '#3b0764', text: '#d8b4fe' },
  'Management Change': { bg: '#7c2d12', text: '#fdba74' },
}

export default function Dashboard() {
  const router = useRouter()
  const [stocks, setStocks] = useState<Stock[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [patterns, setPatterns] = useState<{symbol: string, name: string, patterns: Pattern[]}[]>([])
  const [patternsLoading, setPatternsLoading] = useState(true)
  const [prices, setPrices] = useState<any[]>([])
  const [pricesLoading, setPricesLoading] = useState(true)
  const [statusInfo, setStatusInfo] = useState<{ tracked: number, generated: number, lastUpdate: string, isOk: boolean }>({ tracked: 0, generated: 0, lastUpdate: '', isOk: true })
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [isLoadingSignals, setIsLoadingSignals] = useState(true)
  const [isRefreshingSignals, setIsRefreshingSignals] = useState(false)
  const [backendError, setBackendError] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const dbStatus = await getStatus() // We don't have exact status response shape given, but assume it confirms OK
      setStatusInfo(prev => ({ ...prev, isOk: true }))
    } catch {
      setStatusInfo(prev => ({ ...prev, isOk: false }))
    }
  }, [])

  const fetchSignalsData = useCallback(async () => {
    setIsRefreshingSignals(true)
    try {
      const data = await getSignals(20, filterAction === 'all' ? undefined : filterAction)
      if (data.data.length === 0 && filterAction === 'all') {
        const seedRes = await seedDemo()
        if (seedRes) {
           const reFetch = await getSignals(20)
           setSignals(reFetch.data)
        }
      } else {
        setSignals(data.data)
      }
      setBackendError(false)
    } catch (e) {
      setBackendError(true)
      setSignals([])
    } finally {
      setIsLoadingSignals(false)
      setIsRefreshingSignals(false)
    }
  }, [filterAction])

  const fetchInitialData = useCallback(async () => {
    try {
      const [stocksData, patternsData] = await Promise.all([
        getStocks(),
        getAllPatterns()
      ])
      setStocks(stocksData)
      setPatterns(patternsData)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchInitialData()
    fetchStatus()
  }, [fetchInitialData, fetchStatus])

  useEffect(() => {
    fetchSignalsData()
    const interval = setInterval(fetchSignalsData, 60000)
    return () => clearInterval(interval)
  }, [fetchSignalsData])

  useEffect(() => {
    getStockPrices()
      .then(data => { setPrices(data); setPricesLoading(false) })
      .catch(() => setPricesLoading(false))
  }, [])

  useEffect(() => {
    getAllPatterns()
      .then(data => {
        setPatterns(data || [])
        setPatternsLoading(false)
      })
      .catch(() => setPatternsLoading(false))
  }, [])

  const searchableStocks = prices.length > 0 ? prices : stocks
  const filteredSearch = searchableStocks.filter((s: any) =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5)

  const filteredSignals = useMemo(() => {
    if (!searchQuery.trim()) return signals
    const q = searchQuery.trim().toLowerCase()
    return signals.filter((s) => s.stock.symbol.toLowerCase().includes(q))
  }, [signals, searchQuery])

  const latestSignalText = useMemo(() => {
    if (!signals.length) return 'Last updated: just now · Auto-refreshes every 60s'
    const mostRecent = signals[0]?.created_at
    if (!mostRecent) return 'Last updated: just now · Auto-refreshes every 60s'
    const diffMin = Math.floor((Date.now() - new Date(mostRecent).getTime()) / 60000)
    const when = diffMin < 1 ? 'just now' : `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
    return `Last updated: ${when} · Auto-refreshes every 60s`
  }, [signals])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const symbol = searchQuery.trim().toUpperCase()
      if (symbol) router.push(`/stock/${symbol}`)
      setShowSearchDropdown(false)
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      setShowSearchDropdown(false)
    }
  }

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6 dark:bg-[#0a0f1c] light:bg-gray-50 transition-colors min-h-screen">
      {/* Top Search Bar */}
      <div ref={searchRef} className="relative">
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowSearchDropdown(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search for a stock..."
          className="w-full dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border rounded-xl px-4 py-3 dark:text-[#e2e8f0] light:text-[#1f2937] dark:placeholder-[#64748b] light:placeholder-gray-500 focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] transition-colors"
        />
        {showSearchDropdown && searchQuery.trim() && (
          <div className="absolute top-14 left-0 right-0 dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border rounded-xl overflow-hidden z-50 p-2 shadow-2xl">
            {filteredSearch.length === 0 ? (
              <div className="p-4 dark:text-[#64748b] light:text-gray-500">No stocks found</div>
            ) : (
             filteredSearch.map(s => (
              <button
                key={s.symbol} 
                onClick={() => {
                  router.push(`/stock/${s.symbol}`)
                  setShowSearchDropdown(false)
                }}
                className="w-full text-left flex items-center justify-between p-3 dark:hover:bg-[#22314a] light:hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-bold dark:text-[#7dd3fc] light:text-sky-600">{s.symbol}</span>
                  <span className="ml-3 dark:text-[#9ca3af] light:text-gray-700">{s.name}</span>
                </div>
                {s.sector && <span className="text-xs dark:bg-[#22314a] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-1 rounded-full">{s.sector}</span>}
              </button>
             ))
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center space-x-4 text-sm dark:text-[#64748b] light:text-gray-600 dark:bg-[#101827]/50 light:bg-gray-100 p-3 rounded-lg dark:border-[#22314a] light:border-gray-300 border transition-colors">
        <div className="flex items-center space-x-2">
          {statusInfo.isOk ? (
            <span className="w-2 h-2 rounded-full bg-[#7dd3fc]" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
          <span>{statusInfo.isOk ? 'System Online' : 'Demo mode'}</span>
        </div>
        <div>•</div>
        <span>{stocks.length} stocks tracked</span>
        {signals.length > 0 && (
          <>
            <div>•</div>
            <span>Last signal update: {timeAgo(signals[0]?.created_at)}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        {/* LEFT COLUMN: Signal Feed */}
        <ErrorBoundary section="Signals">
          <div className="space-y-4">
            <div id="live-signals-section" className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold dark:text-[#f0fdf4] light:text-[#1f2937] flex items-center gap-2">
                  Live Signals <span className="w-2 h-2 rounded-full bg-[#7dd3fc] animate-pulse mt-1" />
                  <span className="text-xs font-normal dark:bg-[#22314a] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-0.5 rounded-full ml-2">
                    {filteredSignals.length}
                  </span>
                </h2>
                <div className="mt-1 text-xs dark:text-[#64748b] light:text-gray-600 flex items-center gap-2">
                  <span>{latestSignalText}</span>
                  {isRefreshingSignals && <span className="inline-block animate-spin">↻</span>}
                </div>
              </div>
              <div className="flex space-x-2 dark:bg-[#101827] light:bg-gray-100 p-1 rounded-lg dark:border-[#22314a] light:border-gray-300 border">
                {['all', 'buy_watch', 'sell_watch'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterAction(tab)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filterAction === tab ? 'dark:bg-[#22314a] light:bg-white dark:text-white light:text-[#1f2937]' : 'dark:text-[#64748b] light:text-gray-600 dark:hover:text-[#e2e8f0] light:hover:text-[#1f2937]'}`}
                  >
                    {tab === 'all' ? 'All' : tab === 'buy_watch' ? 'Buy Watch' : 'Sell Watch'}
                  </button>
                ))}
              </div>
            </div>
            
            {backendError && (
              <div className="dark:bg-amber-900/20 light:bg-amber-100 dark:text-amber-500 light:text-amber-700 dark:border-amber-800/50 light:border-amber-300 border rounded-xl p-4 text-center">
                Could not reach backend — check server
              </div>
            )}

            <div className="space-y-4">
              {isLoadingSignals ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border p-4 rounded-xl animate-pulse h-32" />
                ))
              ) : filteredSignals.length === 0 ? (
                <div className="dark:text-[#64748b] light:text-gray-600 text-center py-8">No signals matching filter.</div>
              ) : (
                filteredSignals.map((signal, idx) => {
                  const category = formatSignalCategory(signal.signal_type)
                  const badge = CATEGORY_BADGES[category]
                  return (
                  <div
                    key={signal.id}
                    onClick={() => router.push(`/stock/${signal.stock.symbol}`)}
                    className="block dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border p-5 rounded-xl transition-all hover:-translate-y-0.5 hover:border-[#3b82f6] duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold dark:text-white light:text-[#1f2937] text-lg">{signal.stock.symbol}</span>
                        <span className="text-sm dark:text-[#64748b] light:text-gray-600">{signal.stock.name}</span>
                      </div>
                      <div>
                        <span
                          className="inline-block px-2 py-1 text-xs rounded border"
                          style={badge ? { background: badge.bg, color: badge.text, borderColor: 'transparent' } : {}}
                        >
                          {category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-xs dark:bg-[#22314a] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-0.5 rounded-full capitalize">
                        {signal.signal_type.replace(/_/g, ' ')}
                      </span>
                      <p className="text-sm dark:text-[#e2e8f0] light:text-[#1f2937] mt-2 font-medium">{signal.one_line_summary}</p>
                      {signal.reason && <p className="text-xs dark:text-[#64748b] light:text-gray-600 mt-1">{signal.reason}</p>}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="w-1/2 max-w-xs">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs dark:text-[#64748b] light:text-gray-600">Confidence</span>
                          <span className="text-xs font-bold dark:text-[#64748b] light:text-gray-600">{signal.confidence}%</span>
                        </div>
                        <div id={idx === 0 ? 'confidence-bar' : undefined} className="w-full dark:bg-[#22314a] light:bg-gray-300 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              signal.confidence > 70 ? 'bg-[#7dd3fc]' : signal.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`} 
                            style={{ width: `${signal.confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs dark:text-[#64748b] light:text-gray-600">{timeAgo(signal.created_at)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/stock/${signal.stock.symbol}`)
                          }}
                          className="text-xs text-[#3b82f6] hover:underline"
                        >
                          View Chart →
                        </button>
                      </div>
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        </ErrorBoundary>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          {/* Watchlist */}
          <ErrorBoundary section="Watchlist">
            <div>
              <h3 className="text-lg font-bold dark:text-[#f0fdf4] light:text-[#1f2937] mb-4">Watchlist</h3>
              <div className="dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border rounded-xl p-3 max-h-[400px] overflow-y-auto">
                {pricesLoading ? (
                  <>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="h-10 rounded-lg bg-[#1c2128] animate-pulse mb-2" />
                    ))}
                  </>
                ) : prices.length === 0 ? (
                  <p className="text-slate-500 text-sm">No stocks found</p>
                ) : (
                  <>
                    {prices.map(stock => (
                      <div
                        key={stock.symbol}
                        onClick={() => router.push('/stock/' + stock.symbol)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#1c2128] cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-semibold text-sm">{stock.symbol}</span>
                          <span className="text-slate-400 text-xs truncate max-w-[140px]">{stock.name}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                          {stock.latest_close ? (
                            <>
                              <span className="text-white font-mono text-sm">
                                ₹{Number(stock.latest_close).toLocaleString('en-IN')}
                              </span>
                              <span className={`text-xs font-medium ${
                                stock.change_pct > 0 ? 'text-green-400' :
                                stock.change_pct < 0 ? 'text-red-400' : 'text-slate-400'
                              }`}>
                                {stock.change_pct > 0 ? '+' : ''}{Number(stock.change_pct).toFixed(2)}%
                                <span className="ml-1 text-[11px] opacity-80">
                                  {Number(stock.change_pct) > 0 ? '+' : ''}₹{((Number(stock.latest_close || 0) * Number(stock.change_pct || 0)) / 100).toFixed(2)}
                                </span>
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </ErrorBoundary>

          {/* Today's Patterns */}
          <div>
            <h3 className="text-lg font-bold dark:text-[#f0fdf4] light:text-[#1f2937] mb-4">Today's Patterns</h3>
            <div className="dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border rounded-xl p-5 space-y-3">
              {patternsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-8 rounded-lg bg-[#1c2128] animate-pulse" />
                  ))}
                </div>
              ) : patterns.filter(p => p.patterns?.some((pat: any) => pat.detected_today)).length === 0 ? (
                <>
                  <p className="text-slate-500 text-xs mb-2">No breakouts today</p>
                  {signals.slice(0, 3).map(s => (
                    <div
                      key={s.id}
                      onClick={() => router.push('/stock/' + s.stock.symbol)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium mb-1 transition-colors ${
                        s.action_hint === 'buy_watch'
                          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          : s.action_hint === 'sell_watch'
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                      }`}
                    >
                      <span className="font-bold">{s.stock.symbol}</span>
                      <span>—</span>
                      <span>{s.signal_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {patterns
                    .filter(p => p.patterns?.some((pat: any) => pat.detected_today))
                    .slice(0, 5)
                    .map(stock => {
                      const active = stock.patterns.filter((p: any) => p.detected_today)
                      const isBullish = !active.some((p: any) => p.pattern_name === 'death_cross')
                      const patternLabel = `${stock.symbol} — ${active.map((p: any) => formatPattern(p.pattern_name)).join(', ')}`
                      const symbolFromLabel = patternLabel.split(' — ')[0]
                      return (
                        <div
                          key={stock.symbol}
                          onClick={() => router.push('/stock/' + symbolFromLabel)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium mb-1 transition-colors bg-[#1a2332] hover:bg-[#1f3044] ${
                            isBullish
                              ? 'text-green-400 border border-green-500/20'
                              : 'text-red-400 border border-red-500/20'
                          }`}
                        >
                          <span>{patternLabel}</span>
                        </div>
                      )
                    })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <OnboardingTooltip
        steps={ONBOARDING_STEPS}
        onComplete={() => console.log('Onboarding complete')}
      />

      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </main>
  )
}
