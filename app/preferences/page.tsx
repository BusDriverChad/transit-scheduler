'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type ShiftPreference = 'AM' | 'PM' | 'both'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type DriverPreference = {
  id: string
  driver_id: string
  shift_preference: ShiftPreference
  days_off: string[]
  notes: string
  updated_at: string
  profiles: {
    name: string
  }
}

type Profile = {
  id: string
  name: string
  role: 'supervisor' | 'driver'
}

// ---------------------------------------------------------------------------
// Supervisor view — read-only list of all driver preferences
// ---------------------------------------------------------------------------
function SupervisorView({ preferences }: { preferences: DriverPreference[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-white font-semibold text-lg">All Driver Preferences</h2>
      {preferences.length === 0 && (
        <p className="text-[#4a6fa5] text-sm">No preferences submitted yet.</p>
      )}
      {preferences.map(pref => (
        <div
          key={pref.id}
          className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">{pref.profiles?.name ?? 'Unknown'}</span>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                background: pref.shift_preference === 'AM'
                  ? 'rgba(251,191,36,0.15)'
                  : pref.shift_preference === 'PM'
                  ? 'rgba(74,158,255,0.15)'
                  : 'rgba(74,222,128,0.15)',
                color: pref.shift_preference === 'AM'
                  ? '#fbbf24'
                  : pref.shift_preference === 'PM'
                  ? '#4a9eff'
                  : '#4ade80',
              }}
            >
              {pref.shift_preference === 'both' ? 'AM / PM' : pref.shift_preference}
            </span>
          </div>

          <div className="mb-3">
            <p className="text-[#4a6fa5] text-xs uppercase tracking-wider mb-1.5">Preferred days off</p>
            {pref.days_off.length === 0 ? (
              <p className="text-[#4a6fa5] text-sm">None specified</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {pref.days_off.map(day => (
                  <span
                    key={day}
                    className="text-xs px-2.5 py-1 rounded-full text-white"
                    style={{ background: 'rgba(74,158,255,0.15)', border: '1px solid rgba(74,158,255,0.25)' }}
                  >
                    {day}
                  </span>
                ))}
              </div>
            )}
          </div>

          {pref.notes && (
            <div>
              <p className="text-[#4a6fa5] text-xs uppercase tracking-wider mb-1.5">Notes</p>
              <p className="text-[#a0b4cc] text-sm leading-relaxed">{pref.notes}</p>
            </div>
          )}

          <p className="text-[#2a3f5f] text-xs mt-3">
            Updated {new Date(pref.updated_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Driver view — editable preferences for the current driver
// ---------------------------------------------------------------------------
function DriverView({ driverId, existing }: { driverId: string; existing: DriverPreference | null }) {
  const [shift, setShift] = useState<ShiftPreference>(existing?.shift_preference ?? 'both')
  const [daysOff, setDaysOff] = useState<string[]>(existing?.days_off ?? [])
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (day: string) => {
    setDaysOff(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    const payload = {
      driver_id: driverId,
      shift_preference: shift,
      days_off: daysOff,
      notes,
      updated_at: new Date().toISOString(),
    }

    const { error } = existing
      ? await supabase.from('driver_preferences').update(payload).eq('driver_id', driverId)
      : await supabase.from('driver_preferences').insert(payload)

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  const shiftOptions: { value: ShiftPreference; label: string; color: string; bg: string }[] = [
    { value: 'AM', label: 'AM', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    { value: 'PM', label: 'PM', color: '#4a9eff', bg: 'rgba(74,158,255,0.12)' },
    { value: 'both', label: 'Either', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  ]

  return (
    <div className="space-y-8">
      {/* Shift preference */}
      <div>
        <p className="text-[#4a6fa5] text-xs uppercase tracking-wider mb-4">Shift Preference</p>
        <div className="grid grid-cols-3 gap-3">
          {shiftOptions.map(opt => {
            const selected = shift === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => { setShift(opt.value); setSaved(false) }}
                className="py-5 rounded-2xl font-semibold text-base transition-all duration-200 active:scale-95"
                style={{
                  background: selected ? opt.bg : 'rgba(255,255,255,0.04)',
                  border: selected
                    ? `2px solid ${opt.color}`
                    : '2px solid rgba(255,255,255,0.08)',
                  color: selected ? opt.color : '#4a6fa5',
                  boxShadow: selected ? `0 0 20px ${opt.color}33` : 'none',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Days off */}
      <div>
        <p className="text-[#4a6fa5] text-xs uppercase tracking-wider mb-4">Preferred Days Off</p>
        <div className="grid grid-cols-2 gap-3">
          {DAYS.map(day => {
            const selected = daysOff.includes(day)
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className="py-4 px-4 rounded-2xl text-left font-medium text-sm transition-all duration-200 active:scale-95 flex items-center gap-3"
                style={{
                  background: selected ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: selected
                    ? '2px solid rgba(74,158,255,0.5)'
                    : '2px solid rgba(255,255,255,0.08)',
                  color: selected ? '#4a9eff' : '#4a6fa5',
                }}
              >
                <span
                  className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                  style={{
                    background: selected ? '#4a9eff' : 'rgba(255,255,255,0.06)',
                    border: selected ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {selected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[#4a6fa5] text-xs uppercase tracking-wider mb-4">Notes</p>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false) }}
          placeholder="Any scheduling needs, medical appointments, recurring conflicts..."
          rows={4}
          className="w-full px-4 py-3.5 rounded-2xl text-white text-sm outline-none resize-none transition-all leading-relaxed"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            caretColor: '#4a9eff',
          }}
          onFocus={e => (e.target.style.borderColor = '#4a9eff')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>

      {error && (
        <div
          className="text-red-400 text-sm text-center py-3 px-4 rounded-xl"
          style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all duration-200 active:scale-95"
        style={{
          background: saved
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            : saving
            ? 'rgba(74,158,255,0.4)'
            : 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)',
          boxShadow: saved
            ? '0 4px 20px rgba(34,197,94,0.35)'
            : saving
            ? 'none'
            : '0 4px 20px rgba(74,158,255,0.35)',
        }}
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PreferencesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [preferences, setPreferences] = useState<DriverPreference[]>([])
  const [myPreference, setMyPreference] = useState<DriverPreference | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/'
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', session.user.id)
        .single()

      if (!prof) {
        window.location.href = '/'
        return
      }

      setProfile(prof)

      if (prof.role === 'supervisor') {
        const { data } = await supabase
          .from('driver_preferences')
          .select('*, profiles(name)')
          .order('updated_at', { ascending: false })
        setPreferences(data ?? [])
      } else {
        const { data } = await supabase
          .from('driver_preferences')
          .select('*, profiles(name)')
          .eq('driver_id', prof.id)
          .single()
        setMyPreference(data ?? null)
      }

      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#4a9eff 1px, transparent 1px), linear-gradient(90deg, #4a9eff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-lg mx-auto px-5 py-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Back to dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily: 'Georgia, serif' }}>
              Preferences
            </h1>
            <p className="text-[#4a6fa5] text-xs mt-0.5">
              {profile?.role === 'supervisor' ? 'All driver preferences' : 'Your scheduling preferences'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#4a9eff', borderTopColor: 'transparent' }}
            />
          </div>
        ) : profile?.role === 'supervisor' ? (
          <SupervisorView preferences={preferences} />
        ) : profile ? (
          <DriverView driverId={profile.id} existing={myPreference} />
        ) : null}
      </div>
    </div>
  )
}
