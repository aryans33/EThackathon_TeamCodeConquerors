'use client'
import { useEffect, useState, useCallback } from 'react'
import { getSignals, getAllPatterns, getStocks, seedDemo, getStatus, getStockPrices } from '@/lib/api'
import type { Signal, Stock, Pattern } from '@/lib/api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

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
  const [filterAction, setFilterAction] = useState<string>('all')
  const [isLoadingSignals, setIsLoadingSignals] = useState(true)
  const [backendError, setBackendError] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const dbStatus = await getStatus() // We don't have exact status response shape given, but assume it confirms OK
      setStatusInfo(prev => ({ ...prev, isOk: true }))
    } catch {
      setStatusInfo(prev => ({ ...prev, isOk: false }))
    }
  }, [])

  const fetchSignalsData = useCallback(async () => {
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
    const interval = setInterval(fetchSignalsData, 30000)
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

  const filteredSearch = stocks.filter(s => 
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5)

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6 dark:bg-[#0a0f1c] light:bg-gray-50 transition-colors min-h-screen">
      {/* Top Search Bar */}
      <div className="relative">
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a stock..."
          className="w-full dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border rounded-xl px-4 py-3 dark:text-[#e2e8f0] light:text-[#1f2937] dark:placeholder-[#64748b] light:placeholder-gray-500 focus:outline-none focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] transition-colors"
        />
        {searchQuery && (
          <div className="absolute top-14 left-0 right-0 dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 border rounded-xl overflow-hidden z-50 p-2 shadow-2xl">
            {filteredSearch.length === 0 ? (
              <div className="p-4 dark:text-[#64748b] light:text-gray-500">No stocks found</div>
            ) : (
             filteredSearch.map(s => (
              <Link 
                key={s.symbol} 
                href={`/stock/${s.symbol}`}
                className="flex items-center justify-between p-3 dark:hover:bg-[#22314a] light:hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-bold dark:text-[#7dd3fc] light:text-sky-600">{s.symbol}</span>
                  <span className="ml-3 dark:text-[#9ca3af] light:text-gray-700">{s.name}</span>
                </div>
                {s.sector && <span className="text-xs dark:bg-[#22314a] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-1 rounded-full">{s.sector}</span>}
              </Link>
             ))
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center space-x-4 text-sm dark:text-[#64748b] light:text-gray-600 dark:bg-[#101827]/50 light:bg-gray-100 p-3 rounded-lg dark:border-[#22314a] light:border-gray-300 border transition-colors">
        <div className="flex items-center space-x-2">
          {statusInfo.isOk ? (
            <span className="w-2 h-2 rounded-full bg-[#7dd3fc] animate-pulse" />
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN: Signal Feed */}
        <ErrorBoundary section="Signals">
          <div className="flex-[3] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-[#f0fdf4] light:text-[#1f2937] flex items-center gap-2">
                Live Signals <span className="w-2 h-2 rounded-full bg-[#7dd3fc] animate-pulse mt-1" />
                <span className="text-xs font-normal dark:bg-[#22314a] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-0.5 rounded-full ml-2">
                  {signals.length}
                </span>
              </h2>
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
              ) : signals.length === 0 ? (
                <div className="dark:text-[#64748b] light:text-gray-600 text-center py-8">No signals matching filter.</div>
              ) : (
                signals.map(signal => (
                  <Link
                    key={signal.id}
                    href={`/stock/${signal.stock.symbol}`}
                    className="block dark:bg-[#101827] light:bg-white dark:border-[#22314a] light:border-gray-300 dark:hover:border-[#2f4f75] light:hover:border-sky-400 border p-5 rounded-xl transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold dark:text-white light:text-[#1f2937] text-lg">{signal.stock.symbol}</span>
                        <span className="text-sm dark:text-[#64748b] light:text-gray-600">{signal.stock.name}</span>
                      </div>
                      <div>
                        {signal.action_hint === 'buy_watch' && <span className="inline-block px-2 py-1 text-xs rounded dark:bg-sky-900/30 light:bg-sky-100 dark:text-sky-300 light:text-sky-700 dark:border-sky-800 light:border-sky-300 border">Buy Watch</span>}
                        {signal.action_hint === 'sell_watch' && <span className="inline-block px-2 py-1 text-xs rounded dark:bg-red-900/40 light:bg-red-100 dark:text-red-400 light:text-red-700 dark:border-red-800 light:border-red-300 border">Sell Watch</span>}
                        {signal.action_hint === 'neutral' && <span className="inline-block px-2 py-1 text-xs rounded dark:bg-[#22314a] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700">Neutral</span>}
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
                        <div className="w-full dark:bg-[#22314a] light:bg-gray-300 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              signal.confidence > 70 ? 'bg-[#7dd3fc]' : signal.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`} 
                            style={{ width: `${signal.confidence}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs dark:text-[#64748b] light:text-gray-600">{timeAgo(signal.created_at)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </ErrorBoundary>

        {/* RIGHT COLUMN */}
        <div className="flex-[2] space-y-8">
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
                      return (
                        <div
                          key={stock.symbol}
                          onClick={() => router.push('/stock/' + stock.symbol)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium mb-1 transition-colors ${
                            isBullish
                              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                          }`}
                        >
                          <span className="font-bold">{stock.symbol}</span>
                          <span>—</span>
                          <span>{active.map((p: any) => formatPattern(p.pattern_name)).join(', ')}</span>
                        </div>
                      )
                    })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
