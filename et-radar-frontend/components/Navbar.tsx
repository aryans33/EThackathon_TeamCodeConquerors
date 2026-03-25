"use client"
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Activity, Sun, Moon } from 'lucide-react'
import { useTheme } from "next-themes"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    const envDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    const ls = window.localStorage.getItem('et_radar_demo_mode')
    setIsDemo(ls !== null ? ls === 'true' : envDemo)
  }, [])

  const toggleDemo = () => {
    const newVal = !isDemo
    window.localStorage.setItem('et_radar_demo_mode', String(newVal))
    window.location.reload()
  }

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'AI Chat', href: '/chat' },
  ]

  return (
    <header className="border-b border-brand-border bg-brand-surface sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-brand-green" />
            <span className="text-xl font-bold tracking-tight text-brand-text">ET Radar</span>
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="text-sm font-medium text-brand-muted hover:text-brand-text transition-colors">
                {link.name}
              </Link>
            ))}
            <div className="h-6 w-px bg-brand-border mx-2"></div>
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full text-brand-muted hover:text-brand-text transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
            <button 
              onClick={toggleDemo}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                isDemo 
                  ? 'bg-amber-900/30 border-amber-700/50 text-amber-400 hover:bg-amber-900/50' 
                  : 'bg-brand-green/10 border-brand-green/30 text-brand-green hover:bg-brand-green/20'
              }`}
            >
              {isDemo ? 'DEMO' : 'LIVE'}
            </button>
          </nav>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-4">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-full text-brand-muted hover:text-brand-text transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            <button 
              onClick={toggleDemo}
              className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                isDemo 
                  ? 'bg-amber-900/30 border-amber-700/50 text-amber-400' 
                  : 'bg-brand-green/10 border-brand-green/30 text-brand-green'
              }`}
            >
              {isDemo ? 'DEMO' : 'LIVE'}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-brand-muted hover:text-brand-text p-1"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden border-t border-brand-border bg-brand-bg">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                className="block rounded-md px-3 py-2 text-base font-medium text-brand-muted hover:bg-brand-surface hover:text-brand-text"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
