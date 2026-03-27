'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'

type UseApiOptions<T> = {
  pollInterval?: number
  fallback?: T
  enabled?: boolean
}

type UseApiResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useApi<T>(
  url: string,
  options?: UseApiOptions<T>
): UseApiResult<T> {
  const pollInterval = options?.pollInterval
  const fallback = options?.fallback
  const enabled = options?.enabled ?? true

  const [data, setData] = useState<T | null>(fallback ?? null)
  const [loading, setLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await api.get(url)
      setData(res.data as T)
      setError(null)
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Request failed'

      if (fallback !== undefined) {
        setData(fallback)
        setError(null)
      } else {
        setError(String(detail))
      }
    } finally {
      setLoading(false)
    }
  }, [enabled, fallback, url])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!enabled || !pollInterval) return

    const id = setInterval(fetchData, pollInterval)
    return () => clearInterval(id)
  }, [enabled, pollInterval, fetchData])

  const refetch = useCallback(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch }
}
