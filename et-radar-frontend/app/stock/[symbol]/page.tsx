'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getOHLCV, getPatterns, getSignals, getStocks } from '@/lib/api'
import type { OHLCVRow, Pattern, Signal, Stock } from '@/lib/api'

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
    'bullish_trapezoid': 'Bullish Trapezoid',
  }
  return map[p] || p
}

const PATTERN_EXPLANATIONS: Record<string, string> = {
  '52W Breakout': 'Price broke above its 52-week high. Historically signals strong upward momentum as resistance becomes support.',
  'Golden Cross': 'The 50-day moving average crossed above the 200-day average. A classic bullish signal used by institutional traders.',
  'Death Cross': 'The 50-day moving average crossed below the 200-day average. Indicates potential downtrend - institutions often reduce exposure.',
  'RSI Bounce': 'RSI dropped below 30 (oversold) then recovered. Suggests selling pressure is exhausted and a reversal may be near.',
  'Support Bounce': 'Price touched a key historical support level and bounced. Strong support levels attract buyers and limit downside.',
  'Bullish Trapezoid': 'Price is forming higher lows with a flat resistance ceiling - a compression pattern that often resolves upward.',
}

const ACTIONABLE_ADVICE: Record<string, string> = {
  '52W Breakout': 'Consider watching for a retest of the breakout level before entering. Set stop-loss below the 52-week high level.',
  'Golden Cross': 'This is a medium-to-long term bullish signal. Best combined with strong fundamentals before taking a position.',
  'Death Cross': 'Risk management is key. If you hold this stock, consider tightening your stop-loss levels.',
  'RSI Bounce': 'Short-term traders may find an entry here. Confirm with volume - a bounce on high volume is more reliable.',
  'Support Bounce': 'Support levels are more reliable when tested multiple times. Check if volume increased on the bounce.',
  'Bullish Trapezoid': 'Wait for a confirmed breakout above the resistance ceiling with volume before entering.',
}

