'use client'

import { useMemo, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import api from '@/lib/api'
import { useToast } from '@/context/ToastContext'

type FilingRow = {
  id: number
  stock_symbol: string | null
  category: string
  headline: string
  raw_text: string
  source_url: string | null
  published_at: string
  signal_type: string | null
  confidence: number | null
  action_hint: string | null
}

export default function FilingsPage() {
  const { toast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const {
    data: filings,
    loading,
    error,
    refetch,
  } = useApi<FilingRow[]>('/filings/latest?limit=50', { fallback: [] })

  const sorted = useMemo(() => {
    return [...(filings || [])].sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
  }, [filings])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await api.post('/filings/refresh')
      toast.success('Filings refresh triggered')
      setTimeout(() => refetch(), 1000)
    } catch {
      toast.error('Could not reach BSE. Try again in a moment.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">Latest Filings</h1>
          <p className="text-sm text-content-secondary mt-1">Recent BSE announcements and linked signal context.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-2 text-sm rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-content-primary disabled:opacity-60 transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-surface-1 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-1 p-6 text-content-secondary">
          No filings available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((f) => (
            <article key={f.id} className="rounded-xl border border-border bg-surface-1 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {f.stock_symbol && (
                  <span className="px-2 py-1 rounded-md text-xs bg-surface-2 text-content-primary font-medium">
                    {f.stock_symbol}
                  </span>
                )}
                <span className="px-2 py-1 rounded-md text-xs bg-surface-2 text-content-secondary">
                  {f.category}
                </span>
                {f.action_hint && (
                  <span className="px-2 py-1 rounded-md text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    {f.action_hint}
                  </span>
                )}
                {typeof f.confidence === 'number' && (
                  <span className="px-2 py-1 rounded-md text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {f.confidence}%
                  </span>
                )}
                <span className="ml-auto text-xs text-content-muted">
                  {new Date(f.published_at).toLocaleString('en-IN')}
                </span>
              </div>

              <h2 className="text-sm md:text-base font-medium text-content-primary mb-2">{f.headline}</h2>
              <p className="text-sm text-content-secondary leading-relaxed">{f.raw_text}</p>

              {f.source_url && (
                <a
                  href={f.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 text-sm text-green-400 hover:text-green-300"
                >
                  Open source →
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
