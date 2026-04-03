'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Employee = {
  id: string
  full_name: string
}

type Position = {
  id: string
  name: string
  shift_start: string
  shift_end: string
  requires_cdl: boolean
}

type PositionPref = {
  position_id: string
  position_name: string
  rank: number
}

type Preferences = {
  id?: string
  employee_id: string
  shift_preference: 'AM' | 'PM' | 'none'
  weekend_preference: boolean
  back_to_back_days_off: boolean
  preferred_days_off: string[]
  position_preferences: PositionPref[]
  notes: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_VALUES = ['0', '1', '2', '3', '4', '5', '6']

const defaultPrefs = (employee_id: string): Preferences => ({
  employee_id,
  shift_preference: 'none',
  weekend_preference: false,
  back_to_back_days_off: false,
  preferred_days_off: [],
  position_preferences: [],
  notes: '',
})

export default function DriverPreferencesModule() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchEmployees()
    fetchPositions()
  }, [])

  async function fetchEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name')
    if (data) setEmployees(data)
  }

  async function fetchPositions() {
    const { data } = await supabase
      .from('positions')
      .select('id, name, shift_start, shift_end, requires_cdl')
      .order('name')
    if (data) setPositions(data)
  }

  async function selectEmployee(emp: Employee) {
    setSelectedEmployee(emp)
    setSaved(false)
    const { data } = await supabase
      .from('driver_preferences')
      .select('*')
      .eq('employee_id', emp.id)
      .maybeSingle()
    if (data) {
      setPrefs(data)
    } else {
      setPrefs(defaultPrefs(emp.id))
    }
  }

  function toggleDay(val: string) {
    if (!prefs) return
    const current = prefs.preferred_days_off
    if (current.includes(val)) {
      setPrefs({ ...prefs, preferred_days_off: current.filter(d => d !== val) })
    } else {
      setPrefs({ ...prefs, preferred_days_off: [...current, val] })
    }
  }

  function addPositionPref(pos: Position) {
    if (!prefs) return
    if (prefs.position_preferences.find(p => p.position_id === pos.id)) return
    const newPref: PositionPref = {
      position_id: pos.id,
      position_name: pos.name,
      rank: prefs.position_preferences.length + 1,
    }
    setPrefs({ ...prefs, position_preferences: [...prefs.position_preferences, newPref] })
  }

  function removePositionPref(position_id: string) {
    if (!prefs) return
    const updated = prefs.position_preferences
      .filter(p => p.position_id !== position_id)
      .map((p, i) => ({ ...p, rank: i + 1 }))
    setPrefs({ ...prefs, position_preferences: updated })
  }

  function moveUp(index: number) {
    if (!prefs || index === 0) return
    const list = [...prefs.position_preferences]
    ;[list[index - 1], list[index]] = [list[index], list[index - 1]]
    setPrefs({ ...prefs, position_preferences: list.map((p, i) => ({ ...p, rank: i + 1 })) })
  }

  function moveDown(index: number) {
    if (!prefs || index === prefs.position_preferences.length - 1) return
    const list = [...prefs.position_preferences]
    ;[list[index], list[index + 1]] = [list[index + 1], list[index]]
    setPrefs({ ...prefs, position_preferences: list.map((p, i) => ({ ...p, rank: i + 1 })) })
  }

  // Drag and drop handlers
  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index || !prefs) return
    const list = [...prefs.position_preferences]
    const dragged = list.splice(dragIndex, 1)[0]
    list.splice(index, 0, dragged)
    setPrefs({ ...prefs, position_preferences: list.map((p, i) => ({ ...p, rank: i + 1 })) })
    setDragIndex(index)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  async function save() {
    if (!prefs) return
    setSaving(true)
    const payload = {
      employee_id: prefs.employee_id,
      shift_preference: prefs.shift_preference,
      weekend_preference: prefs.weekend_preference,
      back_to_back_days_off: prefs.back_to_back_days_off,
      preferred_days_off: prefs.preferred_days_off,
      position_preferences: prefs.position_preferences,
      notes: prefs.notes,
    }
    if (prefs.id) {
      await supabase.from('driver_preferences').update(payload).eq('id', prefs.id)
    } else {
      const { data } = await supabase.from('driver_preferences').insert(payload).select().single()
      if (data) setPrefs({ ...prefs, id: data.id })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const filteredEmployees = employees.filter(e =>
    `${e.full_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const availablePositions = positions.filter(
    pos => !prefs?.position_preferences.find(p => p.position_id === pos.id)
  )

  return (
    <div className="flex h-full gap-0" style={{ minHeight: '600px' }}>
      {/* Left panel — employee list */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-2">Driver Preferences</h2>
          <input
            type="text"
            placeholder="Search drivers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredEmployees.map(emp => (
            <button
              key={emp.id}
              onClick={() => selectEmployee(emp)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-200 transition-colors text-gray-800 ${
  selectedEmployee?.id === emp.id ? 'bg-white border-l-4 border-l-blue-500 font-medium text-gray-900' : 'text-gray-600'
}`}
            >
              {emp.full_name}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — preference editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedEmployee ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Select a driver to edit preferences
          </div>
        ) : !prefs ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Loading...
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {selectedEmployee.full_name}
              </h3>
              <button
                onClick={save}
                disabled={saving}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  saved
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Preferences'}
              </button>
            </div>

            {/* Shift preference */}
            <section>
             className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">Shift Preference</h4>
              <div className="flex gap-2">
                {(['AM', 'PM', 'none'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setPrefs({ ...prefs, shift_preference: opt })}
                    className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                      prefs.shift_preference === opt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {opt === 'none' ? 'No Preference' : opt}
                  </button>
                ))}
              </div>
            </section>

            {/* Days off preference */}
            <section>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Preferred Days Off</h4>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(DAY_VALUES[i])}
                    className={`px-3 py-2 rounded text-sm font-medium border transition-colors ${
                      prefs.preferred_days_off.includes(DAY_VALUES[i])
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </section>

            {/* Toggles */}
            <section>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Other Preferences</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setPrefs({ ...prefs, back_to_back_days_off: !prefs.back_to_back_days_off })}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      prefs.back_to_back_days_off ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      prefs.back_to_back_days_off ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className="text-sm text-gray-700">Prefers back-to-back days off</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setPrefs({ ...prefs, weekend_preference: !prefs.weekend_preference })}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      prefs.weekend_preference ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      prefs.weekend_preference ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className="text-sm text-gray-700">Prefers weekends off</span>
                </label>
              </div>
            </section>

            {/* Position preferences — ranked list */}
            <section>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Position Preferences (ranked)</h4>
              <p className="text-xs text-gray-400 mb-3">Drag to reorder. Rank 1 = most preferred.</p>

              {prefs.position_preferences.length === 0 ? (
                <p className="text-sm text-gray-400 italic mb-3">No positions ranked yet</p>
              ) : (
                <div className="space-y-1 mb-3">
                  {prefs.position_preferences.map((p, index) => (
                    <div
                      key={p.position_id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={e => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 px-3 py-2 bg-white border rounded text-sm cursor-grab active:cursor-grabbing transition-opacity ${
                        dragIndex === index ? 'opacity-50' : 'opacity-100'
                      }`}
                    >
                      <span className="text-gray-400 font-mono w-5 text-center">{p.rank}</span>
                      <span className="flex-1 font-medium">{p.position_name}</span>
                      <button onClick={() => moveUp(index)} disabled={index === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1">↑</button>
                      <button onClick={() => moveDown(index)} disabled={index === prefs.position_preferences.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1">↓</button>
                      <button onClick={() => removePositionPref(p.position_id)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add position dropdown */}
              {availablePositions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Add a position:</p>
                  <div className="flex flex-wrap gap-2">
                    {availablePositions.map(pos => (
                      <button
                        key={pos.id}
                        onClick={() => addPositionPref(pos)}
                        className="px-3 py-1.5 text-xs border border-dashed border-gray-300 text-gray-800 bg-white rounded hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        + {pos.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Notes */}
            <section>
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Supervisor Notes</h4>
              <textarea
                value={prefs.notes}
                onChange={e => setPrefs({ ...prefs, notes: e.target.value })}
                placeholder="Any notes about this driver's scheduling needs..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </section>

          </div>
        )}
      </div>
    </div>
  )
}
