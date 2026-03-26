'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getStatus } from '@/lib/api'
import { useTheme } from 'next-themes'

export default function Navbar() {
  const [isLive, setIsLive] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function checkStatus() {
      try {
        await getStatus()
        setIsLive(true)
      } catch (e) {
        setIsLive(false)
      }
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="dark:bg-[#0b1b16] light:bg-white dark:border-white/5 light:border-gray-200 border-b flex items-center justify-between px-8 py-5 transition-colors">
      <Link href="/" className="flex items-center space-x-2">
        <div className="flex items-center dark:text-[#9ae5ab] light:text-green-600 font-bold text-2xl relative">
          <span className="text-[32px] tracking-tighter">A</span>
          <span className="absolute left-[13px] top-[5px] text-[13px] -rotate-12">₹</span>
        </div>
        <span className="dark:text-[#e2e8f0] light:text-[#1f2937] font-bold text-[19px] tracking-wide ml-2">ARTHA.AI</span>
      </Link>
      <div className="hidden md:flex flex-1 justify-center space-x-8">
        <NavLink href="/dashboard" currentPath={pathname}>Dashboard</NavLink>
        <NavLink href="/portfolio" currentPath={pathname}>Portfolio</NavLink>
        <NavLink href="/chat" currentPath={pathname}>AI Chat</NavLink>
      </div>
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-4 dark:text-slate-400 light:text-gray-600">
          {mounted && (
            <>
              {theme === 'dark' ? (
                <button
                  onClick={() => setTheme('light')}
                  className="cursor-pointer dark:hover:text-white transition-colors"
                  aria-label="Switch to light mode"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </button>
              ) : (
                <button
                  onClick={() => setTheme('dark')}
                  className="cursor-pointer light:hover:text-gray-700 transition-colors"
                  aria-label="Switch to dark mode"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                </button>
              )}
            </>
          )}
           <svg className="w-5 h-5 cursor-pointer dark:hover:text-white light:hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        </div>
        <Link href="/dashboard" className="dark:border-[#143a2b] light:border-green-300 dark:bg-[#0c1f18] light:bg-green-50 dark:text-[#9ae5ab] light:text-green-700 dark:hover:bg-[#143a2b] dark:hover:text-white light:hover:bg-green-100 light:hover:text-green-900 border px-6 py-2 rounded-full font-medium transition-colors">
          Request Demo
        </Link>
      </div>
    </nav>
  )
}

function NavLink({ href, currentPath, children }: { href: string; currentPath: string; children: React.ReactNode }) {
  const isActive = currentPath === href
  return (
    <Link 
      href={href} 
      className={`transition-colors ${isActive ? 'dark:text-[#e2e8f0] light:text-green-700' : 'dark:text-[#64748b] light:text-gray-600 dark:hover:text-[#e2e8f0] light:hover:text-green-700'}`}
    >
      {children}
    </Link>
  )
}
