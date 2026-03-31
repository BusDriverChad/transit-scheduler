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
  direction: 'positive' | 'negative'
  default_points: number
  is_auto_generated: boolean
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ScoreEntryModule({ onClose }: { onClose: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<ScoreCategory[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [employeeId, setEmployeeId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [points, setPoints] = useState<number>(0)
  const [note, setNote] = useState('')
  const [shiftDate, setShiftDate] = useState(today())
  const [informed, setInformed] = useState(false)

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
        .select('id, name, direction, default_points, is_auto_generated')
        .eq('is_auto_generated', false)
        .eq('is_active', true)
        .order('direction')
        .order('name'),
    ]).then(([empRes, catRes]) => {
      if (empRes.data) setEmployees(empRes.data as Employee[])
      if (catRes.data) setCategories(catRes.data as ScoreCategory[])
      setLoading(false)
    })
  }, [])

  // When category changes, reset points to that category's default
  const handleCategoryChange = (id: string) => {
    setCategoryId(id)
    const cat = categories.find(c => c.id === id)
    if (cat) setPoints(cat.default_points)
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
    setCategoryId('')
    setPoints(0)
    setNote('')
    setShiftDate(today())
    setInformed(false)
    setError('')
    setSuccess(false)
  }

  const positiveCategories = categories.filter(c => c.direction === 'positive' && !c.is_auto_generated)
  const negativeCategories = categories.filter(c => c.direction === 'negative' && !c.is_auto_generated)
  const selectedCat = categories.find(c => c.id === categoryId)

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
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl text-white text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
              >
                Log Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
              >
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
                style={selectStyle}
              >
                <option value="">Select employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Category *</label>
              <select
                value={categoryId}
                onChange={e => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={selectStyle}
              >
                <option value="">Select category...</option>
                {positiveCategories.length > 0 && (
                  <optgroup label="Positive">
                    {positiveCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (+{c.default_points})</option>
                    ))}
                  </optgroup>
                )}
                {negativeCategories.length > 0 && (
                  <optgroup label="Negative">
                    {negativeCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.default_points})</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Points adjuster */}
            {categoryId && (
              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">
                  Points
                  {selectedCat && (
                    <span className="ml-2 normal-case" style={{ color: '#4a6fa5' }}>
                      (default: {selectedCat.default_points > 0 ? '+' : ''}{selectedCat.default_points})
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPoints(p => p - 1)}
                    className="w-9 h-9 rounded-xl text-lg font-bold flex-shrink-0"
                    style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' }}
                  >
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
                  <button
                    onClick={() => setPoints(p => p + 1)}
                    className="w-9 h-9 rounded-xl text-lg font-bold flex-shrink-0"
                    style={{ background: 'rgba(74,255,158,0.15)', color: '#4aff9e', border: '1px solid rgba(74,255,158,0.25)' }}
                  >
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
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
              >
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
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Entry'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
