import { Target, BookOpen } from 'lucide-react'
import { COACHING_CATEGORIES } from '../../lib/constants'

export default function CoachingAssignmentCard({ assignments, selectedEmployee }) {
  if (!assignments || assignments.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-kanai-blue-light" />
          Coaching Focus
        </h3>
        <p className="text-xs text-slate-500">No active coaching assignments this week.</p>
      </div>
    )
  }

  // Show most recent assignments (group by CSR if viewing all)
  const recent = assignments.slice(0, 5)

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Target className="w-4 h-4 text-kanai-blue-light" />
        Coaching Focus
      </h3>

      <div className="space-y-3">
        {recent.map(a => {
          const catLabel = COACHING_CATEGORIES.find(c => c.key === a.focus_category)?.label || a.focus_category
          const csrName = a.csr_employees?.name || ''
          return (
            <div key={a.id} className="p-3 bg-slate-800/50 rounded-lg border border-card-border/50">
              {selectedEmployee === 'all' && csrName && (
                <p className="text-xs text-slate-500 mb-1">{csrName}</p>
              )}
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-3.5 h-3.5 text-accent-gold" />
                <span className="text-sm font-medium text-slate-200">{catLabel}</span>
                {a.focus_score != null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    a.focus_score >= 4 ? 'bg-accent-green/15 text-accent-green' :
                    a.focus_score >= 3 ? 'bg-accent-gold/15 text-accent-gold' :
                    'bg-accent-red/15 text-accent-red'
                  }`}>
                    {Number(a.focus_score).toFixed(1)}
                  </span>
                )}
              </div>
              {a.coaching_note && (
                <p className="text-xs text-slate-400 leading-relaxed">{a.coaching_note}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
