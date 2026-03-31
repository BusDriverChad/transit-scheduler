'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Employee = {
  id: string
  full_name: string
}

type ScoreCategory = {
  id: string
  name: string
  bucket: string
  direction: 'positive' | 'negative'
  default_points: number
  cap_points: number | null
  is_auto_generated: boolean
}

type HistoryEntry = {
  id: string
  points: number
  note: string | null
  created_at: string
  score_categories: { name: string; bucket: string }
}

type OffenseCount = {
  category_id: string
  category_name: string
  count: number
}

const today = () => new Date().toISOString().slice(0, 10)

const BUCKETS = [
  { key: 'positive', label: 'Positive' },
  { key: 'conduct', label: 'Conduct' },
  { key: 'service', label: 'Service' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'vehicle', label: 'Vehicle' },
]

const BUCKET_COLORS: Record<string, string> = {
  positive: '#4aff9e',
  conduct: '#ff6b6b',
  service: '#ffa94a',
  compliance: '#c084fc',
  vehicle: '#4a9eff',
}

function getEscalatedPoints(
  basePoints: number,
  capPoints: number | null,
  offenseCount: number
): number {
  if (basePoints >= 0) return basePoints
  const escalations = [1, 2, 3, 4, 5]
  const multipliers = [1, 2, 3, 4, 4]
  const idx = Math.min(offenseCount, escalations.length - 1)
  const escalated = basePoints * multipliers[idx]
  if (capPoints !== null) return Math.max(escalated, capPoints)
  return escalated
}

