'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { clearAuth, getUser, isGuest, type User } from '@/lib/auth'
import { useToast } from '@/context/ToastContext'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Filings', href: '/filings' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'AI Chat', href: '/chat' },
]

function isActivePath(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/'
  return currentPath === href || currentPath.startsWith(`${href}/`)
}

function NavItem({ href, label, currentPath, onClick }: { href: string; label: string; currentPath: string; onClick?: () => void }) {
  const active = isActivePath(currentPath, href)
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        'text-sm px-3 py-1.5 rounded-md transition-colors',
        active
          ? 'text-white bg-surface-2 font-medium'
          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2/50',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [guest, setGuest] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    setUser(getUser())
    setGuest(isGuest())
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
    setMenuOpen(false)
  }, [pathname])

  const initial = useMemo(() => {
    const name = user?.name?.trim()
    if (!name) return 'U'
    return name[0].toUpperCase()
  }, [user])

  const handleSignOut = () => {
    clearAuth()
    setUser(null)
    setGuest(false)
    setMenuOpen(false)
    setDrawerOpen(false)
    toast.success('Signed out')
    router.push('/')
  }

  const authDesktop = !mounted ? (
    <div className="w-[100px] h-9" />
  ) : user ? (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-300 font-semibold text-sm"
        aria-label="Open user menu"
      >
        {initial}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-10 bg-surface-1 border border-border rounded-xl shadow-xl p-1 min-w-[160px] z-[60]">
          <div className="text-slate-300 text-sm px-3 pt-2 pb-1 font-medium">{user.name}</div>
          <div className="text-slate-500 text-xs px-3 pb-2 truncate">{user.email}</div>
          <div className="border-t border-border my-1" />
          <button
            type="button"
            onClick={handleSignOut}
            className="text-red-400 text-sm px-3 py-2 w-full text-left hover:bg-surface-2 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => router.push('/auth')}
      className="text-sm px-3 py-1.5 rounded-lg border border-border text-slate-300 hover:border-sky-500/50 hover:text-white transition-colors"
    >
      Sign In
    </button>
  )

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-12 md:h-14 bg-surface-1/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center">
              <div className="w-7 h-7 bg-sky-600 rounded-md flex items-center justify-center text-white font-bold text-sm">E</div>
              <span className="text-content-primary font-semibold text-base ml-2">ET Radar</span>
            </Link>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
              aria-label="Open navigation menu"
            >
              <span className="w-5 h-0.5 bg-slate-400" />
              <span className="w-5 h-0.5 bg-slate-400" />
              <span className="w-5 h-0.5 bg-slate-400" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} href={item.href} label={item.label} currentPath={pathname} />
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            {authDesktop}
          </div>
        </div>
      </nav>

      {drawerOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu overlay"
          />

          <aside
            className={[
              'fixed left-0 top-0 h-full w-64 bg-surface-1 border-r border-border z-50',
              'transform transition-transform duration-200',
              drawerOpen ? 'translate-x-0' : '-translate-x-full',
            ].join(' ')}
          >
            <div className="h-14 px-4 border-b border-border flex items-center justify-between">
              <Link href="/" className="flex items-center" onClick={() => setDrawerOpen(false)}>
                <div className="w-7 h-7 bg-sky-600 rounded-md flex items-center justify-center text-white font-bold text-sm">E</div>
                <span className="text-content-primary font-semibold text-base ml-2">ET Radar</span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-md hover:bg-surface-2 text-slate-300"
                aria-label="Close navigation menu"
              >
                ×
              </button>
            </div>

            <div className="px-3 py-4 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  currentPath={pathname}
                  onClick={() => setDrawerOpen(false)}
                />
              ))}
            </div>

            <div className="absolute left-0 right-0 bottom-0 p-3 border-t border-border">
              {mounted && user ? (
                <div className="space-y-2">
                  <div className="text-slate-300 text-sm font-medium truncate">{user.name}</div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left text-red-400 text-sm px-3 py-2 rounded-lg hover:bg-surface-2"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false)
                    router.push('/auth')
                  }}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  )
}
