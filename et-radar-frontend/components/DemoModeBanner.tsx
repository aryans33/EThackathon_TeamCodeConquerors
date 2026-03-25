"use client"
import React, { useEffect, useState } from 'react'

export default function DemoModeBanner() {
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    // Check if DEMO_MODE is true (env vs localstorage)
    const envDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    const ls = window.localStorage.getItem('et_radar_demo_mode')
    setIsDemo(ls !== null ? ls === 'true' : envDemo)
  }, [])

  if (!isDemo) return null

  return (
    <div className="bg-amber-900/30 border-b border-amber-700 text-amber-400 text-xs font-semibold text-center py-1.5 w-full sticky top-0 z-50">
      Demo mode — using sample data. Connect backend to see live signals.
    </div>
  )
}
