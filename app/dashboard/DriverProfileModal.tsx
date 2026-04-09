'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  employeeId: string
  onClose: () => void
}

type ProfileData = {
  id: string
  full_name: string
  hire_date: string
  is_active: boolean
  roles: { name: string }
}

type ScoreData = {
  tenure_score: number
  performance_score: number
  combined_score: number
}

type HistoryEntry = {
  id: string
  points: number
  note: string | null
  created_at: string
  shift_date: string | null
  score_categories: { name: string; bucket: string }
  submitted_by_employee: { full_name: string } | null
}

type OffenseCount = {
  category_name: string
  count: number
}

type Training = {
  position: string
  cdl_required: boolean
}

const BUCKET_COLORS: Record<string, string> = {
  positive: '#4aff9e',
  conduct: '#ff6b6b',
  service: '#ffa94a',
  compliance: '#c084fc',
  vehicle: '#4a9eff',
}

const ROLE_COLORS: Record<string, string> = {
  supervisor: '#ffa94a',
  lead: '#4a9eff',
  assistant_supervisor: '#c084fc',
  driver: '#4aff9e',
}

function scoreColor(score: number) {
  if (score >= 80) return '#4aff9e'
  if (score >= 60) return '#4a9eff'
  if (score >= 40) return '#ffa94a'
  return '#ff6b6b'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function monthsEmployed(hireDate: string) {
  const hire = new Date(hireDate)
  const now = new Date()
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (years === 0) return `${months}mo`
  if (remainingMonths === 0) return `${years}yr`
  return `${years}yr ${remainingMonths}mo`
}

export default function DriverProfileModal({ employeeId, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [scores, setScores] = useState<ScoreData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [offenseCounts, setOffenseCounts] = useState<OffenseCount[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'history' | 'offenses' | 'training'>('history')

  useEffect(() => {
    loadAll()
  }, [employeeId])

  const loadAll = async () => {
    setLoading(true)
    const [profileRes, scoreRes, historyRes, trainingRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, hire_date, is_active, roles(name)')
        .eq('id', employeeId)
        .single(),
      supabase
        .from('scores')
        .select('tenure_score, performance_score, combined_score')
        .eq('employee_id', employeeId)
        .single(),
      supabase
        .from('score_history')
        .select('id, points, note, created_at, shift_date, score_categories(name, bucket), submitted_by_employee:employees!score_history_submitted_by_fkey(full_name)')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('employee_positions')
        .select('positions(name, cdl_required)')
        .eq('employee_id', employeeId),
    ])

    if (profileRes.data) setProfile(profileRes.data as unknown as ProfileData)
    if (scoreRes.data) setScores(scoreRes.data)
    if (historyRes.data) {
      const entries = historyRes.data as unknown as HistoryEntry[]
      setHistory(entries)

      // Build offense counts from negative entries
      const counts: Record<string, number> = {}
      entries.filter(e => e.points < 0).forEach(e => {
        const name = e.score_categories?.name ?? 'Unknown'
        counts[name] = (counts[name] ?? 0) + 1
      })
      setOffenseCounts(
        Object.entries(counts)
          .map(([category_name, count]) => ({ category_name, count }))
          .sort((a, b) => b.count - a.count)
      )
    }
    if (trainingRes.data) {
      const categoryOrder = ["Bus", "Trolley", "DAR", "Micro", "Lead"]
      const seen = new Set<string>()
      const mapped: Training[] = []
      trainingRes.data.forEach((t: any) => {
        const name: string = t.positions?.name ?? ""
        const cdl: boolean = t.positions?.cdl_required ?? false
        let category = ""
        if (name.toLowerCase().includes("bus")) category = "Bus"
        else if (name.toLowerCase().includes("trolley")) category = "Trolley"
        else if (name.toLowerCase().includes("dar")) category = "DAR"
        else if (name.toLowerCase().includes("micro")) category = "Micro"
        else if (name.toLowerCase().includes("lead")) category = "Lead"
        if (category && !seen.has(category)) {
          seen.add(category)
          mapped.push({ position: category, cdl_required: cdl })
        }
      })
      mapped.sort((a, b) => categoryOrder.indexOf(a.position) - categoryOrder.indexOf(b.position))
      setTrainings(mapped)
    }
    setLoading(false)
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2) ?? '??'

  const roleName = (profile as any)?.roles?.name ?? ''

  // Summary stats
  const positiveCount = history.filter(e => e.points > 0).length
  const negativeCount = history.filter(e => e.points < 0).length
  const totalPoints = history.reduce((sum, e) => sum + e.points, 0)

  const tabStyle = (tab: string) => ({
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: 500 as const,
    cursor: 'pointer' as const,
    border: 'none',
    background: activeTab === tab ? 'rgba(74,158,255,0.2)' : 'transparent',
    color: activeTab === tab ? '#4a9eff' : '#4a6fa5',
    transition: 'all 0.15s',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#0d1525',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '92vh',
        }}
      >
        {/* ── Header ── */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: 'rgba(74,158,255,0.15)', color: '#4a9eff' }}
            >
              {loading ? '?' : initials}
            </div>
            <div>
              {loading ? (
                <div className="text-[#4a6fa5] text-sm">Loading...</div>
              ) : (
                <>
                  <h2 className="text-white text-lg font-semibold leading-tight">
                    {profile?.full_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: `${ROLE_COLORS[roleName] ?? '#4a6fa5'}20`,
                        color: ROLE_COLORS[roleName] ?? '#4a6fa5',
                      }}
                    >
                      {roleName.replace('_', ' ')}
                    </span>
                    {profile?.hire_date && (
                      <span className="text-xs" style={{ color: '#4a6fa5' }}>
                        Hired {formatDate(profile.hire_date)} · {monthsEmployed(profile.hire_date)}
                      </span>
                    )}
                    {profile && !profile.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>
                        Inactive
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[#4a6fa5] hover:text-white text-lg flex-shrink-0">✕</button>
        </div>

        {/* ── Score cards ── */}
        {!loading && scores && (
          <div className="grid grid-cols-3 gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Tenure', value: scores.tenure_score },
              { label: 'Merit', value: scores.performance_score },
              { label: 'Combined', value: scores.combined_score },
            ].map(s => (
              <div key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xl font-bold" style={{ color: scoreColor(s.value) }}>
                  {s.value.toFixed(1)}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Quick stats ── */}
        {!loading && history.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-6 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: '#4aff9e' }}>+{positiveCount}</div>
              <div className="text-xs" style={{ color: '#4a6fa5' }}>Positive</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: '#ff6b6b' }}>{negativeCount}</div>
              <div className="text-xs" style={{ color: '#4a6fa5' }}>Violations</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold"
                style={{ color: totalPoints >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                {totalPoints >= 0 ? '+' : ''}{totalPoints.toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: '#4a6fa5' }}>Net Points</div>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="px-6 py-3 flex gap-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button style={tabStyle('history')} onClick={() => setActiveTab('history')}>
            History {history.length > 0 && `(${history.length})`}
          </button>
          <button style={tabStyle('offenses')} onClick={() => setActiveTab('offenses')}>
            Violations {offenseCounts.length > 0 && `(${offenseCounts.length})`}
          </button>
          <button style={tabStyle('training')} onClick={() => setActiveTab('training')}>
            Training {trainings.length > 0 && `(${trainings.length})`}
          </button>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-[#4a6fa5] text-sm text-center py-8">Loading...</div>
          ) : (

            <>
              {/* History tab */}
              {activeTab === 'history' && (
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-[#4a6fa5] text-sm text-center py-8">No score entries on record.</p>
                  ) : (
                    history.map(entry => {
                      const bucketColor = BUCKET_COLORS[entry.score_categories?.bucket ?? ''] ?? '#4a9eff'
                      return (
                        <div key={entry.id}
                          className="px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-sm font-bold flex-shrink-0"
                                style={{ color: entry.points >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                                {entry.points >= 0 ? '+' : ''}{entry.points}
                              </span>
                              <div className="min-w-0">
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: `${bucketColor}18`, color: bucketColor }}>
                                  {entry.score_categories?.name}
                                </span>
                                {entry.note && (
                                  <p className="text-xs mt-1 truncate" style={{ color: '#4a6fa5' }}>
                                    {entry.note}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xs" style={{ color: '#4a6fa5' }}>
                                {formatDate(entry.shift_date ?? entry.created_at)}
                              </div>
                              {entry.submitted_by_employee && (
                                <div className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>
                                  by {entry.submitted_by_employee.full_name.split(' ')[0]}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Offenses tab */}
              {activeTab === 'offenses' && (
                <div className="space-y-2">
                  {offenseCounts.length === 0 ? (
                    <p className="text-[#4a6fa5] text-sm text-center py-8">No violations on record. 🎉</p>
                  ) : (
                    offenseCounts.map(o => (
                      <div key={o.category_name}
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.12)' }}>
                        <span className="text-sm text-white">{o.category_name}</span>
                        <span className="text-sm font-bold px-3 py-1 rounded-full"
                          style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b' }}>
                          {o.count}x
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Training tab */}
              {activeTab === 'training' && (
                <div className="space-y-2">
                  {trainings.length === 0 ? (
                    <p className="text-[#4a6fa5] text-sm text-center py-8">No training records found.</p>
                  ) : (
                    trainings.map(t => (
                      <div key={t.position}
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(74,255,158,0.03)', border: '1px solid rgba(74,255,158,0.1)' }}>
                        <span className="text-sm text-white">{t.position}</span>
                        <div className="flex items-center gap-2">
                          {t.cdl_required && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(74,158,255,0.15)', color: '#4a9eff' }}>
                              CDL
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(74,255,158,0.15)', color: '#4aff9e' }}>
                            ✓ Trained
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
