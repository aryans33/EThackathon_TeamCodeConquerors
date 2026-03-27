'use client'
import { useEffect, useState, useCallback } from 'react'
import { getSignals, getAllPatterns, getStocks, seedDemo, getStatus } from '@/lib/api'
import type { Signal, Stock, Pattern } from '@/lib/api'
import Link from 'next/link'
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
  const [stocks, setStocks] = useState<Stock[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [patterns, setPatterns] = useState<{symbol: string, name: string, patterns: Pattern[]}[]>([])
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

  const filteredSearch = stocks.filter(s => 
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5)

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6 dark:bg-[#051009] light:bg-gray-50 transition-colors min-h-screen">
      {/* Top Search Bar */}
      <div className="relative">
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a stock..."
          className="w-full dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl px-4 py-3 dark:text-[#e2e8f0] light:text-[#1f2937] dark:placeholder-[#64748b] light:placeholder-gray-500 focus:outline-none focus:border-[#9ae5ab] focus:ring-1 focus:ring-[#9ae5ab] transition-colors"
        />
        {searchQuery && (
          <div className="absolute top-14 left-0 right-0 dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl overflow-hidden z-50 p-2 shadow-2xl">
            {filteredSearch.length === 0 ? (
              <div className="p-4 dark:text-[#64748b] light:text-gray-500">No stocks found</div>
            ) : (
             filteredSearch.map(s => (
              <Link 
                key={s.symbol} 
                href={`/stock/${s.symbol}`}
                className="flex items-center justify-between p-3 dark:hover:bg-[#143a2b] light:hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-bold dark:text-[#9ae5ab] light:text-green-600">{s.symbol}</span>
                  <span className="ml-3 dark:text-[#9ca3af] light:text-gray-700">{s.name}</span>
                </div>
                {s.sector && <span className="text-xs dark:bg-[#143a2b] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-1 rounded-full">{s.sector}</span>}
              </Link>
             ))
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center space-x-4 text-sm dark:text-[#64748b] light:text-gray-600 dark:bg-[#0c1f18]/50 light:bg-gray-100 p-3 rounded-lg dark:border-[#143a2b] light:border-gray-300 border transition-colors">
        <div className="flex items-center space-x-2">
          {statusInfo.isOk ? (
            <span className="w-2 h-2 rounded-full bg-[#9ae5ab] animate-pulse" />
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
                Live Signals <span className="w-2 h-2 rounded-full bg-[#9ae5ab] animate-pulse mt-1" />
                <span className="text-xs font-normal dark:bg-[#143a2b] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-0.5 rounded-full ml-2">
                  {signals.length}
                </span>
              </h2>
              <div className="flex space-x-2 dark:bg-[#0c1f18] light:bg-gray-100 p-1 rounded-lg dark:border-[#143a2b] light:border-gray-300 border">
                {['all', 'buy_watch', 'sell_watch'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterAction(tab)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filterAction === tab ? 'dark:bg-[#143a2b] light:bg-white dark:text-white light:text-[#1f2937]' : 'dark:text-[#64748b] light:text-gray-600 dark:hover:text-[#e2e8f0] light:hover:text-[#1f2937]'}`}
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
                  <div key={i} className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border p-4 rounded-xl animate-pulse h-32" />
                ))
              ) : signals.length === 0 ? (
                <div className="dark:text-[#64748b] light:text-gray-600 text-center py-8">No signals matching filter.</div>
              ) : (
                signals.map(signal => (
                  <Link
                    key={signal.id}
                    href={`/stock/${signal.stock.symbol}`}
                    className="block dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 dark:hover:border-[#225a44] light:hover:border-green-400 border p-5 rounded-xl transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold dark:text-white light:text-[#1f2937] text-lg">{signal.stock.symbol}</span>
                        <span className="text-sm dark:text-[#64748b] light:text-gray-600">{signal.stock.name}</span>
                      </div>
                      <div>
                        {signal.action_hint === 'buy_watch' && <span className="inline-block px-2 py-1 text-xs rounded dark:bg-green-900/40 light:bg-green-100 dark:text-green-400 light:text-green-700 dark:border-green-800 light:border-green-300 border">Buy Watch</span>}
                        {signal.action_hint === 'sell_watch' && <span className="inline-block px-2 py-1 text-xs rounded dark:bg-red-900/40 light:bg-red-100 dark:text-red-400 light:text-red-700 dark:border-red-800 light:border-red-300 border">Sell Watch</span>}
                        {signal.action_hint === 'neutral' && <span className="inline-block px-2 py-1 text-xs rounded dark:bg-[#143a2b] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700">Neutral</span>}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-xs dark:bg-[#143a2b] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-0.5 rounded-full capitalize">
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
                        <div className="w-full dark:bg-[#143a2b] light:bg-gray-300 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              signal.confidence > 70 ? 'bg-[#9ae5ab]' : signal.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
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
              <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl overflow-hidden">
                {stocks.length === 0 ? (
                  <div className="p-6 text-center dark:text-[#64748b] light:text-gray-600 text-sm">Getting tracked stocks...</div>
                ) : (
                  <div className="divide-y dark:divide-[#143a2b] light:divide-gray-200 max-h-[400px] overflow-y-auto">
                    {stocks.map(stock => (
                      <Link
                        key={stock.symbol}
                        href={`/stock/${stock.symbol}`}
                        className="flex items-center justify-between p-4 dark:hover:bg-[#143a2b] light:hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <div className="font-bold dark:text-[#e2e8f0] light:text-[#1f2937]">{stock.symbol}</div>
                          <div className="text-xs dark:text-[#64748b] light:text-gray-600 truncate max-w-[120px]">{stock.name}</div>
                        </div>
                        {stock.sector && (
                          <span className="text-[10px] px-2 py-1 rounded-full dark:bg-[#143a2b] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 whitespace-nowrap">
                            {stock.sector}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ErrorBoundary>

          {/* Today's Patterns */}
          <div>
            <h3 className="text-lg font-bold dark:text-[#f0fdf4] light:text-[#1f2937] mb-4">Today's Patterns</h3>
            <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-5 space-y-3">
              {patterns.length === 0 ? (
                <div className="text-sm dark:text-[#64748b] light:text-gray-600 text-center py-4">Running pattern scan...</div>
              ) : (
                patterns.map(stockPatterns => {
                  return stockPatterns.patterns.filter(p => p.detected_today).map((pattern, idx) => {
                    const isBullish = ['52_week_breakout', 'golden_cross', 'rsi_bounce', 'support_bounce'].includes(pattern.pattern_name)
                    return (
                      <Link
                        href={`/stock/${stockPatterns.symbol}`}
                        key={`${stockPatterns.symbol}-${idx}`}
                        className={`block px-3 py-2 rounded-lg border text-sm transition-colors ${
                          isBullish 
                            ? 'dark:bg-green-900/10 dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-900/30 light:bg-green-100 light:border-green-300 light:text-green-700 light:hover:bg-green-200' 
                            : 'dark:bg-red-900/10 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30 light:bg-red-100 light:border-red-300 light:text-red-700 light:hover:bg-red-200'
                        }`}
                      >
                        <span className="font-bold dark:text-white light:text-[#1f2937] mr-2">{stockPatterns.symbol}</span> 
                        — {formatPattern(pattern.pattern_name)}
                      </Link>
                    )
                  })
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
