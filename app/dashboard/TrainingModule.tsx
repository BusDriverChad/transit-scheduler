'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Employee = {
  id: string
  full_name: string
  roles: { name: string }
}

type Position = {
  id: string
  name: string
  cdl_required: boolean
}

type EmployeePosition = {
  employee_id: string
  position_id: string
  certified: boolean
}

type Exemption = {
  employee_id: string
  position_id: string
  exemption_type: string
  snooze_until: string | null
  reversed: boolean
}

type CellStatus = 'certified' | 'trained' | 'permanent_exempt' | 'snoozed' | 'none'

// The 5 fixed training categories and the keyword used to match position names
const CATEGORIES = [
  { key: 'DAR',     label: 'DAR',     keyword: 'DAR' },
  { key: 'Bus',     label: 'Bus',     keyword: 'Bus' },
  { key: 'Trolley', label: 'Trolley', keyword: 'Trolley' },
  { key: 'Micro',   label: 'Micro',   keyword: 'Micro' },
  { key: 'Lead',    label: 'Lead',    keyword: 'Lead' },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

function cellStyle(status: CellStatus): React.CSSProperties {
  switch (status) {
    case 'certified':
      return { background: 'rgba(74,255,158,0.15)', color: '#4aff9e', border: '1px solid rgba(74,255,158,0.3)' }
    case 'trained':
      return { background: 'rgba(255,214,74,0.15)', color: '#ffd64a', border: '1px solid rgba(255,214,74,0.3)' }
    case 'permanent_exempt':
      return { background: 'rgba(255,255,255,0.05)', color: '#4a6fa5', border: '1px solid rgba(255,255,255,0.08)' }
    case 'snoozed':
      return { background: 'rgba(74,158,255,0.12)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.25)' }
    default:
      return { background: 'transparent', color: '#2a3a55', border: '1px solid rgba(255,255,255,0.04)' }
  }
}

function cellLabel(status: CellStatus): string {
  switch (status) {
    case 'certified':        return '✓'
    case 'trained':          return '~'
    case 'permanent_exempt': return '—'
    case 'snoozed':          return '⏸'
    default:                 return '·'
  }
}

const ROLE_COLORS: Record<string, string> = {
  supervisor: '#ffa94a',
  lead: '#4a9eff',
  assistant_supervisor: '#c084fc',
  driver: '#4aff9e',
}

export default function TrainingModule() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [empPositions, setEmpPositions] = useState<EmployeePosition[]>([])
  const [exemptions, setExemptions] = useState<Exemption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [markingKey, setMarkingKey] = useState<string | null>(null)
  const [certifyingKey, setCertifyingKey] = useState<string | null>(null)
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [empRes, posRes, epRes, exRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, roles(name)')
        .eq('is_active', true)
        .eq('is_test_profile', false)
        .order('full_name'),
      supabase
        .from('positions')
        .select('id, name, cdl_required')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('employee_positions')
        .select('employee_id, position_id, certified')
        .limit(10000),
      supabase
        .from('position_exemptions')
        .select('employee_id, position_id, exemption_type, snooze_until, reversed')
        .limit(10000),
    ])
    if (empRes.data) setEmployees(empRes.data as unknown as Employee[])
    if (posRes.data) {
      setPositions(posRes.data as Position[])
      console.log('positions:', posRes.data)
      console.log('Bus matches:', posRes.data.filter((p: Position) => p.name.toLowerCase().includes('bus')))
    }
    if (epRes.data) setEmpPositions(epRes.data as EmployeePosition[])
    if (exRes.data) setExemptions(exRes.data as Exemption[])
    setLoading(false)
  }

  // Returns all positions belonging to a category
  const positionsForCategory = (key: CategoryKey): Position[] => {
    const keyword = CATEGORIES.find(c => c.key === key)?.keyword ?? key
    return positions.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()))
  }

  // Representative position for Mark Trained — first alphabetically in the category
  const representativePosition = (key: CategoryKey): Position | null =>
    positionsForCategory(key)[0] ?? null

  // Category status for an employee: best status across all positions in the category
  const getCategoryStatus = (employeeId: string, key: CategoryKey): CellStatus => {
    const catPositions = positionsForCategory(key)
    if (catPositions.length === 0) return 'none'

    const positionIds = new Set(catPositions.map(p => p.id))

    // Check employee_positions — certified beats trained
    let hasTrained = false
    for (const ep of empPositions) {
      if (ep.employee_id !== employeeId || !positionIds.has(ep.position_id)) continue
      if (ep.certified) return 'certified'
      hasTrained = true
    }
    if (hasTrained) return 'trained'

    // Check exemptions — snooze beats permanent
    let hasPermanent = false
    for (const ex of exemptions) {
      if (ex.employee_id !== employeeId || !positionIds.has(ex.position_id) || ex.reversed) continue
      if (ex.exemption_type === 'snooze' && ex.snooze_until) {
        if (new Date(ex.snooze_until) > new Date()) return 'snoozed'
      } else {
        hasPermanent = true
      }
    }
    if (hasPermanent) return 'permanent_exempt'

    return 'none'
  }

  const handleMarkCertified = async (emp: Employee, categoryKey: CategoryKey) => {
    const rep = representativePosition(categoryKey)
    if (!rep) return
    setCertifyingKey(categoryKey)
    await supabase
      .from('employee_positions')
      .update({ certified: true })
      .eq('employee_id', emp.id)
      .eq('position_id', rep.id)
    const { data } = await supabase
      .from('employee_positions')
      .select('employee_id, position_id, certified')
      .limit(10000)
    if (data) setEmpPositions(data as EmployeePosition[])
    setCertifyingKey(null)
  }

  const handleRemove = async (emp: Employee, categoryKey: CategoryKey) => {
    const rep = representativePosition(categoryKey)
    if (!rep) return
    setRemoving(true)
    await supabase
      .from('employee_positions')
      .delete()
      .eq('employee_id', emp.id)
      .eq('position_id', rep.id)
    const { data } = await supabase
      .from('employee_positions')
      .select('employee_id, position_id, certified')
      .limit(10000)
    if (data) setEmpPositions(data as EmployeePosition[])
    setRemoving(false)
    setConfirmRemoveKey(null)
  }

  const handleMarkTrained = async (emp: Employee, categoryKey: CategoryKey) => {
    const rep = representativePosition(categoryKey)
    if (!rep) return
    setMarkingKey(categoryKey)
    await supabase
      .from('employee_positions')
      .insert({
        employee_id: emp.id,
        position_id: rep.id,
        certified: !rep.cdl_required,
      })
    const { data } = await supabase
      .from('employee_positions')
      .select('employee_id, position_id, certified')
      .limit(10000)
    if (data) setEmpPositions(data as EmployeePosition[])
    setMarkingKey(null)
  }

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl text-white text-sm outline-none flex-1 min-w-[200px] max-w-xs"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            caretColor: '#4a9eff',
          }}
        />
        <button
          onClick={fetchAll}
          className="px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(74,158,255,0.15)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.25)' }}
        >
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {([
          ['certified',        '✓', 'Certified'],
          ['trained',          '~', 'Trained (CDL pending)'],
          ['permanent_exempt', '—', 'Exempt'],
          ['snoozed',          '⏸', 'Snoozed'],
        ] as [CellStatus, string, string][]).map(([status, symbol, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded text-xs flex items-center justify-center font-bold"
              style={cellStyle(status)}>
              {symbol}
            </span>
            <span className="text-[#4a6fa5] text-xs">{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-[#4a6fa5] text-sm pt-4">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <table className="w-full border-collapse" style={{ minWidth: '520px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-4 py-3 text-xs text-[#4a6fa5] uppercase tracking-wider font-medium sticky left-0 z-10"
                  style={{ background: '#0d1525', minWidth: '160px' }}>
                  Employee
                </th>
                {CATEGORIES.map(cat => (
                  <th key={cat.key}
                    className="px-4 py-3 text-xs text-[#4a6fa5] uppercase tracking-wider font-medium text-center"
                    style={{ minWidth: '72px' }}>
                    {cat.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={CATEGORIES.length + 1} className="text-center py-12 text-[#4a6fa5] text-sm">
                    No employees found.
                  </td>
                </tr>
              ) : filtered.map((emp, i) => {
                const roleName = emp.roles?.name ?? ''
                return (
                  <tr key={emp.id}
                    style={{
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                    <td className="px-4 py-2.5 sticky left-0 z-10 cursor-pointer"
                      style={{ background: i % 2 === 0 ? '#0c1420' : '#0a0f1e' }}
                      onClick={() => setSelectedEmp(emp)}>
                      <div className="text-white text-sm font-medium leading-tight truncate max-w-[140px] hover:text-[#4a9eff] transition-colors">
                        {emp.full_name}
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `${ROLE_COLORS[roleName] ?? '#4a6fa5'}20`,
                          color: ROLE_COLORS[roleName] ?? '#4a6fa5',
                        }}>
                        {roleName.replace('_', ' ')}
                      </span>
                    </td>
                    {CATEGORIES.map(cat => {
                      const status = getCategoryStatus(emp.id, cat.key)
                      return (
                        <td key={cat.key} className="px-1 py-2 text-center">
                          <span
                            className="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center mx-auto"
                            style={cellStyle(status)}
                            title={status.replace('_', ' ')}
                          >
                            {cellLabel(status)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary counts */}
      {!loading && filtered.length > 0 && (
        <p className="text-[#4a6fa5] text-xs">
          {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Employee detail modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedEmp(null); setConfirmRemoveKey(null) } }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[80vh] flex flex-col"
            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}>

            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <div>
                <h2 className="text-white font-semibold text-lg">{selectedEmp.full_name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: `${ROLE_COLORS[selectedEmp.roles?.name] ?? '#4a6fa5'}20`,
                    color: ROLE_COLORS[selectedEmp.roles?.name] ?? '#4a6fa5',
                  }}>
                  {selectedEmp.roles?.name?.replace('_', ' ')}
                </span>
              </div>
              <button onClick={() => { setSelectedEmp(null); setConfirmRemoveKey(null) }} className="text-[#4a6fa5] hover:text-white text-lg">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {CATEGORIES.map(cat => {
                const status = getCategoryStatus(selectedEmp.id, cat.key)
                const rep = representativePosition(cat.key)
                return (
                  <div key={cat.key}
                    className="flex flex-col gap-2 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0"
                          style={cellStyle(status)}>
                          {cellLabel(status)}
                        </span>
                        <div>
                          <div className="text-white text-sm">{cat.label}</div>
                          {rep?.cdl_required && (
                            <span className="text-[10px]" style={{ color: '#ffa94a' }}>CDL required</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {status === 'none' ? (
                          <button
                            onClick={() => handleMarkTrained(selectedEmp, cat.key)}
                            disabled={markingKey === cat.key || !rep}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: markingKey === cat.key ? 'rgba(74,158,255,0.1)' : 'rgba(74,158,255,0.15)',
                              color: markingKey === cat.key ? '#4a6fa5' : '#4a9eff',
                              border: '1px solid rgba(74,158,255,0.25)',
                            }}
                          >
                            {markingKey === cat.key ? 'Saving...' : rep ? 'Mark Trained' : 'No positions'}
                          </button>
                        ) : status === 'trained' ? (
                          <>
                            <button
                              onClick={() => handleMarkCertified(selectedEmp, cat.key)}
                              disabled={certifyingKey === cat.key}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{
                                background: certifyingKey === cat.key ? 'rgba(255,214,74,0.05)' : 'rgba(255,214,74,0.12)',
                                color: certifyingKey === cat.key ? '#4a6fa5' : '#ffd64a',
                                border: '1px solid rgba(255,214,74,0.25)',
                              }}
                            >
                              {certifyingKey === cat.key ? 'Saving...' : 'Mark CDL Certified'}
                            </button>
                            <button
                              onClick={() => setConfirmRemoveKey(cat.key)}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium"
                              style={{ background: 'rgba(255,80,80,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,80,80,0.2)' }}
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs" style={{ color: '#4a6fa5' }}>
                              {status === 'certified' && 'Certified'}
                              {status === 'permanent_exempt' && 'Exempt'}
                              {status === 'snoozed' && 'Snoozed'}
                            </span>
                            <button
                              onClick={() => setConfirmRemoveKey(cat.key)}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium"
                              style={{ background: 'rgba(255,80,80,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,80,80,0.2)' }}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {confirmRemoveKey === cat.key && (
                      <div className="flex items-center justify-between gap-3 pt-1 pl-10">
                        <span className="text-xs" style={{ color: '#ff6b6b' }}>
                          Remove {cat.label} training for {selectedEmp.full_name}?
                        </span>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => setConfirmRemoveKey(null)}
                            className="px-2 py-1 rounded-lg text-xs"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRemove(selectedEmp, cat.key)}
                            disabled={removing}
                            className="px-2 py-1 rounded-lg text-xs font-medium"
                            style={{ background: removing ? 'rgba(255,80,80,0.3)' : 'rgba(255,80,80,0.6)', color: '#fff' }}
                          >
                            {removing ? '...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="pt-4 flex-shrink-0">
              <button
                onClick={() => setSelectedEmp(null)}
                className="w-full py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
