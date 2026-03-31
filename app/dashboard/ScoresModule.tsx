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
  score_categories: { name: string }
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

function rankBadge(rank: number) {
  if (rank === 1) return { label: '1st', color: '#ffd700' }
  if (rank === 2) return { label: '2nd', color: '#c0c0c0' }
  if (rank === 3) return { label: '3rd', color: '#cd7f32' }
  return { label: `${rank}th`, color: '#4a6fa5' }
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
    if (data) setScores(data as ScoreRow[])
    setLoadingScores(false)
  }

  const recalculateTenure = async () => {
    setRecalculating(true)
    await supabase.rpc('recalculate_tenure_scores')
    await fetchScores()
    setRecalculating(false)
  }

  const handleApprove = async (pendingId: string) => {
    if (!currentUserId) return
    setApprovingId(pendingId)
    await supabase.rpc('approve_score_entry', { p_pending_id: pendingId, p_approved_by: currentUserId })
    setApprovingId(null)
    await Promise.all([fetchPending(), fetchScores()])
  }

  const handleDenyConfirm = async (pendingId: string) => {
    if (!currentUserId) return
    setDenyingId(pendingId)
    await supabase.rpc('deny_score_entry', { p_pending_id: pendingId, p_denied_by: currentUserId, p_denial_reason: denyReason })
    setDenyingId(null)
    setConfirmingDenyId(null)
    setDenyReason('')
    await Promise.all([fetchPending(), fetchScores()])
  }

  const fetchPending = async () => {
    setLoadingPending(true)
    const { data } = await supabase
      .from('score_pending')
      .select('id, employee_id, submitted_by, points, note, employees!score_pending_employee_id_fkey(full_name), submitter:employees!score_pending_submitted_by_fkey(full_name), score_categories(name)')
      .order('created_at', { ascending: false })
    if (data) setPending(data as PendingRow[])
    setLoadingPending(false)
  }

  return (
    <div className="space-y-8">

      {/* Pending Approvals */}
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
            <div className="space-y-2">
              {pending.map(row => (
                <div key={row.id}
                  className="px-5 py-4 rounded-2xl"
                  style={{ background: 'rgba(255,107,157,0.05)', border: '1px solid rgba(255,107,157,0.15)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium">{row.employees?.full_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(74,158,255,0.1)', color: '#4a9eff' }}>
                          {row.score_categories?.name}
                        </span>
                        <span className="text-sm font-bold"
                          style={{ color: row.points >= 0 ? '#4aff9e' : '#ff6b6b' }}>
                          {row.points >= 0 ? '+' : ''}{row.points} pts
                        </span>
                      </div>
                      {row.note && (
                        <p className="text-[#4a6fa5] text-xs mt-1 truncate">{row.note}</p>
                      )}
                      <p className="text-[#4a6fa5] text-xs mt-0.5">
                        Submitted by {row.submitter?.full_name}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(row.id)}
                          disabled={approvingId === row.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(74,255,158,0.15)', color: approvingId === row.id ? '#4a6fa5' : '#4aff9e', border: '1px solid rgba(74,255,158,0.25)' }}
                        >
                          {approvingId === row.id ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmingDenyId(confirmingDenyId === row.id ? null : row.id)
                            setDenyReason('')
                          }}
                          disabled={denyingId === row.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(255,107,107,0.15)', color: denyingId === row.id ? '#4a6fa5' : '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' }}
                        >
                          {denyingId === row.id ? 'Denying...' : 'Deny'}
                        </button>
                      </div>
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
                            style={{ background: 'rgba(255,107,107,0.25)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.4)' }}
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
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
            }}
          >
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
            {/* Column headers */}
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

                    {/* Rank */}
                    <div className="text-xs font-bold text-right" style={{ color: badge.color }}>
                      {badge.label}
                    </div>

                    {/* Name + role */}
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

                    {/* Tenure score */}
                    <div className="text-sm font-medium text-center" style={{ color: scoreColor(row.tenure_score) }}>
                      {row.tenure_score.toFixed(1)}
                    </div>

                    {/* Performance score */}
                    <div className="text-sm font-medium text-center" style={{ color: scoreColor(row.performance_score) }}>
                      {row.performance_score.toFixed(1)}
                    </div>

                    {/* Combined score */}
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
