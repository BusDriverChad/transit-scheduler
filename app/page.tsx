'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type LoginMode = 'email' | 'pin'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard'
    })
  }, [])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      if (newPin.length === 4) {
        setError('PIN login coming soon')
        setTimeout(() => { setPin(''); setError('') }, 1500)
      }
    }
  }

  const handlePinDelete = () => setPin(pin.slice(0, -1))

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#4a9eff 1px, transparent 1px), linear-gradient(90deg, #4a9eff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #4a9eff 0%, transparent 70%)' }}
      />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)', boxShadow: '0 0 40px rgba(74,158,255,0.4)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h1 className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Transit Scheduler
          </h1>
          <p className="text-[#4a6fa5] text-sm mt-1 tracking-wide uppercase text-xs">
            Durango Transit Operations
          </p>
        </div>

        <div className="flex rounded-xl p-1 mb-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => { setMode('email'); setError(''); setPin('') }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={mode === 'email'
              ? { background: '#4a9eff', color: 'white', boxShadow: '0 2px 12px rgba(74,158,255,0.4)' }
              : { color: '#4a6fa5' }
            }
          >
            Email Login
          </button>
          <button
            onClick={() => { setMode('pin'); setError(''); setPassword('') }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={mode === 'pin'
              ? { background: '#4a9eff', color: 'white', boxShadow: '0 2px 12px rgba(74,158,255,0.4)' }
              : { color: '#4a6fa5' }
            }
          >
            PIN Login
          </button>
        </div>

        {mode === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4a6fa5] uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@transitdept.com"
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#4a9eff' }}
                onFocus={e => e.target.style.borderColor = '#4a9eff'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4a6fa5] uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#4a9eff' }}
                onFocus={e => e.target.style.borderColor = '#4a9eff'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm text-center py-2 px-4 rounded-lg"
                style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm mt-2 transition-all duration-200"
              style={{
                background: loading ? 'rgba(74,158,255,0.4)' : 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(74,158,255,0.35)'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'pin' && (
          <div className="flex flex-col items-center">
            <p className="text-[#4a6fa5] text-sm mb-6">Enter your 4-digit PIN</p>
            <div className="flex gap-4 mb-8">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-4 h-4 rounded-full transition-all duration-200"
                  style={{
                    background: i < pin.length ? '#4a9eff' : 'rgba(255,255,255,0.1)',
                    boxShadow: i < pin.length ? '0 0 12px rgba(74,158,255,0.6)' : 'none'
                  }}
                />
              ))}
            </div>
            {error && (
              <div className="text-red-400 text-sm text-center py-2 px-4 rounded-lg mb-4"
                style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                {error}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
                <button
                  key={i}
                  onClick={() => key === '⌫' ? handlePinDelete() : key !== '' ? handlePinInput(key) : null}
                  disabled={key === ''}
                  className="h-16 rounded-2xl text-xl font-medium transition-all duration-150 active:scale-95"
                  style={key === ''
                    ? { background: 'transparent' }
                    : key === '⌫'
                    ? { background: 'rgba(255,255,255,0.05)', color: '#4a6fa5', border: '1px solid rgba(255,255,255,0.08)' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[#2a3f5f] text-xs mt-10">
          Transit Scheduler v1.0 · Supervisor access only
        </p>
      </div>
    </div>
  )
}
```

Save it. Then we need to create the dashboard folder. In your command prompt run:
```
mkdir app\dashboard
echo. > app\dashboard\page.tsx
notepad app\dashboard\page.tsx