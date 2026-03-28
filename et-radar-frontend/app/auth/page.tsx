'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { useToast } from '@/context/ToastContext'

export default function AuthPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email || !password) { setError('Email and password required'); return }
    if (mode === 'signup') {
      if (!name) { setError('Name required'); return }
      if (password !== confirm) { setError('Passwords do not match'); return }
    }
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name }
      const r = await api.post(endpoint, body)
      setAuth(r.data.access_token, r.data.user)
      toast.success(mode === 'login' ? 'Signed in successfully' : 'Account created successfully')
      router.push('/dashboard')
    } catch (e: any) {
      const responseData = e?.response?.data
      const detail = responseData?.detail
      const msg = typeof detail === 'string'
        ? detail
        : typeof responseData === 'string'
          ? responseData
          : 'Authentication failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const continueAsGuest = () => {
    localStorage.setItem('et_radar_guest', 'true')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d]
                      rounded-2xl p-8">
        
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-[#d4af37] rounded-lg flex items-center
                          justify-center text-white font-bold text-sm">E</div>
          <span className="text-white font-bold text-lg">ET Radar</span>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#30363d] mb-6">
          {(['login','signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={`pb-3 px-1 mr-6 text-sm font-medium transition-colors ${
                mode === m
                  ? 'text-white border-b-2 border-[#d4af37]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl
                         px-4 py-3 text-white text-sm placeholder-slate-500
                         focus:outline-none focus:border-[#d4af37] transition-colors"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl
                       px-4 py-3 text-white text-sm placeholder-slate-500
                       focus:outline-none focus:border-[#d4af37] transition-colors"
          />
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl
                         px-4 py-3 pr-12 text-white text-sm placeholder-slate-500
                         focus:outline-none focus:border-[#d4af37] transition-colors"
            />
            <button
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300
                         text-xs"
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
          {mode === 'signup' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl
                         px-4 py-3 text-white text-sm placeholder-slate-500
                         focus:outline-none focus:border-[#d4af37] transition-colors"
            />
          )}}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20
                          rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full font-medium py-3 rounded-xl transition-colors text-sm
                         disabled:opacity-50 disabled:cursor-not-allowed text-white bg-[#d4af37] hover:bg-[#c49f33]`}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </div>

        {/* Guest link */}
        <button
          onClick={continueAsGuest}
          className="w-full mt-4 text-slate-500 hover:text-slate-300 text-sm
                     transition-colors text-center"
        >
          Continue without account →
        </button>
      </div>
    </div>
  )
}
