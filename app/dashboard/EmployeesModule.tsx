'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Employee = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  employment_type: string
  hire_date: string
  preferred_hours: number
  cap_type: string
  ot_preference: string
  wash_duty_exempt: boolean
  is_temp_lead: boolean
  is_active: boolean
  roles: { name: string }
}

type NewEmployee = {
  full_name: string
  email: string
  phone: string
  role_name: string
  employment_type: string
  hire_date: string
  preferred_hours: string
  cap_type: string
  ot_preference: string
  wash_duty_exempt: boolean
  is_temp_lead: boolean
}

const EMPTY_EMPLOYEE: NewEmployee = {
  full_name: '',
  email: '',
  phone: '',
  role_name: 'driver',
  employment_type: 'full_time',
  hire_date: '',
  preferred_hours: '40',
  cap_type: 'soft',
  ot_preference: 'neutral',
  wash_duty_exempt: false,
  is_temp_lead: false,
}

const ROLE_COLORS: Record<string, string> = {
  supervisor: '#ffa94a',
  lead: '#4a9eff',
  assistant_supervisor: '#c084fc',
  driver: '#4aff9e',
}

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  full_time_benefits_threshold: 'FT Benefits',
  part_time_capped: 'PT Capped',
  part_time_fixed: 'PT Fixed',
  part_time_flexible: 'PT Flexible',
}

