import { Award, Trophy, TrendingUp, Target, Flame, Star } from 'lucide-react'
import { BADGE_CONFIG } from '../../lib/constants'

const BADGE_ICONS = {
  top_scorer: Trophy,
  most_improved: TrendingUp,
  booking_champ: Target,
  perfect_greeting: Star,
  streak_3: Flame,
  streak_5: Flame,
}

export default function BadgesDisplay({ badges }) {
  if (!badges || badges.length === 0) return null

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Award className="w-4 h-4 text-accent-gold" />
        Badges Earned
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {badges.map(badge => {
          const config = BADGE_CONFIG[badge.badge_type] || { color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20' }
          const Icon = BADGE_ICONS[badge.badge_type] || Award
          const csrName = badge.csr_employees?.name || ''

          return (
            <div
              key={badge.id}
              className={`p-3 rounded-lg border ${config.bg} ${config.border} text-center`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-1.5 ${config.color}`} />
              <p className={`text-xs font-semibold ${config.color}`}>
                {badge.badge_label || config.label}
              </p>
              {csrName && (
                <p className="text-xs text-slate-500 mt-0.5">{csrName}</p>
              )}
              <p className="text-xs text-slate-600 mt-0.5">
                {formatWeek(badge.week_start)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatWeek(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
