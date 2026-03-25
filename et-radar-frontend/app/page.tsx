"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import { Activity, Gauge, Upload, FileSearch, MessageSquare, Lightbulb } from 'lucide-react'

export default function LandingPage() {
  const [rotation, setRotation] = useState({ x: 15, y: -20 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const rX = 15 - ((y / rect.height) - 0.5) * 20
    const rY = -20 + ((x / rect.width) - 0.5) * 20
    setRotation({ x: rX, y: rY })
  }

  const handleMouseLeave = () => {
    setRotation({ x: 15, y: -20 })
  }

  return (
    <div className="flex flex-col min-h-screen overflow-hidden animate-in fade-in duration-700">
      {/* Hero Section */}
      <section className="relative pt-20 pb-20 lg:pt-32 lg:pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* Left: Typography & CTAs */}
          <div className="flex-1 space-y-8 z-10 w-full">
            <h1 className="text-5xl lg:text-7xl font-extrabold text-brand-text leading-[1.1] tracking-tight">
              Master the Markets<br />
              <span className="text-brand-muted/80">With AI-Powered Investemt Aid.</span>
            </h1>
            <p className="text-lg text-brand-muted max-w-xl leading-relaxed">
              Real-time Signals, In-depth Portfolio X-Ray, and a Market-Savvy AI Chat, all at your fingertips.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/dashboard"
                className="bg-brand-green hover:bg-[#00a866] text-white dark:text-[#0a0e1a] font-bold px-8 py-3.5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-green/20"
              >
                Start Free Trial
              </Link>
              <button className="bg-transparent border-2 border-brand-green/50 text-brand-green hover:bg-brand-green/10 font-bold px-8 py-3.5 rounded-full transition-all">
                See Case Studies
              </button>
            </div>
          </div>

          {/* Right: Floating 3D Composition */}
          <div 
            className="flex-1 relative h-[450px] w-full hidden lg:block z-50 cursor-crosshair ml-12"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Context wrapper for 3D */}
            <div 
              className="absolute inset-0 [transform-style:preserve-3d] scale-110 origin-center transition-transform duration-100 ease-out"
              style={{
                transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(3deg)`
              }}
            >
              
              {/* Card 1: Live Signals (Top Left) */}
              <div 
                className="absolute top-[15%] left-[0%] w-64 bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-2xl flex flex-col gap-3 transition-transform duration-300 backdrop-blur-md bg-opacity-95"
                style={{ transform: 'translateZ(-20px)' }}
              >
                <div className="flex justify-between items-center opacity-80 border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white tracking-widest uppercase">Live Signals</span>
                </div>
                <div className="bg-slate-800/50 rounded p-2.5 border border-slate-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-brand-green font-bold">BUY WATCH</span>
                    <span className="text-[10px] text-slate-400">84% confidence</span>
                  </div>
                  <div className="text-xs text-white font-semibold italic">TATAMOTORS</div>
                </div>
                <div className="bg-slate-800/50 rounded p-2.5 border border-slate-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-brand-red font-bold">SELL WATCH</span>
                    <span className="text-[10px] text-slate-400">92% confidence</span>
                  </div>
                  <div className="text-xs text-white font-semibold italic">HDFCBANK</div>
                </div>
              </div>

              {/* Card 2: AI Chat (Top Right) */}
              <div 
                className="absolute top-[10%] right-[-5%] w-72 bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-2xl flex flex-col gap-3 transition-transform duration-300 backdrop-blur-md bg-opacity-95"
                style={{ transform: 'translateZ(10px)' }}
              >
                <div className="flex justify-between items-center opacity-80 border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white tracking-widest uppercase">ET Radar AI</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="bg-slate-800 rounded-lg p-3 w-[85%] self-end border border-slate-700/50 mt-2">
                     <div className="h-2 w-24 bg-slate-600 rounded"></div>
                  </div>
                  <div className="bg-slate-800/50 border border-brand-green/20 rounded-lg p-4 w-[90%] self-start relative">
                     <div className="absolute -left-2 top-0 h-full w-4 bg-gradient-to-r from-brand-green/10 to-transparent blur-md"></div>
                     <div className="text-[11px] text-brand-green font-semibold mb-2 shadow-brand-green">Analyzing context...</div>
                     <div className="h-2 w-full bg-slate-700 rounded mb-1.5"></div>
                     <div className="h-2 w-3/4 bg-slate-700 rounded"></div>
                  </div>
                </div>
              </div>

              {/* Card 3: Portfolio X-Ray (Bottom Center) */}
              <div 
                className="absolute bottom-[5%] left-[25%] w-60 bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col gap-3 transition-transform duration-300 backdrop-blur-md bg-opacity-95 group"
                style={{ transform: 'translateZ(80px)' }}
              >
                <div className="flex justify-between items-center opacity-80 border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white tracking-widest uppercase">Portfolio X-Ray</span>
                </div>
                <div className="flex items-center justify-center py-5">
                  <div className="relative w-24 h-24 rounded-full border-[6px] border-slate-800 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 rounded-full border-[6px] border-brand-green border-t-transparent border-r-transparent -rotate-12 drop-shadow-[0_0_8px_rgba(0,192,118,0.5)]"></div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Overlap</span>
                      <span className="text-xl font-bold text-white">14%</span>
                    </div>
                  </div>
                </div>
                <button className="h-9 w-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center transition-colors">
                    <span className="text-[11px] text-brand-green font-bold">Generate AI Strategy</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Constraints Line */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-border to-transparent mb-20 hidden md:block"></div>

      {/* Features Row */}
      <section className="pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">

          {/* Feature 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6 h-12">
              <Activity className="w-10 h-10 text-brand-muted" />
              <Gauge className="w-10 h-10 text-brand-green" />
            </div>
            <h3 className="text-xl font-bold text-brand-text">AI-Driven Live Signals</h3>
            <p className="text-sm text-brand-muted leading-relaxed max-w-sm">
              ET Radar has improved your signal signals, and for hrasien trading in <span className="text-brand-green font-semibold">41% grional</span> confidence.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="space-y-4">
            <div className="flex items-center justify-start gap-2 mb-6 relative w-20 h-12">
              <Upload className="absolute left-0 bottom-0 w-8 h-8 text-brand-muted" />
              <div className="absolute right-0 top-0 bg-brand-bg rounded p-1 shadow-sm border border-brand-border">
                <FileSearch className="w-8 h-8 text-brand-green" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-brand-text">Instant Portfolio X-Ray</h3>
            <p className="text-sm text-brand-muted leading-relaxed max-w-sm">
              Upload your ax is in depth Portfolio X-Ray all the yime conosrest and your analysis.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6 relative w-24 h-12">
              <MessageSquare className="absolute left-0 top-2 w-8 h-8 text-brand-muted" />
              <div className="absolute left-6 bottom-0 bg-brand-bg rounded-full p-0.5 shadow-sm">
                <MessageSquare className="w-6 h-6 text-brand-green" style={{ transform: "scaleX(-1)" }} />
              </div>
              <Lightbulb className="absolute right-0 top-0 w-10 h-10 text-brand-text" />
            </div>
            <h3 className="text-xl font-bold text-brand-text">Context-Aware AI Chat</h3>
            <p className="text-sm text-brand-muted leading-relaxed max-w-sm">
              ET Radar has assessed comtnting enaryzing a context-Aware context-aware AI oiChat.
            </p>
          </div>

        </div>
      </section>
    </div>
  )
}
