/* eslint-disable */
"use client"
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import SignalCard from '@/components/SignalCard'
import WatchlistRow from '@/components/WatchlistRow'
import ErrorBanner from '@/components/ErrorBanner'
import { Skeleton } from '@/components/ui/skeleton'
import api, { DEMO_MODE } from '@/lib/api'
import { mockSignals, mockStocks } from '@/lib/mock'

export default function DashboardPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  const fetchSignals = async () => {
    try {
      if (DEMO_MODE) {
        setSignals(mockSignals)
        setError('')
      } else {
        const res = await api.get('/opportunity-radar?limit=20')
        setSignals(res.data)
        setError('')
      }
    } catch (err: any) {
      console.error(err)
      setError('Could not connect to live signal feed. Falling back to cached data.')
      setSignals(mockSignals) // Silent fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSignals()
    const interval = setInterval(fetchSignals, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (searchQuery.length > 1) {
      const q = searchQuery.toLowerCase()
      setSearchResults(
        mockStocks.filter(s => 
          s.symbol.toLowerCase().includes(q) || 
          s.name.toLowerCase().includes(q)
        ).slice(0, 5)
      )
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input 
            type="text"
            placeholder="Search stocks by symbol or company name..."
            className="w-full bg-brand-card border border-brand-border rounded-xl pl-12 pr-4 py-4 text-brand-text focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-brand-card border border-brand-border rounded-xl shadow-xl overflow-hidden z-50">
            {searchResults.map(stock => (
              <button
                key={stock.symbol}
                onClick={() => router.push(`/stock/${stock.symbol}`)}
                className="w-full text-left px-4 py-3 hover:bg-slate-800/50 flex items-center justify-between border-b last:border-0 border-brand-border transition-colors"
              >
                <div>
                  <span className="text-brand-green font-bold mr-3">{stock.symbol}</span>
                  <span className="text-brand-muted">{stock.name}</span>
                </div>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{stock.sector}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Live Signals */}
        <div className="flex-[3]">
          <div className="flex flex-row items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-brand-text tracking-tight">Live Signals</h2>
            <div className="bg-brand-green/20 text-brand-green text-xs font-bold px-2 py-0.5 rounded flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-green"></span>
              </span>
              {signals.length} ACTIVE
            </div>
          </div>
          
          <div className="space-y-4">
            {loading ? (
              Array.from({length: 5}).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl bg-brand-card border border-brand-border" />
              ))
            ) : signals.length === 0 ? (
              <div className="text-brand-muted text-center py-12 border border-dashed border-brand-border rounded-xl">
                No active signals detected.
              </div>
            ) : (
              signals.map(signal => (
                <SignalCard 
                  key={signal.id} 
                  signal={signal} 
                  onClick={() => router.push(`/stock/${signal.stock.symbol}`)} 
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column - Watchlist & Pattern Alerts */}
        <div className="flex-[2] space-y-8">
          <div>
            <h2 className="text-xl font-bold text-brand-text mb-6 tracking-tight">Watchlist</h2>
            <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-sm">
               {mockStocks.slice(0, 10).map((stock, i) => (
                 <WatchlistRow 
                   key={stock.symbol} 
                   stock={stock} 
                   index={i} 
                   onClick={() => router.push(`/stock/${stock.symbol}`)}
                 />
               ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-4">Today's Pattern Alerts</h2>
            <div className="flex flex-wrap gap-2">
               <button 
                 onClick={() => router.push('/stock/RELIANCE')}
                 className="bg-brand-green/10 border border-brand-green/30 hover:bg-brand-green/20 text-brand-green text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
               >
                 RELIANCE — 52W Breakout
               </button>
               <button 
                 onClick={() => router.push('/stock/TCS')}
                 className="bg-brand-amber/10 border border-brand-amber/30 hover:bg-brand-amber/20 text-brand-amber text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
               >
                 TCS — Golden Cross
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
