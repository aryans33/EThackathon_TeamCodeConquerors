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
  
  // History tab state
  const [activeTab, setActiveTab] = useState<'past' | 'upload'>('past')
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
        if ((data || []).length === 0) {
          setActiveTab('upload')
        }
      } catch {
        setActiveTab('upload')
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

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

  if (state === 'upload') {
    return (
      <main className="max-w-xl mx-auto mt-16 p-6 dark:bg-[#051009] light:bg-gray-50 min-h-screen transition-colors">
        <h1 className="text-2xl font-bold mb-8 text-center dark:text-[#f0fdf4] light:text-[#1f2937]">Portfolio Analysis</h1>
        <>
          {/* History Tabs */}
          {!historyLoading && history.length > 0 && (
            <div className="mb-6">
              <div className="flex gap-8 border-b dark:border-[#143a2b] light:border-gray-300">
                <button
                  onClick={() => setActiveTab('past')}
                  className={`pb-3 font-medium transition-colors relative ${
                    activeTab === 'past'
                      ? 'dark:text-[#f0fdf4] light:text-[#1f2937]'
                      : 'dark:text-[#64748b] light:text-gray-600 dark:hover:text-[#e2e8f0] light:hover:text-[#1f2937]'
                  }`}
                >
                  Past Reports ({history.length})
                  {activeTab === 'past' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9ae5ab]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`pb-3 font-medium transition-colors relative ${
                    activeTab === 'upload'
                      ? 'dark:text-[#f0fdf4] light:text-[#1f2937]'
                      : 'dark:text-[#64748b] light:text-gray-600 dark:hover:text-[#e2e8f0] light:hover:text-[#1f2937]'
                  }`}
                >
                  Upload New
                  {activeTab === 'upload' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9ae5ab]" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Past Reports Tab */}
          {activeTab === 'past' && history.length > 0 && (
            <div className="space-y-4 mb-8">
              {history.map((item) => (
                <div key={item.id} className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="dark:text-[#64748b] light:text-gray-600 text-xs font-medium mb-1">
                        {new Date(item.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-2xl font-bold dark:text-white light:text-[#1f2937]">
                        {formatINR(item.total_value)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        !item.xirr ? 'dark:text-[#9ca3af] light:text-gray-500' :
                        item.xirr > 12 ? 'dark:text-[#9ae5ab] light:text-green-600' : item.xirr >= 8 ? 'dark:text-amber-400 light:text-amber-600' : 'dark:text-red-400 light:text-red-600'
                      }`}>
                        {item.xirr ? `${item.xirr.toFixed(1)}% p.a.` : "N/A"}
                      </div>
                      <div className="text-xs dark:text-[#64748b] light:text-gray-600 mt-1">
                        {item.fund_count ?? 'N/A'} funds
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewReport(item)}
                    className="text-sm dark:text-[#9ae5ab] dark:hover:text-[#c6f6d5] light:text-green-600 light:hover:text-green-700 transition-colors font-medium"
                  >
                    View Report →
                  </button>
                </div>
              ))}
            </div>
          )}

        <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-2xl p-8">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragOver ? 'dark:border-[#9ae5ab] light:border-green-400 dark:bg-green-900/10 light:bg-green-100' : 'dark:border-[#143a2b] light:border-gray-300 dark:hover:border-[#225a44] light:hover:border-gray-400 dark:hover:bg-[#143a2b] light:hover:bg-gray-100'
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
                <svg className="w-12 h-12 mx-auto dark:text-[#9ae5ab] light:text-green-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="dark:text-white light:text-[#1f2937] font-medium">{file.name}</div>
                <div className="text-sm dark:text-[#64748b] light:text-gray-600 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div>
                <svg className="w-12 h-12 mx-auto dark:text-[#64748b] light:text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <div className="dark:text-[#e2e8f0] light:text-[#1f2937] font-medium text-lg">Drop your CAMS or KFintech PDF here</div>
                <div className="dark:text-[#64748b] light:text-gray-600 mt-2">Or click to browse</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleAnalyse}
            disabled={!file}
            className={`w-full mt-6 py-3 rounded-xl font-bold transition-colors ${
              file ? 'dark:bg-[#9ae5ab] dark:hover:bg-[#c6f6d5] dark:text-[#07130f] light:bg-green-600 light:hover:bg-green-700 light:text-white' : 'dark:bg-[#143a2b] dark:text-[#64748b] light:bg-gray-300 light:text-gray-600 cursor-not-allowed'
            }`}
          >
            Analyse Portfolio
          </button>
          
          <div className="mt-6 text-center">
            <button onClick={handleDemo} className="dark:text-[#9ae5ab] dark:hover:text-[#c6f6d5] light:text-green-600 light:hover:text-green-700 text-sm flex items-center justify-center mx-auto transition-colors">
              No PDF? Load demo data <span className="ml-1">→</span>
            </button>
          </div>
        </div>
          </>
      </main>
    )
  }

  if (state === 'loading') {
    return (
      <main className="max-w-md mx-auto mt-24 text-center px-6 dark:bg-[#051009] light:bg-gray-50 min-h-screen transition-colors">
        <div className="w-16 h-16 dark:border-[#143a2b] light:border-gray-300 border-4 border-t-[#9ae5ab] rounded-full animate-spin mx-auto mb-8" />
        <h2 className="text-xl font-bold dark:text-white light:text-[#1f2937] mb-8">Analysing your portfolio with AI...</h2>
        
        <div className="space-y-4 text-left max-w-[280px] mx-auto">
          <div className={`transition-opacity duration-500 ${loadingStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#9ae5ab] light:text-green-600 mr-3 text-lg">✓</span> <span className="dark:text-[#e2e8f0] light:text-[#1f2937]">PDF parsed successfully</span>
          </div>
          <div className={`transition-opacity duration-500 ${loadingStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#9ae5ab] light:text-green-600 mr-3 text-lg">✓</span> <span className="dark:text-[#e2e8f0] light:text-[#1f2937]">Calculating XIRR...</span>
          </div>
          <div className={`transition-opacity duration-500 ${loadingStep >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#9ae5ab] light:text-green-600 mr-3 text-lg">✓</span> <span className="dark:text-[#e2e8f0] light:text-[#1f2937]">Detecting fund overlaps...</span>
          </div>
          <div className={`transition-opacity duration-500 ${loadingStep >= 4 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="dark:text-[#9ae5ab] light:text-green-600 mr-3 text-lg">✓</span> <span className="dark:text-[#e2e8f0] light:text-[#1f2937]">Generating AI recommendations...</span>
          </div>
        </div>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="max-w-md mx-auto mt-24 px-6 text-center dark:bg-[#051009] light:bg-gray-50 min-h-screen transition-colors">
        <div className="dark:bg-red-900/20 light:bg-red-100 dark:border-red-500/50 light:border-red-300 border rounded-2xl p-8">
          <svg className="w-16 h-16 dark:text-red-500 light:text-red-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h2 className="text-xl font-bold dark:text-white light:text-[#1f2937] mb-2">Analysis Failed</h2>
          <p className="dark:text-[#64748b] light:text-gray-600 mb-8">{errorMsg}</p>
          <button 
            onClick={() => { setState('upload'); setFile(null) }}
            className="w-full dark:bg-[#143a2b] dark:hover:bg-[#225a44] light:bg-gray-300 light:hover:bg-gray-400 dark:text-white light:text-[#1f2937] py-3 rounded-xl font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  if (state === 'results' && result) {
    const sortedByAllocation = [...result.funds]
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

    return (
      <main className="max-w-7xl mx-auto p-6 space-y-8 dark:bg-[#051009] light:bg-gray-50 min-h-screen transition-colors">
        {/* Top Bar */}
        <div className="dark:border-[#143a2b] light:border-gray-300 flex justify-between items-center border-b pb-4">
          <h1 className="text-2xl font-bold dark:text-[#f0fdf4] light:text-[#1f2937]">Your Portfolio Analysis</h1>
          <button 
            onClick={() => { setState('upload'); setFile(null) }}
            className="dark:text-[#9ae5ab] dark:hover:text-[#c6f6d5] light:text-green-600 light:hover:text-green-700 text-sm transition-colors"
          >
            Upload new →
          </button>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] light:text-gray-600 text-sm font-medium mb-2">Total Value</div>
            <div className="text-2xl font-bold dark:text-white light:text-[#1f2937]">{formatINR(result.total_value)}</div>
          </div>
          
          <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] light:text-gray-600 text-sm font-medium mb-2">XIRR</div>
            <div className={`text-2xl font-bold ${
              !result.xirr ? 'dark:text-[#9ca3af] light:text-gray-500' :
              result.xirr > 12 ? 'dark:text-[#9ae5ab] light:text-green-600' : result.xirr >= 8 ? 'dark:text-amber-400 light:text-amber-600' : 'dark:text-red-400 light:text-red-600'
            }`}>
              {result.xirr ? `${result.xirr.toFixed(1)}% p.a.` : "N/A"}
            </div>
          </div>

          <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] light:text-gray-600 text-sm font-medium mb-2">Funds</div>
            <div className="text-2xl font-bold dark:text-white light:text-[#1f2937]">{result.funds.length} funds</div>
          </div>

          <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-5">
            <div className="dark:text-[#64748b] light:text-gray-600 text-sm font-medium mb-2">Expense Drag</div>
            <div className={`text-2xl font-bold ${
              result.expense_drag > 5000 ? 'dark:text-red-400 light:text-red-600' : result.expense_drag >= 2000 ? 'dark:text-amber-400 light:text-amber-600' : 'dark:text-[#9ae5ab] light:text-green-600'
            }`}>
              ₹{result.expense_drag.toLocaleString('en-IN')}/yr
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-8 min-w-0">
            {/* OVERLAP WARNINGS */}
            <div>
              {result.overlap.filter(o => o.overlap_pct > 50).length > 0 ? (
                <div className="space-y-3">
                  {result.overlap.filter(o => o.overlap_pct > 50).map((o, i) => (
                    <div key={i} className="flex items-start space-x-3 dark:bg-amber-900/20 light:bg-amber-100 dark:border-amber-900/50 light:border-amber-300 border rounded-xl p-4">
                      <svg className="w-5 h-5 dark:text-amber-500 light:text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <div>
                        <div className="dark:text-amber-500 light:text-amber-700 font-medium">High Overlap Detected</div>
                        <div className="dark:text-amber-400/80 light:text-amber-600 text-sm mt-1">{o.fund_a} and {o.fund_b} share {o.overlap_pct.toFixed(1)}% holdings</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center space-x-3 dark:bg-green-900/20 light:bg-green-100 dark:border-green-900/50 light:border-green-300 border rounded-xl p-4">
                   <svg className="w-5 h-5 dark:text-[#9ae5ab] light:text-green-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   <div className="dark:text-[#9ae5ab] light:text-green-700 text-sm font-medium">Good diversification — no significant overlaps</div>
                </div>
              )}
            </div>

            {/* FUND TABLE */}
            <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-left table-fixed min-w-[700px]">
                <thead className="text-xs dark:text-[#64748b] light:text-gray-600 uppercase dark:bg-[#0c1f18] light:bg-gray-100 dark:border-b-[#143a2b] light:border-b-gray-300 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Fund Name</th>
                    <th className="px-6 py-4 font-medium text-right">Value</th>
                    <th className="px-6 py-4 font-medium text-right">Allocation</th>
                    <th className="px-6 py-4 font-medium text-right">Units</th>
                    <th className="px-6 py-4 font-medium text-right">NAV</th>
                  </tr>
                </thead>
                <tbody className="dark:divide-[#143a2b] light:divide-gray-200 divide-y">
                  {result.funds.map((f, i) => (
                    <tr key={i} className="dark:hover:bg-[#143a2b] light:hover:bg-gray-100 transition-colors">
                      <td className="px-6 py-4 font-medium dark:text-[#e2e8f0] light:text-[#1f2937] break-words w-[42%]">{f.fund_name}</td>
                      <td className="px-6 py-4 text-right dark:text-[#9ca3af] light:text-gray-700">₹{f.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="dark:bg-[#143a2b] light:bg-gray-200 dark:text-[#64748b] light:text-gray-700 px-2 py-1 rounded-md">{f.allocation_pct.toFixed(1)}%</span>
                      </td>
                      <td className="px-6 py-4 text-right dark:text-[#64748b] light:text-gray-600">{f.units.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right dark:text-[#64748b] light:text-gray-600">₹{f.current_nav.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AI REBALANCING */}
            <div>
              <h2 className="text-xl font-bold dark:text-[#f0fdf4] light:text-[#1f2937] mb-4">AI Recommendations</h2>
              <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 dark:border-l-[#9ae5ab] light:border-l-green-600 border border-l-4 rounded-r-xl p-6">
                <div className="space-y-4">
                  {aiBullets.map((bullet, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="w-1.5 h-1.5 rounded-full dark:bg-[#9ae5ab] light:bg-green-600 mt-2 flex-shrink-0" />
                      <p className="text-sm dark:text-[#9ca3af] light:text-gray-700 leading-relaxed">{bullet}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-4 dark:border-[#143a2b] light:border-gray-300 border-t">
                  <p className="italic text-xs dark:text-[#64748b] light:text-gray-600">
                    AI-generated analysis based on your holdings. Not SEBI-registered investment advice.
                  </p>
                </div>
              </div>
            </div>
          </div>

           <div className="lg:col-span-2 min-w-0">
             {/* PIE CHART */}
             <div className="dark:bg-[#0c1f18] light:bg-white dark:border-[#143a2b] light:border-gray-300 border rounded-xl p-6 sticky top-6 overflow-hidden">
               <h3 className="font-bold text-center dark:text-[#f0fdf4] light:text-[#1f2937] mb-6">Asset Allocation</h3>
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
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
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
                       <span className="block truncate dark:text-[#9ca3af] light:text-gray-700">{shortName(entry.name)}</span>
                     </div>
                     <span className="dark:text-[#e2e8f0] light:text-[#1f2937] font-medium flex-shrink-0">
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

