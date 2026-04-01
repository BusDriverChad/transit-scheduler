'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import EmployeesModule from './EmployeesModule'
import ScoresModule from './ScoresModule'
import TrainingModule from './TrainingModule'
import ScoreEntryModule from './ScoreEntryModule'
type Section = 'home' | 'employees' | 'schedule' | 'scores' | 'training' | 'reports'

export default function Dashboard() {
  const [section, setSection] = useState<Section>('home')
  const [employeeName, setEmployeeName] = useState('Chad')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [employeeCount, setEmployeeCount] = useState<number | null>(null)
  const [pendingScoresCount, setPendingScoresCount] = useState<number | null>(null)
  const [showScoreEntry, setShowScoreEntry] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.replace('/')
        return
      }
      const { data } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      if (data) setEmployeeName(data.full_name.split(' ')[0])
    })
  }, [])

  useEffect(() => {
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_test_profile', false)
      .then(({ count }) => { if (count !== null) setEmployeeCount(count) })

    supabase
      .from('score_pending')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count !== null) setPendingScoresCount(count) })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  const navItems = [
    { id: 'home', label: 'Home', icon: '⊞' },
    { id: 'employees', label: 'Employees', icon: '👥' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'scores', label: 'Scores', icon: '⭐' },
    { id: 'training', label: 'Training', icon: '🎓' },
    { id: 'reports', label: 'Reports', icon: '📊' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex">

      {/* Sidebar — desktop */}
      <div className="hidden md:flex flex-col w-56 min-h-screen border-r border-white/5"
        style={{ background: 'rgba(255,255,255,0.02)' }}>

        {/* Logo + user + actions */}
        <div className="px-4 py-4 border-b border-white/5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold leading-tight">Transit</div>
              <div className="text-[#4a6fa5] text-xs">Scheduler</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{employeeName}</div>
              <div className="text-[#4a6fa5] text-xs">Supervisor</div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 px-2 py-1.5 rounded-lg text-xs transition-all duration-150"
              style={{ color: '#4a6fa5', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4a6fa5')}
            >
              ↩ Out
            </button>
          </div>
          <button
            onClick={() => setShowScoreEntry(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-medium"
            style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
          >
            <span>⭐</span> Log Entry
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id as Section)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left"
              style={section === item.id
                ? { background: 'rgba(74,158,255,0.15)', color: '#4a9eff', borderLeft: '2px solid #4a9eff' }
                : { color: '#4a6fa5' }
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

      </div>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-white/5"
        style={{ background: '#0a0f1e' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <span className="text-white text-sm font-semibold">Transit Scheduler</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white p-1">
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-14"
          style={{ background: '#0a0f1e' }}>
          <nav className="px-4 py-4 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setSection(item.id as Section); setMobileMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-left"
                style={section === item.id
                  ? { background: 'rgba(74,158,255,0.15)', color: '#4a9eff' }
                  : { color: '#4a6fa5' }
                }
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
            
            <button
              onClick={() => { setShowScoreEntry(true); setMobileMenuOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white mb-2"
              style={{ background: 'linear-gradient(135deg, #4a9eff 0%, #1a6fd4 100%)' }}
            >
              <span>⭐</span> Log Entry
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
              style={{ color: '#ff6b6b' }}
            >
              <span>↩</span> Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col md:ml-0 pt-14 md:pt-0 overflow-x-hidden">

        {/* Page header */}
        <div className="px-6 py-6 border-b border-white/5">
          <div>
            <h1 className="text-white text-xl font-semibold">
              {section === 'home' && `${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, ${employeeName}`}
              {section === 'employees' && 'Employees'}
              {section === 'schedule' && 'Schedule'}
              {section === 'scores' && 'Scores'}
              {section === 'training' && 'Training'}
              {section === 'reports' && 'Reports'}
            </h1>
            <p className="text-[#4a6fa5] text-sm mt-0.5">
              {section === 'home' && 'Durango Transit Operations'}
              {section === 'employees' && 'Manage your team'}
              {section === 'schedule' && 'View and manage the schedule'}
              {section === 'scores' && 'Driver performance scores'}
              {section === 'training' && 'Training status and records'}
              {section === 'reports' && 'Operational reports'}
            </p>
          </div>
        </div>

        {/* Section content */}
        <div className="flex-1 p-4 md:p-6">

          {section === 'home' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Employees', value: employeeCount !== null ? String(employeeCount) : '—', sub: 'Active drivers', color: '#4a9eff', section: 'employees' },
                { label: 'This Week', value: '—', sub: 'Schedule status', color: '#4aff9e', section: 'schedule' },
                { label: 'Open Shifts', value: '—', sub: 'Pending coverage', color: '#ffa94a', section: 'schedule' },
                { label: 'Pending Scores', value: pendingScoresCount !== null ? String(pendingScoresCount) : '—', sub: 'Awaiting approval', color: '#ff6b9d', section: 'scores' },
                { label: 'Training Gaps', value: '—', sub: 'Positions needed', color: '#c084fc', section: 'training' },
                { label: 'Coverage', value: '—', sub: 'Weeks scheduled out', color: '#4ae4ff', section: 'schedule' },
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={() => setSection(card.section as Section)}
                  className="text-left p-5 rounded-2xl transition-all duration-150 hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="text-2xl font-bold mb-1" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-white text-sm font-medium">{card.label}</div>
                  <div className="text-[#4a6fa5] text-xs mt-0.5">{card.sub}</div>
                </button>
              ))}
            </div>
          )}

          {section === 'employees' && <EmployeesModule />}
          {section === 'scores' && <ScoresModule />}
          {section === 'training' && <TrainingModule />}

{section !== 'home' && section !== 'employees' && section !== 'scores' && section !== 'training' && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-4xl mb-4">{navItems.find(n => n.id === section)?.icon}</div>
                <p className="text-[#4a6fa5] text-sm">
                  {section.charAt(0).toUpperCase() + section.slice(1)} module coming soon
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

{showScoreEntry && <ScoreEntryModule onClose={() => setShowScoreEntry(false)} />}
    </div>
  )
}

