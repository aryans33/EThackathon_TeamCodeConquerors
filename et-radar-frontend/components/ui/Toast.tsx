'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-sky-500/20 border-sky-500/30 text-sky-300',
  error: 'bg-red-500/20 border-red-500/30 text-red-300',
  warning: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  info: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

type ToastCardProps = {
  toast: ToastItem
  onClose: (id: string) => void
}

function ToastCard({ toast, onClose }: ToastCardProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const auto = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onClose(toast.id), 150)
    }, toast.duration ?? (toast.type === 'success' || toast.type === 'info' ? 4000 : 6000))

    return () => clearTimeout(auto)
  }, [toast, onClose])

  const closeNow = () => {
    setExiting(true)
    setTimeout(() => onClose(toast.id), 150)
  }

  return (
    <div
      className={[
        'rounded-xl px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[380px] shadow-lg border backdrop-blur-sm',
        TOAST_STYLES[toast.type],
        'transition-all duration-150 ease-out',
        exiting ? 'opacity-0 translate-x-2' : 'opacity-100 translate-y-0',
      ].join(' ')}
      style={{
        animation: exiting ? undefined : 'toast-enter 100ms ease-out',
      }}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm leading-none">{TOAST_ICONS[toast.type]}</span>
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={closeNow}
        className="text-sm opacity-80 hover:opacity-100 transition-opacity"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )
}

type ToastContainerProps = {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}

export function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  return (
    <>
      <style>{`@keyframes toast-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastCard toast={toast} onClose={dismiss} />
          </div>
        ))}
      </div>
    </>
  )
}
