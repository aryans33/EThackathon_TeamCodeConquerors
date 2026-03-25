/* eslint-disable */
"use client"
import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import api, { DEMO_MODE } from "@/lib/api"
import { mockOHLCV, mockPatterns, mockSignals, mockStocks } from "@/lib/mock"
import StockChart from "@/components/StockChart"
import PatternCard from "@/components/PatternCard"
import ErrorBanner from "@/components/ErrorBanner"
import { Skeleton } from "@/components/ui/skeleton"
import { timeAgo } from "@/lib/utils"
import { formatINR } from "@/lib/format"

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const router = useRouter()
  
  const [stockInfo, setStockInfo] = useState<any>(null)
  const [ohlcv, setOhlcv] = useState<any[]>([])
  const [patterns, setPatterns] = useState<any[]>([])
  const [signals, setSignals] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (DEMO_MODE) {
          const s = mockStocks.find(x => x.symbol === params.symbol)
          setStockInfo(s || { symbol: params.symbol, name: "Unknown", exchange: "NSE", sector: "Unknown" })
          setOhlcv([...mockOHLCV])
          setPatterns(mockPatterns)
          setSignals(mockSignals.filter(x => x.stock.symbol === params.symbol))
        } else {
          const [stocksRes, ohlcvRes, pattRes, sigRes] = await Promise.all([
            api.get('/stocks'),
            api.get(`/ohlcv?symbol=${params.symbol}&days=365`),
            api.get(`/chart-patterns?symbol=${params.symbol}`),
            api.get(`/opportunity-radar?limit=10`)
          ])
          setStockInfo(stocksRes.data.find((x: any) => x.symbol === params.symbol))
          setOhlcv(ohlcvRes.data)
          setPatterns(pattRes.data)
          setSignals(sigRes.data.filter((x: any) => x.stock.symbol === params.symbol))
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load stock data.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.symbol])

  // Calculate pricing data
  let currentPrice = 0
  let priceChange = 0
  let priceChangePct = 0
  
  if (ohlcv.length > 1) {
    const sorted = [...ohlcv].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    currentPrice = last.close
    priceChange = last.close - prev.close
    priceChangePct = (priceChange / prev.close) * 100
  }

  const isPositive = priceChange >= 0
  const colorClass = isPositive ? 'text-brand-green' : 'text-brand-red'

  const formatSignalType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full bg-brand-card border border-brand-border rounded-xl" />
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-[3] space-y-8">
            <Skeleton className="h-[400px] w-full bg-brand-card border border-brand-border rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <Skeleton className="h-32 w-full bg-brand-card border border-brand-border rounded-xl" />
               <Skeleton className="h-32 w-full bg-brand-card border border-brand-border rounded-xl" />
            </div>
          </div>
          <div className="flex-[1]">
             <Skeleton className="h-[600px] w-full bg-brand-card border border-brand-border rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => window.location.reload()} />}
      
      {/* Header section */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-brand-text transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-brand-text tracking-tight">{stockInfo?.name || params.symbol}</h1>
              <span className="text-sm bg-[#1e2d45] text-brand-text px-2 py-1 rounded font-medium">{params.symbol}</span>
              <span className="text-xs text-brand-muted font-medium">{stockInfo?.exchange || 'NSE'}</span>
            </div>
            <span className="text-xs bg-brand-card border border-brand-border text-brand-muted px-2 py-1 rounded-full">{stockInfo?.sector || 'Unknown'}</span>
          </div>

          <div className="flex flex-col md:items-end">
            <span className="text-3xl font-bold text-brand-text">{formatINR(currentPrice)}</span>
            <span className={`text-sm font-medium ${colorClass}`}>
              {isPositive ? '+' : ''}{formatINR(priceChange)} ({isPositive ? '+' : ''}{priceChangePct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left/Main Column */}
        <div className="flex-[3] space-y-8">
          {/* Chart Section */}
          <section>
            {ohlcv.length > 0 ? (
              <StockChart data={ohlcv} />
            ) : (
              <div className="h-[400px] bg-brand-card border border-dashed border-brand-border rounded-xl flex items-center justify-center text-slate-500">
                No chart data available
              </div>
            )}
          </section>

          {/* Pattern Detection Section */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-4">Detected Patterns</h2>
            {patterns.length === 0 ? (
              <div className="bg-brand-card/50 border border-brand-border border-dashed rounded-xl p-6 text-center text-brand-muted">
                No patterns detected today for {params.symbol}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patterns.map((p, i) => (
                  <PatternCard key={i} pattern={p} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar - Recent Signals */}
        <div className="flex-[1]">
          <h2 className="text-lg font-bold text-brand-text mb-4">Recent Signals</h2>
          {signals.length === 0 ? (
            <div className="text-sm text-brand-muted">No recent signals for {params.symbol}</div>
          ) : (
            <div className="space-y-4">
              {signals.map(sig => (
                <div key={sig.id} className="bg-brand-card border border-brand-border rounded-lg p-3">
                   <div className="flex justify-between items-start mb-2">
                     <span className="bg-slate-800 text-brand-muted text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                       {formatSignalType(sig.signal_type)}
                     </span>
                     <span className="text-xs text-slate-500">{timeAgo(sig.created_at)}</span>
                   </div>
                   <p className="text-sm text-brand-text">{sig.one_line_summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
