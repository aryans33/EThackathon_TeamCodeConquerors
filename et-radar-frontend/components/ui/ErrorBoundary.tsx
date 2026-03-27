'use client'

import React from 'react'

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
  section?: string
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    return (
      <div className="dark:bg-[#0c1f18] light:bg-white border border-red-500/20 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <span className="text-amber-400 text-lg leading-none">⚠</span>
          <div className="flex-1">
            <h3 className="font-semibold dark:text-[#f0fdf4] light:text-[#1f2937]">
              Something went wrong in {this.props.section || 'this section'}
            </h3>
            <button
              type="button"
              className="mt-3 dark:bg-[#143a2b] dark:hover:bg-[#225a44] light:bg-gray-200 light:hover:bg-gray-300 px-3 py-2 rounded-md text-sm transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  section?: string
) {
  return function WrappedWithErrorBoundary(props: P) {
    return (
      <ErrorBoundary section={section}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
