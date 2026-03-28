'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type VisualType = 'nifty_summary' | 'race_chart' | 'fii_dii' | 'signal_spotlight' | 'outro'

type Scene = {
  id: number
  duration_sec: number
  visual_type: VisualType
  headline: string
  voiceover: string
}

type DailyScript = {
  scenes: Scene[]
  data: {
    nifty: { value: number; change_pct: number }
    sensex: { value: number; change_pct: number }
    top_gainers: { symbol: string; change_pct: number }[]
    fii_flow: number
    dii_flow: number
    top_signal: { symbol: string; pattern: string; confidence: number }
  }
}

const DEMO_SCRIPT: DailyScript = {
  scenes: [
    {
      id: 1,
      duration_sec: 10,
      visual_type: 'nifty_summary',
      headline: 'Markets at a glance',
      voiceover:
        "Indian markets closed mixed today. Nifty 50 gained 0.43% while broader markets showed selective buying in banking and energy sectors.",
    },
    {
      id: 2,
      duration_sec: 15,
      visual_type: 'race_chart',
      headline: 'Top gainers today',
      voiceover:
        'TATAMOTORS led the gainers with a 2.1% surge following strong Q3 earnings. TCS and INFY also outperformed on renewed IT sector optimism.',
    },
    {
      id: 3,
      duration_sec: 12,
      visual_type: 'fii_dii',
      headline: 'Institutional flows',
      voiceover:
        'Foreign investors bought 1,240 crore worth of equities today, their third consecutive day of buying. Domestic institutions were net sellers at 340 crores.',
    },
    {
      id: 4,
      duration_sec: 13,
      visual_type: 'signal_spotlight',
      headline: 'ET Radar signal of the day',
      voiceover:
        "ET Radar's AI detected a high-confidence bullish trapezoid pattern on BAJFINANCE with 84% confidence. Institutional accumulation is supporting the setup.",
    },
    {
      id: 5,
      duration_sec: 10,
      visual_type: 'outro',
      headline: 'Powered by ET Radar',
      voiceover:
        "That's your ET Radar market wrap. Upload your portfolio for personalized signals. Tomorrow's wrap generates automatically at market close.",
    },
  ],
  data: {
    nifty: { value: 22847, change_pct: 0.43 },
    sensex: { value: 75200, change_pct: 0.38 },
    top_gainers: [
      { symbol: 'TATAMOTORS', change_pct: 2.1 },
      { symbol: 'TCS', change_pct: 1.8 },
      { symbol: 'INFY', change_pct: 1.4 },
      { symbol: 'HDFCBANK', change_pct: 0.9 },
      { symbol: 'TITAN', change_pct: 0.7 },
    ],
    fii_flow: 1240,
    dii_flow: -340,
    top_signal: { symbol: 'BAJFINANCE', pattern: 'Bullish Trapezoid', confidence: 0.84 },
  },
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function NumberCount({ target, decimals = 0, positive }: { target: number; decimals?: number; positive?: boolean }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let i = 0
    const steps = 50
    const increment = target / steps
    const timer = setInterval(() => {
      i += 1
      if (i >= steps) {
        setValue(target)
        clearInterval(timer)
      } else {
        setValue((prev) => prev + increment)
      }
    }, 20)
    return () => clearInterval(timer)
  }, [target])

  const shown = value.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
  const color = positive === undefined ? '#f8fafc' : positive ? '#22c55e' : '#ef4444'

  return <span style={{ color }}>{shown}</span>
}

function NiftySummaryScene({ script }: { script: DailyScript }) {
  const nPos = script.data.nifty.change_pct >= 0
  const sPos = script.data.sensex.change_pct >= 0

  return (
    <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, color: '#94a3b8', letterSpacing: 1 }}>NIFTY 50</div>
      <div style={{ fontSize: 52, fontWeight: 800 }}>
        <NumberCount target={script.data.nifty.value} positive={nPos} />
      </div>
      <div style={{ color: nPos ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 18 }}>
        {nPos ? '▲' : '▼'} {Math.abs(script.data.nifty.change_pct).toFixed(2)}%
      </div>
      <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 15 }}>SENSEX</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        <NumberCount target={script.data.sensex.value} positive={sPos} />
      </div>
      <div style={{ color: sPos ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
        {sPos ? '▲' : '▼'} {Math.abs(script.data.sensex.change_pct).toFixed(2)}%
      </div>
    </div>
  )
}