export default function EmployeesModule() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [form, setForm] = useState<NewEmployee>(EMPTY_EMPLOYEE)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState<NewEmployee>(EMPTY_EMPLOYEE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')
  const [search, setSearch] = useState('')
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetchEmployees()
    fetchRoles()
  }, [])

  const fetchEmployees = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*, roles(name)')
      .eq('is_test_profile', false)
      .order('full_name')
    if (data) setEmployees(data)
    setLoading(false)
  }

  const fetchRoles = async () => {
    const { data } = await supabase
      .from('roles')
      .select('id, name')
      .eq('active', true)
    if (data) setRoles(data)
  }

  const handleAdd = async () => {
    setError('')
    if (!form.full_name.trim()) { setError('Full name is required'); return }
    if (!form.hire_date) { setError('Hire date is required'); return }

    setSaving(true)
    const role = roles.find(r => r.name === form.role_name)
    if (!role) { setError('Invalid role'); setSaving(false); return }

    const userId = crypto.randomUUID()

    const { error: empError } = await supabase
      .from('employees')
      .insert({
        id: userId,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role_id: role.id,
        employment_type: form.employment_type,
        hire_date: form.hire_date,
        preferred_hours: parseFloat(form.preferred_hours),
        cap_type: form.cap_type,
        ot_preference: form.ot_preference,
        wash_duty_exempt: form.wash_duty_exempt,
        is_temp_lead: form.is_temp_lead,
      })

    if (empError) {
      setError(empError.message)
    } else {
      setForm(EMPTY_EMPLOYEE)
      setShowAdd(false)
      fetchEmployees()
    }
    setSaving(false)
  }

  const filtered = employees.filter(e =>
    (showInactive ? true : e.is_active) &&
    e.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (emp: Employee) => {
    setEditForm({
      full_name: emp.full_name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      role_name: emp.roles?.name ?? 'driver',
      employment_type: emp.employment_type,
      hire_date: emp.hire_date,
      preferred_hours: String(emp.preferred_hours),
      cap_type: emp.cap_type,
      ot_preference: emp.ot_preference,
      wash_duty_exempt: emp.wash_duty_exempt,
      is_temp_lead: emp.is_temp_lead,
    })
    setEditError('')
    setSelected(null)
    setEditTarget(emp)
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditError('')
    if (!editForm.full_name.trim()) { setEditError('Full name is required'); return }
    if (!editForm.hire_date) { setEditError('Hire date is required'); return }

    setSaving(true)
    const role = roles.find(r => r.name === editForm.role_name)
    if (!role) { setEditError('Invalid role'); setSaving(false); return }

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        role_id: role.id,
        employment_type: editForm.employment_type,
        hire_date: editForm.hire_date,
        preferred_hours: parseFloat(editForm.preferred_hours),
        cap_type: editForm.cap_type,
        ot_preference: editForm.ot_preference,
        wash_duty_exempt: editForm.wash_duty_exempt,
        is_temp_lead: editForm.is_temp_lead,
      })
      .eq('id', editTarget.id)

    if (updateError) {
      setEditError(updateError.message)
    } else {
      setEditTarget(null)
      fetchEmployees()
    }
    setSaving(false)
  }

  const handleToggleActive = async () => {
    if (!selected) return
    setDeactivating(true)
    await supabase
      .from('employees')
      .update({ is_active: !selected.is_active })
      .eq('id', selected.id)
    setDeactivating(false)
    setConfirmDeactivate(false)
    setSelected(null)
    fetchEmployees()
  }

  const tenureMonths = (hireDate: string) => {
    const months = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    if (months < 12) return `${months}mo`
    return `${Math.floor(months / 12)}yr ${months % 12}mo`
  }

  return (
    <div className="h-full">

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl text-white text-sm outline-none flex-1 min-w-[200px]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            caretColor: '#4a9eff'
          }}
        />
        <button
          onClick={() => setShowInactive(v => !v)}
          className="px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0"
          style={{
            background: showInactive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
            color: showInactive ? '#fff' : '#4a6fa5',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {showInactive ? 'Hide Inactive' : 'Show Inactive'}
        </button>
        <button
          onClick={() => { setShowAdd(true); setSelected(null); setError('') }}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
        >
          + Add Employee
        </button>
      </div>

      {/* Employee count */}
      <p className="text-[#4a6fa5] text-xs mb-4">
        {filtered.filter(e => e.is_active).length} active
        {showInactive && filtered.some(e => !e.is_active) && ` · ${filtered.filter(e => !e.is_active).length} inactive`}
      </p>

      {/* Employee list */}
      {loading ? (
        <div className="text-[#4a6fa5] text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#4a6fa5] text-sm">No employees yet. Add your first team member.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => (
            <button
              key={emp.id}
              onClick={() => { setSelected(emp); setShowAdd(false); setConfirmDeactivate(false) }}
              className="w-full text-left px-5 py-4 rounded-2xl transition-all duration-150 hover:scale-[1.01]"
              style={{
                background: selected?.id === emp.id ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.03)',
                border: selected?.id === emp.id ? '1px solid rgba(74,158,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                opacity: emp.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium">{emp.full_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: `${ROLE_COLORS[emp.roles?.name] || '#4a6fa5'}20`,
                        color: ROLE_COLORS[emp.roles?.name] || '#4a6fa5'
                      }}>
                      {emp.roles?.name?.replace('_', ' ')}
                    </span>
                    <span className="text-[#4a6fa5] text-xs">{TYPE_LABELS[emp.employment_type]}</span>
                    {!emp.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#4a6fa5' }}>
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[#4a6fa5] text-xs">{emp.preferred_hours}hrs/wk</div>
                  <div className="text-[#4a6fa5] text-xs mt-0.5">{tenureMonths(emp.hire_date)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Employee Panel */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold text-lg">Add Employee</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#4a6fa5] hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="First Last"
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="optional"
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="optional"
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Role *</label>
                  <select
                    value={form.role_name}
                    onChange={e => setForm({ ...form, role_name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.name.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Hire Date *</label>
                  <input
                    type="date"
                    value={form.hire_date}
                    onChange={e => setForm({ ...form, hire_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Employment Type *</label>
                <select
                  value={form.employment_type}
                  onChange={e => {
                    const et = e.target.value
                    const hrs = et === 'full_time' ? '40' : et === 'full_time_benefits_threshold' ? '36' : '28'
                    setForm({ ...form, employment_type: et, preferred_hours: hrs })
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Pref Hours</label>
                  <input
                    type="number"
                    value={form.preferred_hours}
                    onChange={e => setForm({ ...form, preferred_hours: e.target.value })}
                    min="1" max="40"
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Cap Type</label>
                  <select
                    value={form.cap_type}
                    onChange={e => setForm({ ...form, cap_type: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="soft">Soft</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">OT Pref</label>
                  <select
                    value={form.ot_preference}
                    onChange={e => setForm({ ...form, ot_preference: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="wants">Wants OT</option>
                    <option value="neutral">Neutral</option>
                    <option value="avoids">Avoids OT</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.wash_duty_exempt}
                    onChange={e => setForm({ ...form, wash_duty_exempt: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[#4a6fa5] text-sm">Wash duty exempt</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_temp_lead}
                    onChange={e => setForm({ ...form, is_temp_lead: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[#4a6fa5] text-sm">Temp lead</span>
                </label>
              </div>

              {error && (
                <div className="text-red-400 text-sm py-2 px-4 rounded-lg"
                  style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-medium"
                  style={{ background: saving ? 'rgba(74,158,255,0.4)' : 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
                >
                  {saving ? 'Saving...' : 'Add Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setConfirmDeactivate(false) } }}>
          <div className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-semibold text-lg">{selected.full_name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: `${ROLE_COLORS[selected.roles?.name] || '#4a6fa5'}20`,
                    color: ROLE_COLORS[selected.roles?.name] || '#4a6fa5'
                  }}>
                  {selected.roles?.name?.replace('_', ' ')}
                </span>
              </div>
              <button onClick={() => { setSelected(null); setConfirmDeactivate(false) }} className="text-[#4a6fa5] hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Employment Type', value: TYPE_LABELS[selected.employment_type] },
                { label: 'Hire Date', value: new Date(selected.hire_date).toLocaleDateString() },
                { label: 'Tenure', value: tenureMonths(selected.hire_date) },
                { label: 'Preferred Hours', value: `${selected.preferred_hours} hrs/wk` },
                { label: 'Cap Type', value: selected.cap_type },
                { label: 'OT Preference', value: selected.ot_preference },
                { label: 'Email', value: selected.email || '—' },
                { label: 'Phone', value: selected.phone || '—' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="text-[#4a6fa5] text-xs uppercase tracking-wider mb-1">{item.label}</div>
                  <div className="text-white text-sm">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              {selected.wash_duty_exempt && (
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,169,74,0.15)', color: '#ffa94a' }}>
                  Wash exempt
                </span>
              )}
              {selected.is_temp_lead && (
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(74,158,255,0.15)', color: '#4a9eff' }}>
                  Temp lead
                </span>
              )}
            </div>

            {confirmDeactivate ? (
              <div className="mt-6 px-4 py-4 rounded-xl"
                style={selected!.is_active
                  ? { background: 'rgba(255,80,80,0.07)', border: '1px solid rgba(255,80,80,0.2)' }
                  : { background: 'rgba(74,158,255,0.07)', border: '1px solid rgba(74,158,255,0.2)' }}>
                <p className="text-white text-sm mb-4">
                  {selected!.is_active
                    ? <>Are you sure you want to deactivate <span className="font-semibold">{selected!.full_name}</span>? They will be removed from all active lists.</>
                    : <>Reactivate <span className="font-semibold">{selected!.full_name}</span> and return them to the active roster?</>
                  }
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDeactivate(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleToggleActive}
                    disabled={deactivating}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={selected!.is_active
                      ? { background: deactivating ? 'rgba(255,80,80,0.3)' : 'rgba(255,80,80,0.7)', color: '#fff' }
                      : { background: deactivating ? 'rgba(74,158,255,0.3)' : 'rgba(74,158,255,0.7)', color: '#fff' }
                    }
                  >
                    {deactivating
                      ? (selected!.is_active ? 'Deactivating...' : 'Reactivating...')
                      : 'Confirm'
                    }
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-6">
                <button
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
                <button
                  onClick={() => setConfirmDeactivate(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={selected!.is_active
                    ? { background: 'rgba(255,80,80,0.12)', color: '#ff6b6b', border: '1px solid rgba(255,80,80,0.2)' }
                    : { background: 'rgba(74,158,255,0.12)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.2)' }
                  }
                >
                  {selected!.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button
                  onClick={() => openEdit(selected!)}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
                >
                  Edit Employee
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditTarget(null) }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold text-lg">Edit Employee</h2>
              <button onClick={() => setEditTarget(null)} className="text-[#4a6fa5] hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Role *</label>
                  <select
                    value={editForm.role_name}
                    onChange={e => setEditForm({ ...editForm, role_name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.name.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Hire Date *</label>
                  <input
                    type="date"
                    value={editForm.hire_date}
                    onChange={e => setEditForm({ ...editForm, hire_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Employment Type *</label>
                <select
                  value={editForm.employment_type}
                  onChange={e => {
                    const et = e.target.value
                    const hrs = et === 'full_time' ? '40' : et === 'full_time_benefits_threshold' ? '36' : '28'
                    setEditForm({ ...editForm, employment_type: et, preferred_hours: hrs })
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Pref Hours</label>
                  <input
                    type="number"
                    value={editForm.preferred_hours}
                    onChange={e => setEditForm({ ...editForm, preferred_hours: e.target.value })}
                    min="1" max="40"
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">Cap Type</label>
                  <select
                    value={editForm.cap_type}
                    onChange={e => setEditForm({ ...editForm, cap_type: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="soft">Soft</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4a6fa5] uppercase tracking-wider mb-1.5">OT Pref</label>
                  <select
                    value={editForm.ot_preference}
                    onChange={e => setEditForm({ ...editForm, ot_preference: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                    style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="wants">Wants OT</option>
                    <option value="neutral">Neutral</option>
                    <option value="avoids">Avoids OT</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.wash_duty_exempt}
                    onChange={e => setEditForm({ ...editForm, wash_duty_exempt: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[#4a6fa5] text-sm">Wash duty exempt</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_temp_lead}
                    onChange={e => setEditForm({ ...editForm, is_temp_lead: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[#4a6fa5] text-sm">Temp lead</span>
                </label>
              </div>

              {editError && (
                <div className="text-red-400 text-sm py-2 px-4 rounded-lg"
                  style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#4a6fa5' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-medium"
                  style={{ background: saving ? 'rgba(74,158,255,0.4)' : 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
