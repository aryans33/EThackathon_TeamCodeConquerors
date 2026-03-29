'use client'
import { useState, useRef, useEffect } from 'react'
import { uploadPortfolio, getPortfolioHistory, getPortfolioById } from '@/lib/api'
import { getSessionId } from '@/lib/session'
import { mockPortfolio } from '@/lib/mock'
import type { PortfolioResult } from '@/lib/api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

type PageState = 'upload' | 'loading' | 'results' | 'error'

const formatINR = (n: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(n)

type PortfolioHistoryItem = {
  id: number
  created_at: string
  total_value: number
  xirr: number | null
  fund_count?: number
}

export default function PortfolioPage() {
  const [state, setState] = useState<PageState>('upload')
  const [result, setResult] = useState<PortfolioResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loadingStep, setLoadingStep] = useState(0)
  const [showAllOverlaps, setShowAllOverlaps] = useState(false)
  
  // History tab state
  const [history, setHistory] = useState<PortfolioHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // handle loading sequence
  useEffect(() => {
    if (state === 'loading') {
      const t1 = setTimeout(() => setLoadingStep(1), 2000)
      const t2 = setTimeout(() => setLoadingStep(2), 5000)
      const t3 = setTimeout(() => setLoadingStep(3), 8000)
      const t4 = setTimeout(() => setLoadingStep(4), 11000)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
    } else {
      setLoadingStep(0)
    }
  }, [state])

  // Fetch portfolio history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const sessionId = getSessionId()
        const data = await getPortfolioHistory(sessionId)
        setHistory(data || [])
      } catch {
        setHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }
    fetchHistory()
  }, [])

  const handleViewReport = async (historyItem: PortfolioHistoryItem) => {
    setState('loading')
    try {
      const data = await getPortfolioById(historyItem.id)
      setResult(data.data)
      setState('results')
    } catch {
      setErrorMsg('Could not load report. Please try again.')
      setState('error')
    }
  }

  const handleFileChange = (f: File | null) => {
    if (f && f.type === 'application/pdf') {
      setFile(f)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleAnalyse = async () => {
    if (!file) return
    setState('loading')
    try {
      const res = await uploadPortfolio(file, getSessionId())
      setResult(res)
      setState('results')
      localStorage.setItem('et_radar_portfolio', 'true')
    } catch (e: any) {
      setErrorMsg(e.response?.data?.detail || 'Could not parse PDF. Please try again.')
      setState('error')
    }
  }

  const handleDemo = () => {
    setResult(mockPortfolio)
    setState('results')
    localStorage.setItem('et_radar_portfolio', 'true')
  }

  const COLORS = ['#d4af37', '#d4af37', '#f59e0b', '#8b5cf6', '#ef4444', '#d4af37']

  const normalizeFundName = (name: string) =>
    name
      .replace(/\s+/g, ' ')
      .replace(/\s+([,./()-])/g, '$1')
      .trim()

  if (state === 'upload') {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8 md:py-10 min-h-screen transition-colors dark:bg-black">
        <h1 className="text-2xl font-bold mb-6 md:mb-8 text-center lg:text-left dark:text-[#f0fdf4] text-[#1f2937]">Portfolio Analysis</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <aside className="order-2 lg:order-1 lg:col-span-1">
            <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold dark:text-[#f0fdf4] text-[#1f2937]">Past Reports</h2>
                <span className="text-xs dark:text-[#64748b] text-gray-600">{history.length}</span>
              </div>

              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="rounded-[10px] border border-border bg-surface-1 p-5 animate-pulse">
                      <div className="h-4 w-40 bg-slate-300 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-72 bg-slate-300 dark:bg-slate-700 rounded mt-3" />
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded mt-2" />
                      <div className="h-2 w-48 bg-slate-300 dark:bg-slate-700 rounded mt-4" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm dark:text-[#64748b] text-gray-600">No past reports yet. Upload a portfolio PDF to create your first report.</p>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div key={item.id} className="dark:bg-black bg-gray-50 dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="dark:text-[#64748b] text-gray-600 text-xs font-medium mb-1">
                            {new Date(item.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-lg font-bold dark:text-white text-[#1f2937]">
                            {formatINR(item.total_value)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${
                            !item.xirr ? 'dark:text-[#9ca3af] text-gray-500' :
                            item.xirr > 12 ? 'dark:text-[#d4af37] text-[#d4af37]' : item.xirr >= 8 ? 'dark:text-amber-400 text-amber-600' : 'dark:text-red-400 text-red-600'
                          }`}>
                            {item.xirr ? `${item.xirr.toFixed(1)}%` : 'N/A'}
                          </div>
                          <div className="text-xs dark:text-[#64748b] text-gray-600 mt-1">
                            {item.fund_count ?? 'N/A'} funds
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewReport(item)}
                        className="text-sm dark:text-[#d4af37] dark:hover:text-[#e4c06a] text-[#d4af37] hover:text-[#c49f33] transition-colors font-medium"
                      >
                        View Report →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="order-1 lg:order-2 lg:col-span-2">
            <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-2xl p-6 md:p-8">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragOver ? 'dark:border-[#d4af37] border-[#d4af37] dark:bg-black/30 bg-black/5' : 'dark:border-[#2a2a2a] border-gray-300 dark:hover:border-[#444] hover:border-gray-400 dark:hover:bg-black hover:bg-gray-100'
            }`}
          >
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            {file ? (
              <div>
                <svg className="w-12 h-12 mx-auto dark:text-[#d4af37] text-[#d4af37] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="dark:text-white text-[#1f2937] font-medium">{file.name}</div>
                <div className="text-sm dark:text-[#64748b] text-gray-600 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div>
                <svg className="w-12 h-12 mx-auto dark:text-[#64748b] text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <div className="dark:text-[#e2e8f0] text-[#1f2937] font-medium text-lg">Drop your CAMS or KFintech PDF here</div>
                <div className="dark:text-[#64748b] text-gray-600 mt-2">Or click to browse</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleAnalyse}
            disabled={!file}
            className={`w-full mt-6 py-3 rounded-xl font-bold transition-colors ${
              file ? 'dark:bg-[#d4af37] dark:hover:bg-[#e4c06a] dark:text-[#07130f] bg-[#d4af37] hover:bg-[#c49f33] text-black' : 'dark:bg-black dark:border dark:border-[#2a2a2a] dark:text-[#64748b] bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            Analyse Portfolio
          </button>
          
          <div className="mt-6 text-center">
            <button onClick={handleDemo} className="dark:text-[#d4af37] dark:hover:text-[#e4c06a] text-[#d4af37] hover:text-[#c49f33] text-sm flex items-center justify-center mx-auto transition-colors">
              No PDF? Load demo data <span className="ml-1">→</span>
            </button>
          </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  if (state === 'loading') {
    return (
      <main className="max-w-md mx-auto mt-24 text-center px-6 min-h-screen transition-colors dark:bg-black">
        <div className="w-16 h-16 dark:border-[#2a2a2a] border-gray-300 border-4 border-t-[#d4af37] rounded-full animate-spin mx-auto mb-8" />
        <h2 className="text-xl font-bold dark:text-white text-[#1f2937] mb-8">Analysing your portfolio with AI...</h2>
        
        <div className="space-y-4 text-left max-w-[280px] mx-auto">
          <div className={`transition-opacity duration-500 ${loadingStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#d4af37] text-[#d4af37] mr-3 text-lg">OK</span> <span className="dark:text-[#e2e8f0] text-[#1f2937]">PDF parsed successfully</span>
          </div>
          <div className={`transition-opacity duration-500 ${loadingStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#d4af37] text-[#d4af37] mr-3 text-lg">OK</span> <span className="dark:text-[#e2e8f0] text-[#1f2937]">Calculating XIRR...</span>
          </div>
          <div className={`transition-opacity duration-500 ${loadingStep >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#d4af37] text-[#d4af37] mr-3 text-lg">OK</span> <span className="dark:text-[#e2e8f0] text-[#1f2937]">Detecting fund overlaps...</span>
          </div>
          <div className={`transition-opacity duration-500 ${loadingStep >= 4 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#d4af37] text-[#d4af37] mr-3 text-lg">OK</span> <span className="dark:text-[#e2e8f0] text-[#1f2937]">Generating AI recommendations...</span>
          </div>
        </div>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="max-w-md mx-auto mt-24 px-6 text-center min-h-screen transition-colors dark:bg-black">
        <div className="dark:bg-red-900/20 bg-red-100 dark:border-red-500/50 border-red-300 border rounded-2xl p-8">
          <svg className="w-16 h-16 dark:text-red-500 text-red-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h2 className="text-xl font-bold dark:text-white text-[#1f2937] mb-2">Analysis Failed</h2>
          <p className="dark:text-[#64748b] text-gray-600 mb-8">{errorMsg}</p>
          <button 
            onClick={() => { setState('upload'); setFile(null) }}
            className="w-full dark:bg-black dark:hover:bg-[#111] dark:border dark:border-[#2a2a2a] bg-gray-300 hover:bg-gray-400 dark:text-white text-[#1f2937] py-3 rounded-xl font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  if (state === 'results' && result) {
    const normalizedFunds = result.funds.map((f) => ({
      ...f,
      fund_name: normalizeFundName(f.fund_name)
    }))

    const sortedByAllocation = [...normalizedFunds]
      .sort((a, b) => b.allocation_pct - a.allocation_pct)

    const topFunds = sortedByAllocation
      .slice(0, 8)
      .map((f) => ({ name: f.fund_name, value: f.allocation_pct }))

    const othersAllocation = sortedByAllocation
      .slice(8)
      .reduce((sum, f) => sum + f.allocation_pct, 0)

    const pieData = othersAllocation > 0
      ? [...topFunds, { name: 'Others', value: Number(othersAllocation.toFixed(2)) }]
      : topFunds

    const shortName = (name: string, max = 56) =>
      name.length > max ? `${name.slice(0, max - 3)}...` : name

    const aiBullets = result.rebalancing_suggestion
      .split('\n•')
      .filter(Boolean)
      .map(b => b.replace(/^•\s*/, '').trim())

    const highOverlaps = result.overlap
      .filter(o => o.overlap_pct > 50)
      .sort((a, b) => b.overlap_pct - a.overlap_pct)

    const visibleOverlaps = showAllOverlaps ? highOverlaps : highOverlaps.slice(0, 3)

    return (
      <main className="max-w-7xl mx-auto p-6 space-y-8 min-h-screen transition-colors dark:bg-black">
        {/* Top Bar */}
        <div className="dark:border-[#2a2a2a] border-gray-300 flex justify-between items-center border-b pb-4">
          <h1 className="text-2xl font-bold dark:text-[#f0fdf4] text-[#1f2937]">Your Portfolio Analysis</h1>
          <button 
            onClick={() => { setState('upload'); setFile(null) }}
            className="dark:text-[#d4af37] dark:hover:text-[#e4c06a] text-[#d4af37] hover:text-[#c49f33] text-sm transition-colors"
          >
            Upload new →
          </button>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] text-gray-600 text-sm font-medium mb-2">Total Value</div>
            <div className="text-2xl font-bold dark:text-white text-[#1f2937]">{formatINR(result.total_value)}</div>
          </div>
          
          <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] text-gray-600 text-sm font-medium mb-2">XIRR</div>
            <div className={`text-2xl font-bold ${
              !result.xirr ? 'dark:text-[#9ca3af] text-gray-500' :
              result.xirr > 12 ? 'dark:text-[#d4af37] text-[#d4af37]' : result.xirr >= 8 ? 'dark:text-amber-400 text-amber-600' : 'dark:text-red-400 text-red-600'
            }`}>
              {result.xirr ? `${result.xirr.toFixed(1)}% p.a.` : "N/A"}
            </div>
          </div>

          <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] text-gray-600 text-sm font-medium mb-2">Funds</div>
            <div className="text-2xl font-bold dark:text-white text-[#1f2937]">{result.funds.length} funds</div>
          </div>

          <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] text-gray-600 text-sm font-medium mb-2">Expense Drag</div>
            <div className={`text-2xl font-bold ${
              result.expense_drag > 5000 ? 'dark:text-red-400 text-red-600' : result.expense_drag >= 2000 ? 'dark:text-amber-400 text-amber-600' : 'dark:text-[#d4af37] text-[#d4af37]'
            }`}>
              ₹{result.expense_drag.toLocaleString('en-IN')}/yr
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-8 min-w-0">
            {/* OVERLAP WARNINGS */}
            <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-4">
              {highOverlaps.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold dark:text-red-300 text-red-700">Overlap Risk Alerts</h2>
                    <span className="text-xs px-2 py-1 rounded-full dark:bg-red-900/30 dark:text-red-300 bg-red-100 text-red-700 border dark:border-red-900/50 border-red-300">
                      {highOverlaps.length} high-risk
                    </span>
                  </div>

                  <div className="space-y-2">
                    {visibleOverlaps.map((o, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-3 items-center dark:bg-red-900/10 bg-red-50 dark:border-red-900/40 border-red-200 border rounded-lg px-3 py-2">
                        <div className="text-sm dark:text-red-200 text-red-800 truncate" title={`${o.fund_a} and ${o.fund_b}`}>
                          {shortName(normalizeFundName(o.fund_a), 48)} x {shortName(normalizeFundName(o.fund_b), 48)}
                        </div>
                        <div className="text-xs font-semibold dark:text-red-300 text-red-700">{o.overlap_pct.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>

                  {highOverlaps.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOverlaps((v) => !v)}
                      className="mt-3 text-xs dark:text-[#d4af37] dark:hover:text-[#e4c06a] text-[#d4af37] hover:text-[#c49f33]"
                    >
                      {showAllOverlaps ? 'Show less' : `Show all ${highOverlaps.length} alerts`}
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center space-x-3 dark:bg-black/20 bg-black/5 dark:border-black/30 border-black/10 border rounded-xl p-4">
                  <svg className="w-5 h-5 dark:text-[#d4af37] text-[#d4af37] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="dark:text-[#d4af37] text-[#d4af37] text-sm font-medium">No major overlap risk detected across funds.</div>
                </div>
              )}
            </div>

            {/* FUND TABLE */}
            <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl overflow-hidden">
              <div className="px-4 py-3 dark:border-[#2a2a2a] border-gray-200 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold dark:text-[#e2e8f0] text-[#1f2937]">Fund Breakdown</h2>
                <span className="text-xs dark:text-[#64748b] text-gray-600">Sorted by allocation</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[820px]">
                  <thead className="text-xs dark:text-[#64748b] text-gray-600 uppercase dark:bg-black bg-gray-100 dark:border-b-[#2a2a2a] border-b-gray-300 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium w-12">#</th>
                      <th className="px-6 py-4 font-medium">Fund Name</th>
                      <th className="px-6 py-4 font-medium text-right">Allocation</th>
                      <th className="px-6 py-4 font-medium text-right">Value</th>
                      <th className="px-6 py-4 font-medium text-right">Units</th>
                      <th className="px-6 py-4 font-medium text-right">NAV</th>
                    </tr>
                  </thead>
                  <tbody className="dark:divide-[#2a2a2a] divide-gray-200 divide-y">
                    {sortedByAllocation.map((f, i) => (
                      <tr key={i} className="dark:hover:bg-[#111] hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-xs dark:text-[#64748b] text-gray-600">{i + 1}</td>
                        <td className="px-6 py-4 w-[36%]">
                          <div className="font-medium dark:text-[#e2e8f0] text-[#1f2937]" title={f.fund_name}>
                            {shortName(f.fund_name, 74)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right min-w-[180px]">
                          <div className="inline-flex items-center gap-2 min-w-[130px] justify-end">
                            <div className="w-20 h-1.5 rounded-full dark:bg-[#1a1a1a] bg-gray-200 overflow-hidden">
                              <div className="h-full bg-[#d4af37]" style={{ width: `${Math.max(0, Math.min(100, f.allocation_pct))}%` }} />
                            </div>
                            <span className="text-xs font-semibold dark:text-[#d4af37] text-[#d4af37]">{f.allocation_pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium dark:text-[#e2e8f0] text-[#1f2937]">₹{f.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-6 py-4 text-right dark:text-[#9ca3af] text-gray-600 tabular-nums">{f.units.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right dark:text-[#9ca3af] text-gray-600 tabular-nums">₹{f.current_nav.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI REBALANCING */}
            <div>
              <h2 className="text-xl font-bold dark:text-[#f0fdf4] text-[#1f2937] mb-4">AI Recommendations</h2>
              <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 dark:border-l-[#d4af37] border-l-[#d4af37] border border-l-4 rounded-r-xl p-6">
                <div className="space-y-4">
                  {aiBullets.map((bullet, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="w-1.5 h-1.5 rounded-full dark:bg-[#d4af37] bg-[#d4af37] mt-2 flex-shrink-0" />
                      <p className="text-sm dark:text-[#9ca3af] text-gray-700 leading-relaxed">{bullet}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-4 dark:border-[#2a2a2a] border-gray-300 border-t">
                  <p className="italic text-xs dark:text-[#64748b] text-gray-600">
                    AI-generated analysis based on your holdings. Not SEBI-registered investment advice.
                  </p>
                </div>
              </div>
            </div>
          </div>

           <div className="lg:col-span-2 min-w-0">
             {/* PIE CHART */}
             <div className="dark:bg-black bg-white dark:border-[#2a2a2a] border-gray-300 border rounded-xl p-6 sticky top-6 overflow-hidden">
               <h3 className="font-bold text-center dark:text-[#f0fdf4] text-[#1f2937] mb-6">Asset Allocation</h3>
               <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={70} 
                        outerRadius={110}
                        dataKey="value" 
                        nameKey="name"
                        stroke="currentColor"
                        strokeWidth={2}
                        labelLine={false}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip 
                        formatter={(v) => {
                          const n = typeof v === 'number' ? v : Number(v ?? 0)
                          return `${n.toFixed(1)}%`
                        }} 
                        contentStyle={{ backgroundColor: '#000000', borderColor: '#2a2a2a', borderRadius: '8px' }}
                        itemStyle={{ color: '#f8fafc' }}
                      />
                    </PieChart>
                 </ResponsiveContainer>
               </div>

               <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                 {pieData.map((entry, i) => (
                   <div key={`${entry.name}-${i}`} className="flex items-center justify-between gap-3 text-xs">
                     <div className="flex items-center gap-2 min-w-0 flex-1">
                       <span
                         className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                         style={{ backgroundColor: COLORS[i % COLORS.length] }}
                       />
                       <span className="block truncate dark:text-[#9ca3af] text-gray-700">{shortName(entry.name)}</span>
                     </div>
                     <span className="dark:text-[#e2e8f0] text-[#1f2937] font-medium flex-shrink-0">
                       {entry.value.toFixed(1)}%
                     </span>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      </main>
    )
  }

  return null
}