export default function StockDetail() {
  const params = useParams()
  const router = useRouter()
  const symbol = params.symbol as string
  
  const chartRef = useRef<any>(null)
  const candlesRef = useRef<any>(null)
  const volumeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [stock, setStock] = useState<Stock | null>(null)
  const [ohlcv, setOhlcv] = useState<any[]>([])
  const [ohlcvLoading, setOhlcvLoading] = useState(true)
  const [ohlcvError, setOhlcvError] = useState(false)
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [timeRange, setTimeRange] = useState('1Y')
  
  useEffect(() => {
    getStocks().then(stocks => {
      const s = stocks.find(st => st.symbol === symbol)
      if (s) setStock(s)
    }).catch(console.error)
    
    getPatterns(symbol).then(setPatterns).catch(console.error)
    
    getSignals(50).then(res => {
      setSignals(res.data.filter(sig => sig.stock.symbol === symbol).slice(0, 20))
    }).catch(console.error)
  }, [symbol])
  
  useEffect(() => {
    if (!symbol) return
    setOhlcvLoading(true)
    setOhlcvError(false)
    getOHLCV(symbol as string, 400)
      .then(data => {
        setOhlcv(data || [])
        setOhlcvLoading(false)
      })
      .catch(() => {
        setOhlcvError(true)
        setOhlcvLoading(false)
      })
  }, [symbol])
  
  useEffect(() => {
    if (ohlcvLoading || !containerRef.current) return
    if (ohlcv.length === 0) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const { createChart } = require('lightweight-charts')

    const chart = createChart(containerRef.current, {
      width: containerRef.current.offsetWidth,
      height: 400,
      layout: {
        background: { color: '#161b22' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      rightPriceScale: { borderColor: '#30363d' },
      timeScale: { borderColor: '#30363d', timeVisible: true },
      crosshair: { mode: 1 },
    })
    chartRef.current = chart

    const candles = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#f85149',
      borderUpColor: '#16a34a',
      borderDownColor: '#f85149',
      wickUpColor: '#16a34a',
      wickDownColor: '#f85149',
    })
    candlesRef.current = candles

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volumeRef.current = volume

    const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 400 }
    const sliced = ohlcv.slice(-(days[timeRange as keyof typeof days] || 400))

    candles.setData(sliced.map((d: any) => ({
      time: d.date,
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
    })))

    volume.setData(sliced.map((d: any) => ({
      time: d.date,
      value: Number(d.volume),
      color: Number(d.close) >= Number(d.open) ? '#16a34a30' : '#f8514930',
    })))

    chart.timeScale().fitContent()
    
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.offsetWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [ohlcv, ohlcvLoading, timeRange])

  const handleTimeRange = (range: string) => {
    setTimeRange(range)
    if (!candlesRef.current || !volumeRef.current) return
    const days: Record<string, number> = {
      '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 400
    }
    const sliced = ohlcv.slice(-days[range])
    candlesRef.current.setData(sliced.map((d: any) => ({
      time: d.date,
      open: Number(d.open), high: Number(d.high),
      low: Number(d.low), close: Number(d.close),
    })))
    volumeRef.current.setData(sliced.map((d: any) => ({
      time: d.date,
      value: Number(d.volume),
      color: Number(d.close) >= Number(d.open) ? '#16a34a30' : '#f8514930',
    })))
    candlesRef.current.priceScale().applyOptions({ autoScale: true })
  }

  const lastPrice = ohlcv.length > 0 ? ohlcv[ohlcv.length - 1].close : 0
  const prevPrice = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2].close : lastPrice
  const diff = lastPrice - prevPrice
  const pct = prevPrice ? (diff / prevPrice) * 100 : 0
  const isPositive = diff >= 0

  return (
    <main className="max-w-7xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-3">
            <span>{stock?.name || symbol}</span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md">{symbol}</span>
          </h1>
          <div className="text-xl font-medium mt-1">
            ₹{lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            {(diff !== 0) && (
              <span className={`ml-3 text-sm font-medium ${isPositive ? 'text-[#d4af37]' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}₹{diff.toFixed(2)} ({isPositive ? '+' : ''}{pct.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN: Chart & Patterns */}
        <div className="flex-[3]">
          {/* CHART CONTAINER */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-lg relative">
            {ohlcvLoading ? (
              <div className="h-[400px] rounded-xl bg-[#161b22] animate-pulse" />
            ) : ohlcvError || ohlcv.length === 0 ? (
              <div className="h-[400px] rounded-xl bg-[#161b22] flex items-center justify-center border border-[#30363d]">
                <div className="text-center">
                  <p className="text-slate-400 text-sm">No price data available</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Run seed_ohlcv.py to populate stock history
                  </p>
                </div>
              </div>
            ) : (
              <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />
            )}
          </div>
          
          {/* TIME RANGE */}
          <div className="flex space-x-2 mt-4">
            {['1W', '1M', '3M', '6M', '1Y'].map(r => (
              <button
                key={r}
                onClick={() => handleTimeRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  timeRange === r
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[#161b22] text-slate-400 border border-[#30363d] hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* PATTERNS */}
          <div className="mt-12">
            <h3 className="text-xl font-bold mb-6">Detected Patterns</h3>
            {patterns.length === 0 ? (
              <div className="text-slate-500">No patterns detected recently.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patterns.map((p, i) => (
                  <div
                    key={i}
                    onClick={() =>
                      router.push(
                        `/chat?q=${encodeURIComponent(`Explain the ${formatPattern(p.pattern_name)} pattern on ${symbol} and what I should do`)}`
                      )
                    }
                    className={`bg-[#161b22] border border-[#30363d] rounded-xl p-5 border-l-4 cursor-pointer transition-all hover:border-[#d4af37] ${
                      p.detected_today
                        ? 'border-l-[#22c55e] shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_0_24px_rgba(34,197,94,0.15)]'
                        : p.pattern_name === 'death_cross'
                          ? 'border-l-red-500'
                          : 'border-l-green-500/60'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="text-white font-semibold text-base">{formatPattern(p.pattern_name)}</h4>
                      {p.detected_today ? (
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: '#166534', color: '#86efac' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: '#1f2937', color: '#6b7280' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          Not Active
                        </span>
                      )}
                    </div>

                    <p className="text-[#9ca3af] text-[13px] mt-2 leading-relaxed">
                      {PATTERN_EXPLANATIONS[formatPattern(p.pattern_name)] || 'Pattern detected from recent price action and technical setup.'}
                    </p>

                    {p.backtest.occurrences < 3 || p.backtest.success_rate === 0 ? (
                      <p className="text-[#9ca3af] text-xs mt-4 italic">
                        Fewer than 3 historical occurrences - not enough data for reliable backtest
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Occurrences</p>
                          <p className="font-semibold text-sm text-slate-300">{p.backtest.occurrences}x in 3Y</p>
                        </div>
                        <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Success Rate</p>
                          <p className={`font-semibold text-sm ${
                            p.backtest.success_rate > 0.6 ? 'text-green-400' : p.backtest.success_rate > 0.4 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {(p.backtest.success_rate * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Avg Return</p>
                          <p className={`font-semibold text-sm ${
                            p.backtest.avg_return_pct > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {p.backtest.avg_return_pct > 0 ? '+' : ''}{p.backtest.avg_return_pct.toFixed(2)}% in 30d
                          </p>
                        </div>
                      </div>
                    )}

                    {p.detected_today && (
                      <div
                        className="mt-4 rounded-md px-3.5 py-2.5"
                        style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}
                      >
                        <p className="text-[#d4af37] text-xs font-bold">What to watch:</p>
                        <p className="text-[#9ca3af] text-[13px] mt-1 leading-relaxed">
                          {ACTIONABLE_ADVICE[formatPattern(p.pattern_name)] || 'Track volume and confirmation before taking any action.'}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <span className="text-xs text-[#d4af37]/80 hover:text-[#d4af37]">Ask AI →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT SIGNALS */}
        <div className="flex-[1]">
          <h3 className="text-lg font-bold mb-4">Recent Signals</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            {signals.length === 0 ? (
               <div className="text-sm text-slate-500 text-center py-4">No recent signals.</div>
            ) : (
              <div className="space-y-4">
                {signals.map(sig => (
                  <div key={sig.id} className="border-b border-slate-800/60 pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full capitalize">
                         {sig.signal_type.replace(/_/g, ' ')}
                       </span>
                       <span className="text-xs text-slate-600">{timeAgo(sig.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-300 font-medium">
                      {sig.one_line_summary.length > 60 ? sig.one_line_summary.substring(0, 60) + '...' : sig.one_line_summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
