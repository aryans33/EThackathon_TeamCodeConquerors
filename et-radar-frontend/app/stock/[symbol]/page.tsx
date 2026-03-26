'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getOHLCV, getPatterns, getSignals, getStocks } from '@/lib/api'
import type { OHLCVRow, Pattern, Signal, Stock } from '@/lib/api'
import { createChart } from 'lightweight-charts'

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

export default function StockDetail() {
  const params = useParams()
  const router = useRouter()
  const symbol = params.symbol as string
  
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [stock, setStock] = useState<Stock | null>(null)
  const [ohlcv, setOhlcv] = useState<OHLCVRow[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [timeRange, setTimeRange] = useState<number>(365) // 1Y default
  
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
    getOHLCV(symbol, timeRange).then(setOhlcv).catch(console.error)
  }, [symbol, timeRange])
  
  useEffect(() => {
    if (!containerRef.current || ohlcv.length === 0) return
    
    const chart = createChart(containerRef.current, {
      width: containerRef.current.offsetWidth,
      height: 420,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: { borderColor: '#1e293b', timeVisible: true },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    candleSeries.setData(ohlcv.map(d => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    })))

    volumeSeries.setData(ohlcv.map(d => ({
      time: d.date,
      value: d.volume,
      color: d.close >= d.open ? '#22c55e30' : '#ef444430'
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
    }
  }, [ohlcv])

  const ranges = [
    { label: '1W', val: 7 },
    { label: '1M', val: 30 },
    { label: '3M', val: 90 },
    { label: '6M', val: 180 },
    { label: '1Y', val: 365 }
  ]

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
              <span className={`ml-3 text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
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
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-lg relative h-[430px]">
            {ohlcv.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-500">Loading chart data...</div>}
            <div ref={containerRef} className="w-full h-full" />
          </div>
          
          {/* TIME RANGE */}
          <div className="flex space-x-2 mt-4">
            {ranges.map(r => (
              <button
                key={r.label}
                onClick={() => setTimeRange(r.val)}
                className={`px-4 py-1.5 text-sm rounded border transition-colors ${
                  timeRange === r.val 
                    ? 'bg-green-900/40 text-green-400 border-green-800' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
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
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg text-slate-200">{formatPattern(p.pattern_name)}</h4>
                      <div className="flex items-center space-x-2 bg-slate-800 px-2 py-1 rounded-full text-xs">
                        <span className={`w-2 h-2 rounded-full ${p.detected_today ? 'bg-green-500' : 'bg-slate-500'}`} />
                        <span className={p.detected_today ? 'text-green-400' : 'text-slate-400'}>
                          {p.detected_today ? 'Detected today' : 'Not active'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                      {p.explanation}
                    </p>
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Occurrences</div>
                        <div className="font-medium text-slate-300">{p.backtest.occurrences}x in 3Y</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Success</div>
                        <div className={`font-medium ${
                          p.backtest.success_rate * 100 > 60 ? 'text-green-400' : p.backtest.success_rate * 100 >= 40 ? 'text-amber-400' : 'text-red-400'
                        }`}>{(p.backtest.success_rate * 100).toFixed(0)}%</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Return</div>
                        <div className={`font-medium ${
                          p.backtest.avg_return_pct > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>{p.backtest.avg_return_pct > 0 ? '+' : ''}{p.backtest.avg_return_pct.toFixed(2)}%</div>
                      </div>
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
