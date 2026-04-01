'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type ScoreRow = {
  id: string
  employee_id: string
  tenure_score: number
  performance_score: number
  combined_score: number
  employees: {
    full_name: string
    hire_date: string
    roles: { name: string }
  }
}

type PendingRow = {
  id: string
  employee_id: string
  submitted_by: string
  points: number
  note: string | null
  employees: { full_name: string }
  submitter: { full_name: string }
  score_categories: { name: string; bucket: string }
  category_id: string
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

const ROLE_COLORS: Record<string, string> = {
  supervisor: '#ffa94a',
  lead: '#4a9eff',
  assistant_supervisor: '#c084fc',
  driver: '#4aff9e',
}

const BUCKET_COLORS: Record<string, string> = {
  positive: '#4aff9e',
  conduct: '#ff6b6b',
  service: '#ffa94a',
  compliance: '#c084fc',
  vehicle: '#4a9eff',
}

function scoreColor(score: number) {
  if (score >= 80) return '#4aff9e'
  if (score >= 60) return '#4a9eff'
  if (score >= 40) return '#ffa94a'
  return '#ff6b6b'
}

function rankBadge(rank: number) {
  if (rank === 1) return { label: '1st', color: '#ffd700' }
  if (rank === 2) return { label: '2nd', color: '#c0c0c0' }
  if (rank === 3) return { label: '3rd', color: '#cd7f32' }
  return { label: `${rank}th`, color: '#4a6fa5' }
}

// Per-card edit state
type EditState = {
  open: boolean
  adjustedPoints: number
  adjustmentNote: string
  history: HistoryEntry[]
  offenseCounts: OffenseCount[]
  loadingHistory: boolean
}

export default function ScoresModule() {
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [pending, setPending] = useState<PendingRow[]>([])
  const [loadingScores, setLoadingScores] = useState(true)
  const [loadingPending, setLoadingPending] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [confirmingDenyId, setConfirmingDenyId] = useState<string | null>(null)

  // Edit state keyed by pending row id
  const [editStates, setEditStates] = useState<Record<string, EditState>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUserId(session.user.id)
    })
    fetchScores()
    fetchPending()
  }, [])

  const fetchScores = async () => {
    setLoadingScores(true)
    const { data } = await supabase
      .from('scores')
      .select('id, employee_id, tenure_score, performance_score, combined_score, employees(full_name, hire_date, roles(name))')
      .order('combined_score', { ascending: false })
    if (data) setScores(data as unknown as ScoreRow[])
    setLoadingScores(false)
  }

  const recalculateTenure = async () => {
    setRecalculating(true)
    await supabase.rpc('recalculate_tenure_scores')
    await fetchScores()
    setRecalculating(false)
  }

  const fetchPending = async () => {
    setLoadingPending(true)
    const { data } = await supabase
      .from('score_pending')
      .select('id, employee_id, submitted_by, points, note, category_id, employees!score_pending_employee_id_fkey(full_name), submitter:employees!score_pending_submitted_by_fkey(full_name), score_categories(name, bucket)')
      .order('submitted_at', { ascending: false })
    if (data) setPending(data as unknown as PendingRow[])
    setLoadingPending(false)
  }

  // Toggle edit panel open/closed for a card
  const toggleEdit = async (row: PendingRow) => {
    const existing = editStates[row.id]

    // Close if already open
    if (existing?.open) {
      setEditStates(prev => ({ ...prev, [row.id]: { ...prev[row.id], open: false } }))
      return
    }

    // Open — initialize state and load history
    setEditStates(prev => ({
      ...prev,
      [row.id]: {
        open: true,
        adjustedPoints: row.points,
        adjustmentNote: '',
        history: existing?.history ?? [],
        offenseCounts: existing?.offenseCounts ?? [],
        loadingHistory: !existing?.history?.length,
      }
    }))

    // Only fetch if we haven't already
    if (existing?.history?.length) return

    const [histRes, offenseRes] = await Promise.all([
      supabase
        .from('score_pending')
        .select('id, points, note, created_at, score_categories(name, bucket)')
        .eq('employee_id', row.employee_id)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('score_pending')
        .select('category_id, score_categories(name)')
        .eq('employee_id', row.employee_id)
        .eq('category_id', row.category_id)
        .lt('points', 0),
    ])

    const history: HistoryEntry[] = (histRes.data ?? []) as unknown as HistoryEntry[]
    // Exclude the current pending row from history display
    const filteredHistory = history.filter(h => h.id !== row.id).slice(0, 5)

    const counts: Record<string, { name: string; count: number }> = {}
    ;(offenseRes.data ?? []).forEach((r: any) => {
      const id = r.category_id
      if (!counts[id]) counts[id] = { name: r.score_categories?.name ?? '', count: 0 }
      counts[id].count++
    })
    const offenseCounts: OffenseCount[] = Object.entries(counts).map(([category_id, v]) => ({
      category_id,
      category_name: v.name,
      count: v.count,
    }))

    setEditStates(prev => ({
      ...prev,
      [row.id]: {
        ...prev[row.id],
        history: filteredHistory,
        offenseCounts,
        loadingHistory: false,
      }
    }))
  }

  const updateEditField = (id: string, field: keyof EditState, value: any) => {
    setEditStates(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleApprove = async (row: PendingRow) => {
    if (!currentUserId) return
    const edit = editStates[row.id]
    const adjustedPoints = edit?.open ? edit.adjustedPoints : row.points
    const pointsChanged = adjustedPoints !== row.points
    const adjustmentNote = edit?.adjustmentNote?.trim() ?? ''

    // If points were changed, require an adjustment note
    if (pointsChanged && !adjustmentNote) {
      setEditStates(prev => ({
        ...prev,
        [row.id]: { ...prev[row.id], adjustmentNote: '' }
      }))
      alert('Please add a note explaining why the points were adjusted.')
      return
    }

    setApprovingId(row.id)

    // If points were adjusted, log the change in score_structure_log first
    if (pointsChanged) {
      await supabase.from('score_structure_log').insert({
        changed_by: currentUserId,
        change_type: 'points_adjusted_on_approval',
        details: JSON.stringify({
          pending_id: row.id,
          employee_id: row.employee_id,
          category: row.score_categories?.name,
          original_points: row.points,
          adjusted_points: adjustedPoints,
          adjustment_note: adjustmentNote,
        }),
      })

      // Update the pending row's points before approving
      await supabase
        .from('score_pending')
        .update({ points: adjustedPoints })
        .eq('id', row.id)
    }

    await supabase.rpc('approve_score_entry', {
      p_pending_id: row.id,
      p_approved_by: currentUserId,
    })

    setApprovingId(null)
    // Clean up edit state for this card
    setEditStates(prev => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    await fetchPending()
    await new Promise(r => setTimeout(r, 500))
    await fetchScores()
  }

  const handleDenyConfirm = async (pendingId: string) => {
    if (!currentUserId) return
    setDenyingId(pendingId)
    await supabase.rpc('deny_score_entry', {
      p_pending_id: pendingId,
      p_denied_by: currentUserId,
      p_denial_reason: denyReason,
    })
    setDenyingId(null)
    setConfirmingDenyId(null)
    setDenyReason('')
    await fetchPending()
    await new Promise(r => setTimeout(r, 500))
    await fetchScores()
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
  }

  return (
    <div className="space-y-8">

      {/* ── Pending Approvals ── */}
      {(loadingPending || pending.length > 0) && (
        <div>
          <h2 className="text-white text-sm font-semibold uppercase tracking-wider mb-3">
            Pending Approvals
            {!loadingPending && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(255,107,157,0.2)', color: '#ff6b9d' }}>
                {pending.length}
              </span>
            )}
          </h2>

          {loadingPending ? (
            <div className="text-[#4a6fa5] text-sm">Loading...</div>
          ) : (
            <div className="space-y-3">
              {pending.map(row => {
                const edit = editStates[row.id]
                const isEditOpen = edit?.open ?? false
                const adjustedPoints = isEditOpen ? edit.adjustedPoints : row.points
                const pointsChanged = isEditOpen && edit.adjustedPoints !== row.points
                const bucketColor = BUCKET_COLORS[row.score_categories?.bucket ?? ''] ?? '#4a9eff'

                return (
                  <div key={row.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(255,107,157,0.05)',
                      border: `1px solid ${isEditOpen ? 'rgba(255,107,157,0.3)' : 'rgba(255,107,157,0.15)'}`,
                      transition: 'border-color 0.2s',
                    }}>

                    {/* ── Card header row ── */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">{row.employees?.full_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${bucketColor}18`, color: bucketColor }}>
                              {row.score_categories?.name}
                            </span>
                            <span className="text-sm font-bold"
                              style={{ color: adjustedPoints >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                              {adjustedPoints >= 0 ? '+' : ''}{adjustedPoints} pts
                              {pointsChanged && (
                                <span className="ml-1 text-xs font-normal"
                                  style={{ color: '#ffa94a' }}>
                                  (was {row.points >= 0 ? '+' : ''}{row.points})
                                </span>
                              )}
                            </span>
                          </div>
                          {row.note && (
                            <p className="text-[#4a6fa5] text-xs mt-1 truncate">{row.note}</p>
                          )}
                          <p className="text-[#4a6fa5] text-xs mt-0.5">
                            Submitted by {row.submitter?.full_name}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                          <div className="flex gap-2">
                            {/* Edit toggle */}
                            <button
                              onClick={() => toggleEdit(row)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{
                                background: isEditOpen ? 'rgba(255,169,74,0.25)' : 'rgba(255,169,74,0.1)',
                                color: '#ffa94a',
                                border: `1px solid ${isEditOpen ? 'rgba(255,169,74,0.5)' : 'rgba(255,169,74,0.25)'}`,
                              }}>
                              {isEditOpen ? 'Cancel Edit' : 'Edit Points'}
                            </button>
                            <button
                              onClick={() => handleApprove(row)}
                              disabled={approvingId === row.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{
                                background: 'rgba(74,255,158,0.15)',
                                color: approvingId === row.id ? '#4a6fa5' : '#4aff9e',
                                border: '1px solid rgba(74,255,158,0.25)',
                              }}>
                              {approvingId === row.id ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                setConfirmingDenyId(confirmingDenyId === row.id ? null : row.id)
                                setDenyReason('')
                              }}
                              disabled={denyingId === row.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{
                                background: 'rgba(255,107,107,0.15)',
                                color: denyingId === row.id ? '#4a6fa5' : '#ff6b6b',
                                border: '1px solid rgba(255,107,107,0.25)',
                              }}>
                              {denyingId === row.id ? 'Denying...' : 'Deny'}
                            </button>
                          </div>

                          {/* Deny confirm */}
                          {confirmingDenyId === row.id && (
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={denyReason}
                                onChange={e => setDenyReason(e.target.value)}
                                placeholder="Reason (optional)"
                                className="px-3 py-1.5 rounded-lg text-xs text-white outline-none w-44"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#ff6b6b' }}
                                onKeyDown={e => { if (e.key === 'Enter') handleDenyConfirm(row.id) }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleDenyConfirm(row.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{ background: 'rgba(255,107,107,0.25)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.4)' }}>
                                Confirm
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Edit panel (expandable) ── */}
                    {isEditOpen && (
                      <div className="px-5 pb-5 space-y-4"
                        style={{ borderTop: '1px solid rgba(255,169,74,0.15)' }}>

                        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">

                          {/* Left: points adjuster + adjustment note */}
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs uppercase tracking-wider mb-2"
                                style={{ color: '#ffa94a' }}>
                                Adjust Points
                              </label>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => updateEditField(row.id, 'adjustedPoints', edit.adjustedPoints - 0.25)}
                                  className="w-9 h-9 rounded-xl text-lg font-bold flex-shrink-0"
                                  style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' }}>
                                  −
                                </button>
                                <input
                                  type="number"
                                  value={edit.adjustedPoints}
                                  onChange={e => updateEditField(row.id, 'adjustedPoints', Number(e.target.value))}
                                  step="0.25"
                                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none text-center font-bold"
                                  style={{
                                    ...inputStyle,
                                    color: edit.adjustedPoints > 0 ? '#4aff9e' : edit.adjustedPoints < 0 ? '#ff6b6b' : '#fff',
                                    caretColor: '#4a9eff',
                                  }}
                                />
                                <button
                                  onClick={() => updateEditField(row.id, 'adjustedPoints', edit.adjustedPoints + 0.25)}
                                  className="w-9 h-9 rounded-xl text-lg font-bold flex-shrink-0"
                                  style={{ background: 'rgba(74,255,158,0.15)', color: '#4aff9e', border: '1px solid rgba(74,255,158,0.25)' }}>
                                  +
                                </button>
                              </div>
                              <p className="text-xs mt-1.5" style={{ color: '#4a6fa5' }}>
                                Originally submitted: <span style={{ color: row.points >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                                  {row.points >= 0 ? '+' : ''}{row.points} pts
                                </span>
                              </p>
                            </div>

                            {/* Adjustment note — required if points changed */}
                            <div>
                              <label className="block text-xs uppercase tracking-wider mb-1.5"
                                style={{ color: pointsChanged ? '#ffa94a' : '#4a6fa5' }}>
                                Adjustment Note {pointsChanged && <span style={{ color: '#ff6b6b' }}>*</span>}
                              </label>
                              <textarea
                                value={edit.adjustmentNote}
                                onChange={e => updateEditField(row.id, 'adjustmentNote', e.target.value)}
                                placeholder={pointsChanged ? 'Required — explain why points were changed...' : 'Optional note about adjustment...'}
                                rows={3}
                                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                                style={{
                                  ...inputStyle,
                                  caretColor: '#4a9eff',
                                  borderColor: pointsChanged && !edit.adjustmentNote
                                    ? 'rgba(255,107,107,0.4)'
                                    : 'rgba(255,255,255,0.1)',
                                }}
                              />
                            </div>

                            {/* Reset to original */}
                            {pointsChanged && (
                              <button
                                onClick={() => updateEditField(row.id, 'adjustedPoints', row.points)}
                                className="text-xs px-3 py-1.5 rounded-lg"
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5', border: '1px solid rgba(255,255,255,0.08)' }}>
                                ↩ Reset to original ({row.points >= 0 ? '+' : ''}{row.points})
                              </button>
                            )}
                          </div>

                          {/* Right: driver history for this employee */}
                          <div className="rounded-xl p-4 space-y-3"
                            style={{ background: 'rgba(74,111,165,0.08)', border: '1px solid rgba(74,111,165,0.15)' }}>
                            <p className="text-xs uppercase tracking-wider font-medium" style={{ color: '#4a6fa5' }}>
                              {row.employees?.full_name} — Recent History
                            </p>

                            {edit.loadingHistory ? (
                              <p className="text-xs" style={{ color: '#4a6fa5' }}>Loading...</p>
                            ) : edit.history.length === 0 ? (
                              <p className="text-xs" style={{ color: '#4a6fa5' }}>No prior entries.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {edit.history.map(entry => {
                                  const entryBucketColor = BUCKET_COLORS[entry.score_categories?.bucket ?? ''] ?? '#4a9eff'
                                  return (
                                    <div key={entry.id} className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs font-bold flex-shrink-0"
                                          style={{ color: entry.points >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                                          {entry.points >= 0 ? '+' : ''}{entry.points}
                                        </span>
                                        <span className="text-xs truncate" style={{ color: entryBucketColor }}>
                                          {entry.score_categories?.name}
                                        </span>
                                      </div>
                                      <span className="text-xs flex-shrink-0" style={{ color: '#4a6fa5' }}>
                                        {new Date(entry.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Offense count for this specific category */}
                            {edit.offenseCounts.length > 0 && (
                              <div className="pt-2" style={{ borderTop: '1px solid rgba(74,111,165,0.2)' }}>
                                <p className="text-xs mb-1.5" style={{ color: '#4a6fa5' }}>
                                  Offenses — this category:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {edit.offenseCounts.map(o => (
                                    <span key={o.category_id}
                                      className="text-xs px-2 py-0.5 rounded-full"
                                      style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.2)' }}>
                                      {o.category_name}: {o.count}x prior
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-sm font-semibold uppercase tracking-wider">Leaderboard</h2>
          <button
            onClick={recalculateTenure}
            disabled={recalculating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: recalculating ? 'rgba(74,158,255,0.1)' : 'rgba(74,158,255,0.15)',
              color: recalculating ? '#4a6fa5' : '#4a9eff',
              border: '1px solid rgba(74,158,255,0.25)',
            }}>
            {recalculating ? 'Recalculating...' : 'Recalculate Tenure'}
          </button>
        </div>

        {loadingScores ? (
          <div className="text-[#4a6fa5] text-sm">Loading...</div>
        ) : scores.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#4a6fa5] text-sm">No score records found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[2rem_1fr_5rem_6rem_5rem] gap-4 px-5 mb-2 items-center">
              <div />
              <div className="text-[#4a6fa5] text-xs uppercase tracking-wider">Employee</div>
              <div className="text-[#4a6fa5] text-xs uppercase tracking-wider text-center">Tenure</div>
              <div className="text-[#4a6fa5] text-xs uppercase tracking-wider text-center">Performance</div>
              <div className="text-[#4a6fa5] text-xs uppercase tracking-wider text-center">Combined</div>
            </div>

            <div className="space-y-2">
              {scores.map((row, i) => {
                const badge = rankBadge(i + 1)
                const roleName = row.employees?.roles?.name ?? ''
                return (
                  <div key={row.id}
                    className="grid grid-cols-[2rem_1fr_5rem_6rem_5rem] gap-4 px-5 py-4 rounded-2xl items-center"
                    style={{
                      background: i < 3 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                      border: i < 3 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
                    }}>
                    <div className="text-xs font-bold text-right" style={{ color: badge.color }}>
                      {badge.label}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'rgba(74,158,255,0.12)', color: '#4a9eff' }}>
                        {row.employees?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate">{row.employees?.full_name}</div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            background: `${ROLE_COLORS[roleName] ?? '#4a6fa5'}20`,
                            color: ROLE_COLORS[roleName] ?? '#4a6fa5',
                          }}>
                          {roleName.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-center" style={{ color: scoreColor(row.tenure_score) }}>
                      {row.tenure_score.toFixed(1)}
                    </div>
                    <div className="text-sm font-medium text-center" style={{ color: scoreColor(row.performance_score) }}>
                      {row.performance_score.toFixed(1)}
                    </div>
                    <div className="text-sm font-bold text-center" style={{ color: scoreColor(row.combined_score) }}>
                      {row.combined_score.toFixed(1)}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
