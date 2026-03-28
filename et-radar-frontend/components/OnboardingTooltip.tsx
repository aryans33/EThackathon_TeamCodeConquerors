'use client'

import { useEffect, useMemo, useState } from 'react'

export type TooltipStep = {
  targetId: string
  title: string
  body: string
  icon: string
}

export const ONBOARDING_STEPS: TooltipStep[] = [
  {
    targetId: 'live-signals-section',
    title: 'Live Signals',
    icon: 'LS',
    body: 'These are AI-detected opportunities updated every hour. Each signal is backed by real BSE filings, bulk deals, or earnings data - not just guesswork.',
  },
  {
    targetId: 'confidence-bar',
    title: 'Confidence Score',
    icon: 'CS',
    body: 'The higher this number, the stronger the signal. Above 75% means multiple data sources agree. Below 60% means use caution and do your own research.',
  },
  {
    targetId: 'ai-chat-nav',
    title: 'Ask ET Radar AI',
    icon: 'AI',
    body: "Ask anything in plain English - 'Should I buy RELIANCE?' or 'What happened to HDFC Bank today?' The AI knows your portfolio if you've uploaded it.",
  },
  {
    targetId: 'portfolio-nav',
    title: 'Portfolio X-Ray',
    icon: 'PX',
    body: 'Upload your CAMS or KFintech PDF statement and get instant analysis - fund overlap, XIRR returns, and AI rebalancing suggestions. Takes 30 seconds.',
  },
]

function getTooltipPosition(targetId: string): { top: number; left: number; arrowDir: 'up' | 'down' } {
  const target = document.getElementById(targetId)
  const vh = window.innerHeight
  const vw = window.innerWidth
  const cardWidth = 300
  const gap = 14

  if (!target) {
    return {
      top: Math.max(20, vh * 0.2),
      left: Math.max(20, (vw - cardWidth) / 2),
      arrowDir: 'up',
    }
  }

  const rect = target.getBoundingClientRect()
  const placeBelow = rect.top < vh / 2
  const rawTop = placeBelow ? rect.bottom + gap : rect.top - 220 - gap
  const rawLeft = rect.left + rect.width / 2 - cardWidth / 2

  const top = Math.max(20, Math.min(vh - 240, rawTop))
  const left = Math.max(20, Math.min(vw - cardWidth - 20, rawLeft))

  return {
    top,
    left,
    arrowDir: placeBelow ? 'up' : 'down',
  }
}

export default function OnboardingTooltip({
  steps,
  onComplete,
}: {
  steps: TooltipStep[]
  onComplete: () => void
}) {
  const [isReady, setIsReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number; arrowDir: 'up' | 'down' } | null>(null)

  const activeSteps = useMemo(() => (steps && steps.length > 0 ? steps : ONBOARDING_STEPS), [steps])
  const current = activeSteps[stepIndex]

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onboarded = localStorage.getItem('et_radar_onboarded')
    if (onboarded === 'true') {
      setVisible(false)
      setIsReady(true)
      return
    }

    setVisible(true)
    setStepIndex(0)
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!visible || !current) return

    const update = () => {
      setPosition(getTooltipPosition(current.targetId))
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [visible, current])

  if (!isReady || !visible || !current || !position) return null

  const finish = () => {
    localStorage.setItem('et_radar_onboarded', 'true')
    setVisible(false)
    onComplete()
  }

  const skip = () => {
    localStorage.setItem('et_radar_onboarded', 'true')
    setVisible(false)
  }

  const next = () => {
    if (stepIndex >= activeSteps.length - 1) {
      finish()
      return
    }
    setStepIndex((i) => i + 1)
  }

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: position.top,
        left: position.left,
        width: 'min(300px, calc(100vw - 40px))',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          ...(position.arrowDir === 'up'
            ? {
                top: -8,
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid #3b82f6',
              }
            : {
                bottom: -8,
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid #3b82f6',
              }),
        }}
      />

      <div
        style={{
          background: '#1f2937',
          border: '1px solid #3b82f6',
          borderRadius: 12,
          padding: 20,
          maxWidth: 300,
          boxShadow: '0 0 0 4000px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>{current.icon}</div>
          <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700 }}>{current.title}</div>
        </div>

        <p style={{ color: '#d1d5db', fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>{current.body}</p>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {activeSteps.map((_, i) => (
            <span
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i <= stepIndex ? '#60a5fa' : '#4b5563',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button
            type='button'
            onClick={skip}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Skip tour
          </button>

          <button
            type='button'
            onClick={next}
            style={{
              background: '#2563eb',
              border: '1px solid #3b82f6',
              color: '#ffffff',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {stepIndex === activeSteps.length - 1 ? 'Get started →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