export default function ScoreEntryModule({ onClose }: { onClose: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<ScoreCategory[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [employeeId, setEmployeeId] = useState('')
  const [selectedBucket, setSelectedBucket] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [points, setPoints] = useState<number>(0)
  const [note, setNote] = useState('')
  const [shiftDate, setShiftDate] = useState(today())
  const [informed, setInformed] = useState(false)

  const [driverHistory, setDriverHistory] = useState<HistoryEntry[]>([])
  const [offenseCounts, setOffenseCounts] = useState<OffenseCount[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUserId(session.user.id)
    })
    Promise.all([
      supabase
        .from('employees')
        .select('id, full_name')
        .eq('is_active', true)
        .eq('is_test_profile', false)
        .order('full_name'),
      supabase
        .from('score_categories')
        .select('id, name, bucket, direction, default_points, cap_points, is_auto_generated')
        .eq('is_auto_generated', false)
        .eq('is_active', true)
        .order('name'),
    ]).then(([empRes, catRes]) => {
      if (empRes.data) setEmployees(empRes.data as Employee[])
      if (catRes.data) setCategories(catRes.data as unknown as ScoreCategory[])
      setLoading(false)
    })
  }, [])

  // Load driver history when employee selected
  useEffect(() => {
    if (!employeeId) {
      setDriverHistory([])
      setOffenseCounts([])
      return
    }
    setLoadingHistory(true)
    Promise.all([
      supabase
        .from('score_pending')
        .select('id, points, note, created_at, score_categories(name, bucket)')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('score_pending')
        .select('category_id, score_categories(name)')
        .eq('employee_id', employeeId)
        .lt('points', 0),
    ]).then(([histRes, offenseRes]) => {
      if (histRes.data) setDriverHistory(histRes.data as unknown as HistoryEntry[])
      if (offenseRes.data) {
        const counts: Record<string, { name: string; count: number }> = {}
        offenseRes.data.forEach((row: any) => {
          const id = row.category_id
          if (!counts[id]) counts[id] = { name: row.score_categories?.name ?? '', count: 0 }
          counts[id].count++
        })
        setOffenseCounts(
          Object.entries(counts).map(([category_id, v]) => ({
            category_id,
            category_name: v.name,
            count: v.count,
          }))
        )
      }
      setLoadingHistory(false)
    })
  }, [employeeId])

  const handleBucketChange = (bucket: string) => {
    setSelectedBucket(bucket)
    setCategoryId('')
    setPoints(0)
  }

  const handleCategoryChange = (id: string) => {
    setCategoryId(id)
    const cat = categories.find(c => c.id === id)
    if (!cat) return
    const offense = offenseCounts.find(o => o.category_id === id)
    const offenseNum = offense ? offense.count : 0
    const suggested = getEscalatedPoints(cat.default_points, cat.cap_points, offenseNum)
    setPoints(suggested)
  }

  const handleSubmit = async () => {
    setError('')
    if (!employeeId) { setError('Select an employee.'); return }
    if (!categoryId) { setError('Select a category.'); return }
    if (!note.trim()) { setError('Note is required.'); return }
    if (!currentUserId) { setError('Not authenticated.'); return }

    setSubmitting(true)
    const { error: insertError } = await supabase
      .from('score_pending')
      .insert({
        employee_id: employeeId,
        submitted_by: currentUserId,
        category_id: categoryId,
        points,
        note: note.trim(),
        shift_date: shiftDate || null,
      })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
  }

  const handleReset = () => {
    setEmployeeId('')
    setSelectedBucket('')
    setCategoryId('')
    setPoints(0)
    setNote('')
    setShiftDate(today())
    setInformed(false)
    setError('')
    setSuccess(false)
    setDriverHistory([])
    setOffenseCounts([])
  }

  const bucketCategories = categories.filter(c => c.bucket === selectedBucket)
  const selectedCat = categories.find(c => c.id === categoryId)
  const selectedEmployee = employees.find(e => e.id === employeeId)
  const currentOffense = selectedCat
    ? offenseCounts.find(o => o.category_id === categoryId)
    : null
  const offenseNum = currentOffense ? currentOffense.count : 0

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
  }

  const selectStyle = {
    background: '#0d1525',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">Log Score Entry</h2>
            <p className="text-[#4a6fa5] text-xs mt-0.5">Submit for supervisor review</p>
          </div>
          <button onClick={onClose} className="text-[#4a6fa5] hover:text-white text-lg">✕</button>
        </div>

        {success ? (
          <div className="space-y-5">
            <div className="py-8 text-center">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-white font-medium mb-1">Entry submitted</p>
              <p className="text-[#4a6fa5] text-sm">It will appear in Pending Approvals for review.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset}
                className="flex-1 py-3 rounded-xl text-white text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}>
                Log Another
              </button>
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}>
                Close
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="text-[#4a6fa5] text-sm py-8 text-center">Loading...</div>
        ) : (
          <div className="space-y-4">

            {/* Employee */}
            <div>
              <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Employee *</label>
              <select
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={selectStyle}>
                <option value="">Select employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>

            {/* Driver history panel */}
            {employeeId && (
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(74,111,165,0.08)', border: '1px solid rgba(74,111,165,0.2)' }}>
                <p className="text-xs text-[#4a6fa5] uppercase tracking-wider font-medium">
                  {selectedEmployee?.full_name} — Recent History
                </p>
                {loadingHistory ? (
                  <p className="text-[#4a6fa5] text-xs">Loading...</p>
                ) : driverHistory.length === 0 ? (
                  <p className="text-[#4a6fa5] text-xs">No entries on record.</p>
                ) : (
                  <div className="space-y-1.5">
                    {driverHistory.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold flex-shrink-0"
                            style={{ color: entry.points >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                            {entry.points >= 0 ? '+' : ''}{entry.points}
                          </span>
                          <span className="text-xs text-white truncate">
                            {entry.score_categories?.name}
                          </span>
                        </div>
                        <span className="text-xs text-[#4a6fa5] flex-shrink-0">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Offense counts */}
                {offenseCounts.length > 0 && (
                  <div className="pt-2 border-t border-[rgba(74,111,165,0.2)]">
                    <p className="text-xs text-[#4a6fa5] mb-1.5">Violation history:</p>
                    <div className="flex flex-wrap gap-2">
                      {offenseCounts.map(o => (
                        <span key={o.category_id}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.2)' }}>
                          {o.category_name}: {o.count}x
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bucket selector */}
            <div>
              <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Category Type *</label>
              <div className="grid grid-cols-5 gap-1.5">
                {BUCKETS.map(b => (
                  <button key={b.key}
                    onClick={() => handleBucketChange(b.key)}
                    className="py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: selectedBucket === b.key
                        ? `${BUCKET_COLORS[b.key]}25`
                        : 'rgba(255,255,255,0.04)',
                      border: selectedBucket === b.key
                        ? `1px solid ${BUCKET_COLORS[b.key]}60`
                        : '1px solid rgba(255,255,255,0.08)',
                      color: selectedBucket === b.key
                        ? BUCKET_COLORS[b.key]
                        : '#4a6fa5',
                    }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category within bucket */}
            {selectedBucket && (
              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Specific Category *</label>
                <select
                  value={categoryId}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={selectStyle}>
                  <option value="">Select category...</option>
                  {bucketCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Offense warning */}
            {categoryId && selectedCat && selectedCat.direction === 'negative' && offenseNum > 0 && (
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#ff6b6b' }}>
                ⚠ This is offense #{offenseNum + 1} for {selectedCat.name}.
                Points auto-escalated to {points}. You can adjust below.
              </div>
            )}

            {/* Points adjuster */}
            {categoryId && (
              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">
                  Points
                  {selectedCat && (
                    <span className="ml-2 normal-case text-[#4a6fa5]">
                      (default: {selectedCat.default_points > 0 ? '+' : ''}{selectedCat.default_points}
                      {selectedCat.cap_points !== null ? `, cap: ${selectedCat.cap_points}` : ''})
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPoints(p => p - 1)}
                    className="w-9 h-9 rounded-xl text-lg font-bold flex-shrink-0"
                    style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' }}>
                    −
                  </button>
                  <input
                    type="number"
                    value={points}
                    onChange={e => setPoints(Number(e.target.value))}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none text-center font-bold"
                    style={{
                      ...inputStyle,
                      color: points > 0 ? '#4aff9e' : points < 0 ? '#ff6b6b' : '#fff',
                      caretColor: '#4a9eff',
                    }}
                  />
                  <button onClick={() => setPoints(p => p + 1)}
                    className="w-9 h-9 rounded-xl text-lg font-bold flex-shrink-0"
                    style={{ background: 'rgba(74,255,158,0.15)', color: '#4aff9e', border: '1px solid rgba(74,255,158,0.25)' }}>
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Note *</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Describe the incident or commendation..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ ...inputStyle, caretColor: '#4a9eff' }}
              />
            </div>

            {/* Shift date */}
            <div>
              <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Shift Date</label>
              <input
                type="date"
                value={shiftDate}
                onChange={e => setShiftDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>

            {/* Informed checkbox */}
            <label className="flex items-center gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={informed}
                onChange={e => setInformed(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm" style={{ color: informed ? '#fff' : '#4a6fa5' }}>
                Driver has been informed
              </span>
            </label>

            {/* Error */}
            {error && (
              <div className="text-red-400 text-sm py-2 px-4 rounded-lg"
                style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-white text-sm font-medium"
                style={{
                  background: submitting
                    ? 'rgba(74,158,255,0.4)'
                    : 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)',
                }}>
                {submitting ? 'Submitting...' : 'Submit Entry'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}