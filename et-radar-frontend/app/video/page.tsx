'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type VisualType = 'nifty_summary' | 'race_chart' | 'fii_dii' | 'signal_spotlight' | 'ipo_tracker' | 'outro'

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
    latest_filing?: { symbol: string; category: string; title: string; date: string; summary: string }
    fii_dii?: FiiDiiPayload
    ipo_tracker?: IpoTrackerPayload
  }
}

type FiiDiiFlow = {
  date: string
  fii_net: number
  dii_net: number
  fii_cumulative: number
  dii_cumulative: number
  market_mood: 'bullish' | 'bearish'
}

type FiiDiiPayload = {
  flows: FiiDiiFlow[]
  fii_10d_net: number
  dii_10d_net: number
  fii_trend: string
  summary: string
  data_source: string
  generated_at: string
}

type UpcomingIpo = {
  company: string
  open_date: string
  close_date: string
  price_band: string
  lot_size: number | null
  issue_size: string
  sector: string
  gmp: string
  subscription: string
  rating: string
}

type RecentIpo = {
  company: string
  list_date: string
  issue_price: number
  list_price: number
  current_price: number
  return_pct: number
  sector: string
}

type IpoTrackerPayload = {
  upcoming: UpcomingIpo[]
  recently_listed: RecentIpo[]
  data_source: string
  generated_at: string
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
      duration_sec: 12,
      visual_type: 'ipo_tracker',
      headline: 'IPO Watch',
      voiceover:
        'In IPO watch, Ather Energy is opening soon with strong gray market traction, while recently listed names remain mixed. Track price band discipline and listing momentum.',
    },
    {
      id: 6,
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
    latest_filing: {
      symbol: 'RELIANCE',
      category: 'Earnings',
      title: 'Board approves Q4 capex roadmap and retail expansion update',
      date: new Date().toISOString().slice(0, 10),
      summary: 'Management highlighted strong refining margins and maintained FY growth guidance.',
    },
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
        <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#000000' }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>FII Flow (₹ Cr)</div>
          <div style={{ marginTop: 4, color: fiiPos ? '#22c55e' : '#ef4444', fontWeight: 800, fontSize: 28 }}>
            {fiiPos ? '▲' : '▼'} {Math.abs(script.data.fii_flow).toLocaleString('en-IN')}
          </div>
        </div>
        <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#000000' }}>
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

function FiiDiiChart({ payload }: { payload: FiiDiiPayload }) {
  return (
    <div className='rounded-xl border border-[#30363d] bg-[#161b22] p-4 mt-4'>
      <h3 className='text-sm font-medium text-slate-100 mb-3'>FII / DII Net Flows (INR Crore)</h3>
      <ResponsiveContainer width='100%' height={180}>
        <BarChart data={payload.flows}>
          <XAxis dataKey='date' tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip formatter={(v: any) => `INR ${Number(v).toLocaleString('en-IN')} Cr`} />
          <Legend />
          <Bar dataKey='fii_net' name='FII Net' fill='#d4af37' radius={[3, 3, 0, 0]} />
          <Bar dataKey='dii_net' name='DII Net' fill='#10B981' radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className='text-xs text-slate-400 mt-2'>{payload.summary}</p>
    </div>
  )
}

function IpoCard({ ipo }: { ipo: UpcomingIpo }) {
  return (
    <div className='rounded-lg border border-slate-700 bg-slate-900/30 p-3 text-sm'>
      <div className='font-medium text-slate-100'>{ipo.company}</div>
      <div className='text-slate-400 text-xs mt-0.5'>{ipo.sector}</div>
      <div className='flex justify-between mt-2 text-slate-300'>
        <span>{ipo.price_band}</span>
        <span className='text-green-400 font-medium'>{ipo.gmp}</span>
      </div>
      <div className='text-xs text-slate-400 mt-1'>
        {ipo.open_date} to {ipo.close_date} · {ipo.issue_size}
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${
          ipo.rating === 'Subscribe' ? 'bg-green-900/40 text-green-300' : 'bg-amber-900/40 text-amber-300'
        }`}
      >
        {ipo.rating}
      </span>
    </div>
  )
}

function SignalSpotlightScene({ script }: { script: DailyScript }) {
  const target = Math.round(script.data.top_signal.confidence * 100)
  const [display, setDisplay] = useState(0)
  const latestFiling =
    script.data.latest_filing ??
    {
      symbol: 'RELIANCE',
      category: 'Earnings',
      title: 'Board approves Q4 capex roadmap and retail expansion update',
      date: new Date().toISOString().slice(0, 10),
      summary: 'Management highlighted strong refining margins and maintained FY growth guidance.',
    }

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
      <div style={{ marginTop: 10, width: '90%', maxWidth: 620, border: '1px solid #334155', borderRadius: 10, background: '#000000', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 11, color: '#d4af37', letterSpacing: 1, textTransform: 'uppercase' }}>Latest Filing</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{latestFiling.date}</div>
        </div>
        <div style={{ marginTop: 4, color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>
          {latestFiling.symbol} · {latestFiling.category}
        </div>
        <div style={{ marginTop: 3, color: '#cbd5e1', fontSize: 12 }}>{latestFiling.title}</div>
      </div>
    </div>
  )
}

function IpoTrackerScene({ payload }: { payload: IpoTrackerPayload | null }) {
  const hasData = !!payload && (payload.upcoming.length > 0 || payload.recently_listed.length > 0)

  if (!hasData) {
    return (
      <div style={{ height: 360, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 620, border: '1px solid #334155', borderRadius: 12, padding: 16, background: '#000000', textAlign: 'center' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700 }}>IPO data updates daily at market open</div>
          <div style={{ color: '#94a3b8', marginTop: 6, fontSize: 13 }}>Try regenerating after the next exchange refresh window.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: 360, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#000000', padding: 10, overflowY: 'auto' }}>
        <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Upcoming IPOs</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {payload?.upcoming.map((ipo) => (
            <div key={ipo.company} style={{ border: '1px solid #334155', borderRadius: 8, background: '#111827', padding: 8 }}>
              <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{ipo.company}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>{ipo.price_band}</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{ipo.open_date} to {ipo.close_date}</div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>{ipo.gmp}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: ipo.rating === 'Subscribe' ? '#14532d' : '#78350f',
                    color: ipo.rating === 'Subscribe' ? '#86efac' : '#fcd34d',
                  }}
                >
                  {ipo.rating}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#000000', padding: 10, overflowY: 'auto' }}>
        <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Recent Listings</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {payload?.recently_listed.map((ipo) => (
            <div key={ipo.company} style={{ border: '1px solid #334155', borderRadius: 8, background: '#111827', padding: 8 }}>
              <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{ipo.company}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Issue: INR {ipo.issue_price.toLocaleString('en-IN')}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Current: INR {ipo.current_price.toLocaleString('en-IN')}</div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: ipo.return_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                Return: {ipo.return_pct >= 0 ? '+' : ''}{ipo.return_pct}%
              </div>
            </div>
          ))}
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
          background: 'linear-gradient(90deg, #d4af37, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        ET Radar
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Opportunity Radar', 'Pattern Detection', 'AI Chat'].map((p) => (
          <span key={p} style={{ fontSize: 12, color: '#cbd5e1', border: '1px solid #334155', borderRadius: 999, padding: '6px 12px', background: '#000000' }}>
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
  const [fiiDiiData, setFiiDiiData] = useState<FiiDiiPayload | null>(null)
  const [ipoData, setIpoData] = useState<IpoTrackerPayload | null>(null)
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
      const [scriptRes, fiiRes, ipoRes] = await Promise.all([
        fetch('http://localhost:8000/api/video/daily-script'),
        fetch('http://localhost:8000/api/video/fii-dii-flows'),
        fetch('http://localhost:8000/api/video/ipo-tracker'),
      ])

      if (!scriptRes.ok) throw new Error('video api unavailable')
      const data = await scriptRes.json()
      if (data?.scenes?.length) {
        const hasIpo = data.scenes.some((s: Scene) => s.visual_type === 'ipo_tracker')
        if (!hasIpo) {
          const outroIdx = data.scenes.findIndex((s: Scene) => s.visual_type === 'outro')
          const ipoScene: Scene = {
            id: 999,
            duration_sec: 12,
            visual_type: 'ipo_tracker',
            headline: 'IPO Watch',
            voiceover: 'IPO window remains active with upcoming issues and mixed listing performance.',
          }

          if (outroIdx >= 0) {
            const nextScenes = [...data.scenes]
            nextScenes.splice(outroIdx, 0, ipoScene)
            setScript({ ...data, scenes: nextScenes })
          } else {
            setScript({ ...data, scenes: [...data.scenes, ipoScene] })
          }
        } else {
          setScript(data)
        }
      } else {
        setScript(DEMO_SCRIPT)
      }

      if (fiiRes.ok) {
        const fii = await fiiRes.json()
        setFiiDiiData(fii)
      }

      if (ipoRes.ok) {
        const ipo = await ipoRes.json()
        setIpoData(ipo)
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
    let mounted = true

    ;(async () => {
      try {
        const [fiiRes, ipoRes] = await Promise.all([
          fetch('http://localhost:8000/api/video/fii-dii-flows'),
          fetch('http://localhost:8000/api/video/ipo-tracker'),
        ])

        if (mounted && fiiRes.ok) {
          const fii = await fiiRes.json()
          setFiiDiiData(fii)
        }

        if (mounted && ipoRes.ok) {
          const ipo = await ipoRes.json()
          setIpoData(ipo)
        }
      } catch {
        // Keep silent fallback for demo reliability.
      }
    })()

    return () => {
      mounted = false
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
    if (scene.visual_type === 'ipo_tracker') return <IpoTrackerScene key={scene.id} payload={ipoData ?? activeScript.data.ipo_tracker ?? null} />
    return <OutroScene key={scene.id} />
  }

  return (
    <main className='max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4 dark:bg-black min-h-screen'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold text-content-primary'>Daily Market Wrap</h1>
          <p className='text-sm text-content-secondary mt-1'>AI-generated in seconds · Zero human editing · Powered by Groq</p>
          <p className='text-xs text-content-muted mt-1'>{todayText}</p>
        </div>
        <span className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-red-200 bg-red-900/30 border border-red-700'>
          <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
          LIVE
        </span>
      </div>

      {!script && !loadingScript && (
        <div className='rounded-xl border border-border bg-surface-1 p-6'>
          <button
            type='button'
            onClick={generateScript}
            className='px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors'
          >
            Generate Today&apos;s Market Wrap
          </button>
        </div>
      )}

      {loadingScript && (
        <div className='rounded-xl border border-border bg-surface-1 p-6'>
          <p className='text-content-primary'>AI is writing today&apos;s script...</p>
          <div className='mt-3 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700'>
            <div className='h-full bg-[#d4af37] transition-all duration-100' style={{ width: `${genProgress}%` }} />
          </div>
          <p className='text-xs text-content-secondary mt-2'>{genProgress}%</p>
        </div>
      )}

      {hasGenerated && !loadingScript && (
        <>
        <div className='grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4'>
          <section className='rounded-xl border border-border bg-surface-1 p-4'>
            <div className='aspect-video rounded-lg border border-border bg-[#eef2f7] dark:bg-black overflow-hidden'>
              <div style={{ height: 360, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.15s ease-in-out' }}>
                {isSpeaking && (
                  <div className='absolute right-8 mt-3 z-10 inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-black/40 border border-black/60 text-[#d4af37]'>
                    Speaking...
                  </div>
                )}
                {renderScene()}
              </div>
              <div className='px-4 pb-3'>
                <div className='h-1.5 rounded-full bg-slate-800 border border-slate-700 overflow-hidden'>
                  <div className='h-full bg-[#d4af37] transition-all duration-100' style={{ width: `${sceneProgress}%` }} />
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
                className='px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm'
              >
                ▶ Play
              </button>
              <button
                type='button'
                onClick={generateScript}
                className='px-3 py-2 rounded-lg border border-border text-content-secondary hover:border-amber-500 hover:text-content-primary text-sm'
              >
                ↻ Regenerate
              </button>
              <button
                type='button'
                onClick={playWithVoice}
                className='px-3 py-2 rounded-lg border border-border text-content-secondary hover:border-amber-500 hover:text-content-primary text-sm'
              >
                ▶ Play with Voice
              </button>
              <button
                type='button'
                onClick={stopSpeech}
                className='px-3 py-2 rounded-lg border border-border text-content-secondary hover:border-red-500 hover:text-content-primary text-sm'
              >
                Mute
              </button>
            </div>
          </section>

          <aside className='rounded-xl border border-border bg-surface-1 p-3'>
            <h3 className='text-sm font-semibold text-content-primary mb-2'>Scenes</h3>
            <div className='space-y-2'>
              {activeScript.scenes.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => transitionTo(idx)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    idx === currentScene
                      ? 'bg-amber-500/20 border-amber-500 text-amber-500'
                      : 'bg-surface-2 border-border text-content-secondary hover:border-amber-500'
                  }`}
                >
                  <div className='font-medium'>{idx + 1}. {s.headline}</div>
                  <div className='text-[11px] text-content-muted mt-1'>{s.duration_sec}s · {s.visual_type}</div>
                </button>
              ))}
            </div>
          </aside>
        </div>

        {fiiDiiData && fiiDiiData.flows.length > 0 && <FiiDiiChart payload={fiiDiiData} />}

        </>
      )}
    </main>
  )
}
