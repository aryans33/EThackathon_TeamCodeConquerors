/* eslint-disable */
"use client"
import React, { useState, useEffect } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import DropZone from "@/components/DropZone"
import AllocationChart from "@/components/AllocationChart"
import ErrorBanner from "@/components/ErrorBanner"
import { Skeleton } from "@/components/ui/skeleton"
import { mockPortfolio } from "@/lib/mock"
import { formatINR } from "@/lib/format"
import api, { DEMO_MODE } from "@/lib/api"
import { getSessionId } from "@/lib/session"

type ViewState = 'upload' | 'loading' | 'results'

export default function PortfolioPage() {
  const [viewState, setViewState] = useState<ViewState>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [portfolioData, setPortfolioData] = useState<any>(null)
  const [progressSteps, setProgressSteps] = useState<number>(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (viewState === 'loading') {
      const timers = [
        setTimeout(() => setProgressSteps(1), 3000),
        setTimeout(() => setProgressSteps(2), 6000),
        setTimeout(() => setProgressSteps(3), 9000),
        setTimeout(() => setProgressSteps(4), 12000)
      ]
      
      if (DEMO_MODE) {
        const fallback = setTimeout(() => {
           setPortfolioData(mockPortfolio)
           setViewState('results')
        }, 15000)
        return () => { timers.forEach(clearTimeout); clearTimeout(fallback) }
      }
      return () => timers.forEach(clearTimeout)
    }
  }, [viewState])

  const loadDemoPortfolio = () => {
    setPortfolioData(mockPortfolio)
    setViewState('results')
  }

  const handleAnalyze = async () => {
    if (!file) return alert("Please select a file first")
    setViewState('loading')
    setError('')
    
    if (!DEMO_MODE) {
       try {
         const formData = new FormData()
         formData.append('file', file)
         formData.append('session_id', getSessionId())
         
         const res = await api.post('/portfolio/upload', formData, {
           headers: { 'Content-Type': 'multipart/form-data' }
         })
         
         setPortfolioData(res.data)
         setProgressSteps(4)
         setTimeout(() => setViewState('results'), 1000)
       } catch (err: any) {
         setViewState('upload')
         setError(err.response?.data?.detail || "Could not parse PDF - ensure it is a CAMS or KFintech statement")
       }
    }
  }

  if (viewState === 'upload') {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-brand-card border border-brand-border rounded-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-text mb-2">Portfolio X-Ray</h1>
          <p className="text-brand-muted text-sm">Upload your CAMS or KFintech consolidated statement to get instant analysis</p>
        </div>
        
        {error && <div className="mb-6"><ErrorBanner message={error} /></div>}
        
        <DropZone onFileSelect={setFile} />
        
        <button 
          onClick={handleAnalyze}
          className="w-full mt-6 bg-brand-green hover:bg-[#00a866] text-[#0a0e1a] font-bold py-3 rounded-xl transition-colors"
        >
          Analyse Portfolio
        </button>
        
        <div className="mt-4 text-center">
          <button 
            onClick={loadDemoPortfolio}
            className="text-sm font-medium text-brand-green hover:underline"
          >
            Load Demo Portfolio &rarr;
          </button>
        </div>
      </div>
    )
  }

  if (viewState === 'loading') {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-brand-card border border-brand-border rounded-xl p-8 text-center">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-brand-green border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-brand-text mb-2">Analysing your portfolio with AI...</h2>
        <p className="text-xs text-slate-500 mb-8">This processing takes 10 to 15 seconds</p>
        
        <div className="space-y-4 text-left max-w-sm mx-auto">
          {[
            "PDF parsed successfully",
            "Calculating XIRR...",
            "Detecting fund overlaps...",
            "Generating AI recommendations..."
          ].map((text, i) => (
             <div key={i} className={`flex items-center gap-3 transition-opacity duration-500 ${progressSteps > i ? 'opacity-100' : 'opacity-0'}`}>
               <CheckCircle2 className={`w-5 h-5 ${progressSteps > i + 1 ? 'text-brand-green' : 'text-slate-500'}`} />
               <span className={progressSteps > i + 1 ? 'text-brand-text' : 'text-brand-muted'}>{text}</span>
             </div>
          ))}
        </div>
      </div>
    )
  }

  if (!portfolioData) {
    return (
       <div className="space-y-8">
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {Array.from({length: 4}).map((_, i) => (
             <Skeleton key={i} className="h-24 w-full bg-brand-card border border-brand-border rounded-xl" />
           ))}
         </div>
       </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-brand-border pb-4">
        <h1 className="text-2xl font-bold text-brand-text tracking-tight">Your Portfolio X-Ray</h1>
        <button 
          onClick={() => { setViewState('upload'); setFile(null); setProgressSteps(0) }}
          className="text-sm text-brand-green hover:underline font-medium"
        >
          Upload new statement
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Value</div>
          <div className="text-xl md:text-2xl font-bold text-brand-text mt-1">{formatINR(portfolioData.total_value)}</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">XIRR</div>
          <div className={`text-xl md:text-2xl font-bold mt-1 ${portfolioData.xirr > 12 ? 'text-brand-green' : portfolioData.xirr >= 8 ? 'text-brand-amber' : 'text-brand-red'}`}>
            {portfolioData.xirr}% p.a.
          </div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">No. of Funds</div>
          <div className="text-xl md:text-2xl font-bold text-brand-text mt-1">{portfolioData.funds.length} funds</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Expense Drag</div>
          <div className={`text-xl md:text-2xl font-bold mt-1 ${portfolioData.expense_drag > 5000 ? 'text-brand-red' : portfolioData.expense_drag >= 2000 ? 'text-brand-amber' : 'text-brand-green'}`}>
            {formatINR(portfolioData.expense_drag)}/yr
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Chart & Patterns */}
        <div className="flex-[2] space-y-8">
          {/* Chart Card */}
          <div className="bg-brand-surface border border-brand-border rounded-xl p-6 relative">
            <h2 className="text-lg font-bold text-brand-text mb-2 text-center pointer-events-none">Asset Allocation</h2>
            <AllocationChart portfolio={portfolioData} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-4 text-center pointer-events-none">
              <div className="text-[10px] text-brand-muted font-semibold uppercase tracking-widest">Total</div>
              <div className="text-lg font-bold text-brand-text">{formatINR(portfolioData.total_value)}</div>
            </div>
          </div>

          {/* Overlap Warnings */}
          <div>
            <h2 className="text-lg font-bold text-brand-text mb-4">Overlap Detection</h2>
            {portfolioData.overlap && portfolioData.overlap.filter((x: any) => x.overlap_pct > 50).length > 0 ? (
               <div className="bg-brand-amber/10 border border-brand-amber/40 rounded-xl p-5">
                 <div className="flex items-center gap-3 mb-3">
                   <AlertTriangle className="w-5 h-5 text-brand-amber shrink-0" />
                   <h3 className="font-bold text-brand-amber">High Overlap Alert</h3>
                 </div>
                 <div className="space-y-2 text-sm text-brand-amber/80">
                   {portfolioData.overlap.filter((x: any) => x.overlap_pct > 50).map((o: any, i: number) => (
                     <div key={i}>
                       <span className="font-semibold text-brand-amber/90">{o.fund_a}</span> and <span className="font-semibold text-brand-amber/90">{o.fund_b}</span> share {o.overlap_pct}% of holdings
                     </div>
                   ))}
                 </div>
               </div>
            ) : (
               <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl p-5 text-brand-green text-sm flex items-start gap-3">
                 <CheckCircle2 className="w-5 h-5 shrink-0" />
                 Good diversification — no significant overlaps detected.
               </div>
            )}
          </div>
        </div>

        {/* Right Column: Table & Insights */}
        <div className="flex-[3] space-y-8">
          
          {/* AI Rebalancing Recommendations */}
          <div>
            <h2 className="text-lg font-bold text-brand-text mb-4">AI Rebalancing Recommendations</h2>
            <div className="bg-brand-card border-l-4 border-r border-t border-b border-l-brand-green border-brand-border rounded-r-xl p-6">
              <div className="space-y-4">
                {portfolioData.rebalancing_suggestion.split('\n• ').map((b: string, i: number) => {
                  const txt = b.replace('• ', '').trim()
                  if (!txt) return null
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-green mt-2 shrink-0" />
                      <p className="text-brand-muted text-sm leading-relaxed">{txt}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-8 pt-4 border-t border-brand-border text-xs text-slate-500 italic text-center">
                This is AI-generated analysis, not SEBI-registered financial advice.
              </div>
            </div>
          </div>

          {/* Fund Details Table */}
          <div>
            <h2 className="text-lg font-bold text-brand-text mb-4">Fund Holdings</h2>
            <div className="bg-brand-surface border border-brand-border rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-brand-card border-b border-brand-border text-xs uppercase text-brand-muted tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fund Name</th>
                    <th className="px-4 py-3 font-semibold text-right">Units</th>
                    <th className="px-4 py-3 font-semibold text-right">NAV</th>
                    <th className="px-4 py-3 font-semibold text-right">Value</th>
                    <th className="px-4 py-3 font-semibold text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d45]">
                  {portfolioData.funds.map((fund: any, i: number) => (
                    <tr key={i} className="hover:bg-brand-card transition-colors">
                      <td className="px-4 py-4 text-brand-text font-medium max-w-[200px] truncate">{fund.fund_name}</td>
                      <td className="px-4 py-4 text-brand-muted text-right">{fund.units.toFixed(2)}</td>
                      <td className="px-4 py-4 text-brand-muted text-right">{formatINR(fund.current_nav)}</td>
                      <td className="px-4 py-4 text-brand-text font-semibold text-right">{formatINR(fund.current_value)}</td>
                      <td className="px-4 py-4 text-brand-green font-medium text-right">{fund.allocation_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
