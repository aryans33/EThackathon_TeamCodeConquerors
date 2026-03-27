'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { ToastContainer, type ToastItem, type ToastType } from '@/components/ui/Toast'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: {
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
    info: (msg: string) => void
  }
  dismiss: (id: string) => void
}

const noop = () => undefined

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: {
    success: noop,
    error: noop,
    warning: noop,
    info: noop,
  },
  dismiss: noop,
})

export const useToast = () => useContext(ToastContext)

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const add = (type: ToastType, message: string, duration?: number) => {
    const next: Toast = {
      id: makeId(),
      type,
      message,
      duration,
    }
    setToasts((prev) => [...prev, next])
  }

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast: {
        success: (msg: string) => add('success', msg),
        error: (msg: string) => add('error', msg),
        warning: (msg: string) => add('warning', msg),
        info: (msg: string) => add('info', msg),
      },
      dismiss,
    }),
    [toasts]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts as ToastItem[]} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}