function RaceChartScene({ script }: { script: DailyScript }) {
  const gradient = ['#22c55e', '#34d399', '#4ade80', '#86efac', '#bbf7d0']
  return (
    <div style={{ height: 360, padding: 12 }}>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={script.data.top_gainers} layout='vertical' margin={{ top: 20, right: 24, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#1f2937' />
          <XAxis type='number' tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis type='category' dataKey='symbol' tick={{ fill: '#e5e7eb', fontSize: 12 }} />
          <Tooltip formatter={(v: any) => `${v}%`} />
          <Bar dataKey='change_pct' radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900}>
            {script.data.top_gainers.map((_, i) => (
              <Cell key={i} fill={gradient[i] || '#22c55e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FiiDiiScene({ script }: { script: DailyScript }) {
  const fiiPos = script.data.fii_flow >= 0
  const diiPos = script.data.dii_flow >= 0
  const barData = [
    { name: 'FII', value: script.data.fii_flow },
    { name: 'DII', value: script.data.dii_flow },
  ]

  return (
    <div style={{ height: 360, padding: '14px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#0f172a' }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>FII Flow (₹ Cr)</div>
          <div style={{ marginTop: 4, color: fiiPos ? '#22c55e' : '#ef4444', fontWeight: 800, fontSize: 28 }}>
            {fiiPos ? '▲' : '▼'} {Math.abs(script.data.fii_flow).toLocaleString('en-IN')}
          </div>
        </div>
        <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#0f172a' }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>DII Flow (₹ Cr)</div>
          <div style={{ marginTop: 4, color: diiPos ? '#22c55e' : '#ef4444', fontWeight: 800, fontSize: 28 }}>
            {diiPos ? '▲' : '▼'} {Math.abs(script.data.dii_flow).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 12 }}>Net institutional activity today</div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={barData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#1f2937' />
            <XAxis dataKey='name' tick={{ fill: '#cbd5e1' }} />
            <YAxis tick={{ fill: '#9ca3af' }} />
            <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')} Cr`} />
            <Bar dataKey='value' isAnimationActive animationDuration={900}>
              <Cell fill={fiiPos ? '#22c55e' : '#ef4444'} />
              <Cell fill={diiPos ? '#22c55e' : '#ef4444'} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SignalSpotlightScene({ script }: { script: DailyScript }) {
  const target = Math.round(script.data.top_signal.confidence * 100)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i += 1
      const next = Math.min(target, Math.round((target / 45) * i))
      setDisplay(next)
      if (next >= target) clearInterval(timer)
    }, 33)
    return () => clearInterval(timer)
  }, [target])

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (display / 100) * circumference

  return (
    <div style={{ height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>ET Radar Signal</div>
      <div style={{ marginTop: 8, fontSize: 40, fontWeight: 800, color: '#f59e0b' }}>{script.data.top_signal.symbol}</div>
      <div style={{ marginTop: 6, border: '1px solid #334155', borderRadius: 999, color: '#cbd5e1', padding: '5px 12px', fontSize: 13 }}>
        {script.data.top_signal.pattern}
      </div>
      <div style={{ marginTop: 12, position: 'relative', width: 140, height: 140 }}>
        <svg width='140' height='140'>
          <circle cx='70' cy='70' r={radius} stroke='#1f2937' strokeWidth='10' fill='none' />
          <circle
            cx='70'
            cy='70'
            r={radius}
            stroke='#22c55e'
            strokeWidth='10'
            fill='none'
            strokeLinecap='round'
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform='rotate(-90 70 70)'
            style={{ transition: 'stroke-dashoffset 0.12s linear' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontWeight: 800, fontSize: 24 }}>
          {display}%
        </div>
      </div>
    </div>
  )
}

function OutroScene() {
  return (
    <div style={{ height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16 }}>
      <div
        style={{
          fontSize: 52,
          fontWeight: 900,
          background: 'linear-gradient(90deg, #60a5fa, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        ET Radar
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Opportunity Radar', 'Pattern Detection', 'AI Chat'].map((p) => (
          <span key={p} style={{ fontSize: 12, color: '#cbd5e1', border: '1px solid #334155', borderRadius: 999, padding: '6px 12px', background: '#0f172a' }}>
            {p}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 16, color: '#cbd5e1', fontSize: 14 }}>AI-powered intelligence for Indian investors</div>
      <div style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>Next wrap generates at 4:00 PM IST</div>
    </div>
  )
}

export default function VideoPage() {
  const [script, setScript] = useState<DailyScript | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [currentScene, setCurrentScene] = useState(0)
  const [sceneProgress, setSceneProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [fadeIn, setFadeIn] = useState(true)
  const speechRef = useRef<SpeechSynthesis | null>(null)

  const activeScript = script || DEMO_SCRIPT
  const scene = activeScript.scenes[currentScene]

  const todayText = useMemo(() => formatLongDate(new Date()), [])

  const transitionTo = useCallback((nextIdx: number) => {
    setFadeIn(false)
    setTimeout(() => {
      setCurrentScene(nextIdx)
      setTimeout(() => setFadeIn(true), 150)
    }, 150)
  }, [])

  const generateScript = useCallback(async () => {
    setHasGenerated(true)
    setLoadingScript(true)
    setGenProgress(0)

    const fake = setInterval(() => {
      setGenProgress((p) => (p >= 90 ? 90 : p + 3))
    }, 100)

    try {
      const res = await fetch('http://localhost:8000/api/video/daily-script')
      if (!res.ok) throw new Error('video api unavailable')
      const data = await res.json()
      if (data?.scenes?.length) {
        setScript(data)
      } else {
        setScript(DEMO_SCRIPT)
      }
    } catch {
      setScript(DEMO_SCRIPT)
    } finally {
      clearInterval(fake)
      setGenProgress(100)
      setTimeout(() => setLoadingScript(false), 300)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || !scene) return

    setSceneProgress(0)
    const durationMs = scene.duration_sec * 1000
    const start = Date.now()

    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / durationMs) * 100)
      setSceneProgress(pct)

      if (elapsed >= durationMs) {
        clearInterval(id)
        if (currentScene < activeScript.scenes.length - 1) {
          transitionTo(currentScene + 1)
        } else {
          setIsPlaying(false)
        }
      }
    }, 100)

    return () => clearInterval(id)
  }, [isPlaying, scene, currentScene, activeScript.scenes.length, transitionTo])

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }

  useEffect(() => {
    return () => stopSpeech()
  }, [])

  const playWithVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    stopSpeech()
    speechRef.current = window.speechSynthesis

    const voices = speechRef.current.getVoices()
    const voice = voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang.startsWith('en'))

    setIsSpeaking(true)
    setIsPlaying(false)

    const speakScene = (idx: number) => {
      if (!activeScript.scenes[idx]) {
        setIsSpeaking(false)
        return
      }

      transitionTo(idx)
      setSceneProgress(100)

      const utterance = new SpeechSynthesisUtterance(activeScript.scenes[idx].voiceover)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      if (voice) utterance.voice = voice

      utterance.onend = () => {
        if (idx < activeScript.scenes.length - 1) {
          speakScene(idx + 1)
        } else {
          setIsSpeaking(false)
        }
      }
      utterance.onerror = () => setIsSpeaking(false)

      speechRef.current?.speak(utterance)
    }

    speakScene(0)
  }

  const renderScene = () => {
    if (!scene) return null
    if (scene.visual_type === 'nifty_summary') return <NiftySummaryScene key={scene.id} script={activeScript} />
    if (scene.visual_type === 'race_chart') return <RaceChartScene key={scene.id} script={activeScript} />
    if (scene.visual_type === 'fii_dii') return <FiiDiiScene key={scene.id} script={activeScript} />
    if (scene.visual_type === 'signal_spotlight') return <SignalSpotlightScene key={scene.id} script={activeScript} />
    return <OutroScene key={scene.id} />
  }

  return (
    <main className='max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold text-white'>📺 Daily Market Wrap</h1>
          <p className='text-sm text-slate-400 mt-1'>AI-generated in seconds · Zero human editing · Powered by Groq</p>
          <p className='text-xs text-slate-500 mt-1'>{todayText}</p>
        </div>
        <span className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-red-200 bg-red-900/30 border border-red-700'>
          <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
          LIVE
        </span>
      </div>

      {!script && !loadingScript && (
        <div className='rounded-xl border border-[#30363d] bg-[#161b22] p-6'>
          <button
            type='button'
            onClick={generateScript}
            className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors'
          >
            Generate Today&apos;s Market Wrap
          </button>
        </div>
      )}

      {loadingScript && (
        <div className='rounded-xl border border-[#30363d] bg-[#161b22] p-6'>
          <p className='text-slate-200'>⏳ AI is writing today&apos;s script...</p>
          <div className='mt-3 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700'>
            <div className='h-full bg-blue-500 transition-all duration-100' style={{ width: `${genProgress}%` }} />
          </div>
          <p className='text-xs text-slate-500 mt-2'>{genProgress}%</p>
        </div>
      )}

      {hasGenerated && !loadingScript && (
        <div className='grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4'>
          <section className='rounded-xl border border-[#30363d] bg-[#161b22] p-4'>
            <div className='aspect-video rounded-lg border border-[#30363d] bg-[#0f172a] overflow-hidden'>
              <div style={{ height: 360, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.15s ease-in-out' }}>
                {isSpeaking && (
                  <div className='absolute right-8 mt-3 z-10 inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-blue-900/40 border border-blue-700 text-blue-200'>
                    🔊 Speaking...
                  </div>
                )}
                {renderScene()}
              </div>
              <div className='px-4 pb-3'>
                <div className='h-1.5 rounded-full bg-slate-800 border border-slate-700 overflow-hidden'>
                  <div className='h-full bg-blue-500 transition-all duration-100' style={{ width: `${sceneProgress}%` }} />
                </div>
                <div className='mt-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-200'>
                  {scene?.voiceover}
                </div>
              </div>
            </div>

            <div className='mt-4 flex flex-wrap gap-2'>
              <button
                type='button'
                onClick={() => {
                  stopSpeech()
                  setCurrentScene(0)
                  setIsPlaying(true)
                }}
                className='px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm'
              >
                ▶ Play
              </button>
              <button
                type='button'
                onClick={generateScript}
                className='px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-blue-500 text-sm'
              >
                ↻ Regenerate
              </button>
              <button
                type='button'
                onClick={playWithVoice}
                className='px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-blue-500 text-sm'
              >
                ▶ Play with Voice
              </button>
              <button
                type='button'
                onClick={stopSpeech}
                className='px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-red-500 text-sm'
              >
                🔇 Mute
              </button>
            </div>
          </section>

          <aside className='rounded-xl border border-[#30363d] bg-[#161b22] p-3'>
            <h3 className='text-sm font-semibold text-slate-200 mb-2'>Scenes</h3>
            <div className='space-y-2'>
              {activeScript.scenes.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => transitionTo(idx)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    idx === currentScene
                      ? 'bg-blue-900/30 border-blue-700 text-blue-200'
                      : 'bg-slate-900/30 border-slate-700 text-slate-300 hover:border-blue-500'
                  }`}
                >
                  <div className='font-medium'>{idx + 1}. {s.headline}</div>
                  <div className='text-[11px] text-slate-500 mt-1'>{s.duration_sec}s · {s.visual_type}</div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
