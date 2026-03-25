import React from 'react'
import { WifiOff } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-900/20 border border-red-800 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-3">
        <WifiOff className="w-5 h-5 text-red-400 shrink-0" />
        <span className="text-sm text-red-200">{message}</span>
      </div>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-800/50 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          Retry
        </button>
      )}
    </div>
  )
}
