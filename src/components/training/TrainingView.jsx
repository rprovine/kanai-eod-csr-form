import { useState, useEffect } from 'react'
import { GraduationCap, BarChart3, Phone, Trophy, Loader2, Users } from 'lucide-react'
import { useCoachingData } from '../../hooks/useCoachingData'
import { fetchEmployees } from '../../lib/supabase-data'
import TrainingOverview from './TrainingOverview'
import CallList from './CallList'
import CallDetailModal from './CallDetailModal'
import CoachingLeaderboard from './CoachingLeaderboard'

const SUB_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
]

export default function TrainingView() {
  const [activeTab, setActiveTab] = useState('overview')
  const [employees, setEmployees] = useState([])

  const {
    selectedEmployee,
    setSelectedEmployee,
    weeklySummaries,
    calls,
    selectedCall,
    assignments,
    badges,
    leaderboard,
    leaderboardWeeks,
    loading,
    loadCalls,
    loadCallDetail,
    loadLeaderboard,
    setSelectedCall,
  } = useCoachingData()

  useEffect(() => {
    fetchEmployees().then(setEmployees)
  }, [])

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === 'calls') {
      loadCalls()
    } else if (activeTab === 'leaderboard') {
      loadLeaderboard(1)
    }
  }, [activeTab, loadCalls, loadLeaderboard])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-kanai-blue/20 rounded-lg">
            <GraduationCap className="w-5 h-5 text-kanai-blue-light" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Call Coaching & Training</h2>
            <p className="text-xs text-slate-400">AI-powered call scoring across 6 categories</p>
          </div>
        </div>

        {/* Employee Selector */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="bg-slate-800 border border-card-border rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-kanai-blue"
          >
            <option value="all">All CSRs</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center bg-dark-bg rounded-lg p-1 border border-card-border w-fit">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-kanai-blue text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <TrainingOverview
          weeklySummaries={weeklySummaries}
          assignments={assignments}
          badges={badges}
          loading={loading}
          selectedEmployee={selectedEmployee}
        />
      )}

      {activeTab === 'calls' && (
        <CallList
          calls={calls}
          loading={loading.calls}
          onSelectCall={(callId) => loadCallDetail(callId)}
        />
      )}

      {activeTab === 'leaderboard' && (
        <CoachingLeaderboard
          leaderboard={leaderboard}
          weeks={leaderboardWeeks}
          loading={loading.leaderboard}
          onWeeksChange={(w) => loadLeaderboard(w)}
        />
      )}

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          loading={loading.callDetail}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  )
}
