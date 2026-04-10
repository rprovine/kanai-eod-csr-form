import { Loader2 } from 'lucide-react'
import ScoreRadarChart from './ScoreRadarChart'
import WeekOverWeekTrend from './WeekOverWeekTrend'
import CoachingAssignmentCard from './CoachingAssignmentCard'
import BadgesDisplay from './BadgesDisplay'

export default function TrainingOverview({ weeklySummaries, assignments, badges, loading, selectedEmployee }) {
  if (loading.summaries) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading coaching data...
      </div>
    )
  }

  if (weeklySummaries.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-8 text-center">
        <p className="text-slate-400">No coaching data available yet.</p>
        <p className="text-xs text-slate-500 mt-1">Scored calls will appear here once the coaching pipeline has run.</p>
      </div>
    )
  }

  // Most recent week's summary (could be multiple CSRs if "all")
  const latestWeek = weeklySummaries[0]?.week_start
  const currentWeekSummaries = weeklySummaries.filter(s => s.week_start === latestWeek)

  // Aggregate if viewing all CSRs
  const aggregated = currentWeekSummaries.length > 1
    ? aggregateSummaries(currentWeekSummaries)
    : currentWeekSummaries[0] || null

  return (
    <div className="space-y-4">
      {/* Top row: Radar + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScoreRadarChart summary={aggregated} weekLabel={latestWeek} />
        <div className="space-y-4">
          <QuickStats summary={aggregated} />
          <CoachingAssignmentCard assignments={assignments} selectedEmployee={selectedEmployee} />
        </div>
      </div>

      {/* Trend chart */}
      <WeekOverWeekTrend
        summaries={weeklySummaries}
      />

      {/* Badges */}
      <BadgesDisplay badges={badges} />
    </div>
  )
}

function QuickStats({ summary }) {
  if (!summary) return null

  const stats = [
    { label: 'Overall Score', value: summary.avg_overall_score ? Number(summary.avg_overall_score).toFixed(1) : '--', suffix: '/5', color: getScoreColor(summary.avg_overall_score) },
    { label: 'Calls Scored', value: summary.scored_calls || 0, color: 'text-slate-200' },
    { label: 'Qualified Leads', value: summary.qualified_leads || 0, color: 'text-slate-200' },
    { label: 'Booking Rate', value: summary.booking_rate ? `${Math.round(Number(summary.booking_rate) * 100)}%` : '--', color: getBookingColor(summary.booking_rate) },
    { label: 'Week-over-Week', value: formatWoW(summary.week_over_week_change), color: getWoWColor(summary.week_over_week_change) },
    { label: 'Booked', value: summary.booked_count || 0, color: 'text-accent-green' },
  ]

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">This Week at a Glance</h3>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>
              {s.value}{s.suffix || ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function aggregateSummaries(summaries) {
  const count = summaries.length
  if (count === 0) return null
  return {
    avg_overall_score: avg(summaries, 'avg_overall_score'),
    avg_greeting: avg(summaries, 'avg_greeting'),
    avg_needs_discovery: avg(summaries, 'avg_needs_discovery'),
    avg_pricing_confidence: avg(summaries, 'avg_pricing_confidence'),
    avg_objection_handling: avg(summaries, 'avg_objection_handling'),
    avg_close_attempt: avg(summaries, 'avg_close_attempt'),
    scored_calls: summaries.reduce((s, r) => s + (r.scored_calls || 0), 0),
    qualified_leads: summaries.reduce((s, r) => s + (r.qualified_leads || 0), 0),
    booked_count: summaries.reduce((s, r) => s + (r.booked_count || 0), 0),
    booking_rate: (() => {
      const totalQ = summaries.reduce((s, r) => s + (r.qualified_leads || 0), 0)
      const totalB = summaries.reduce((s, r) => s + (r.booked_count || 0), 0)
      return totalQ > 0 ? totalB / totalQ : null
    })(),
    week_over_week_change: avg(summaries, 'week_over_week_change'),
    top_strengths: summaries[0]?.top_strengths || [],
    top_improvements: summaries[0]?.top_improvements || [],
  }
}

function avg(arr, key) {
  const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v))
  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

function getScoreColor(score) {
  const s = parseFloat(score)
  if (isNaN(s)) return 'text-slate-400'
  if (s >= 4) return 'text-accent-green'
  if (s >= 3) return 'text-accent-gold'
  return 'text-accent-red'
}

function getBookingColor(rate) {
  if (!rate) return 'text-slate-400'
  const pct = Number(rate)
  if (pct >= 0.6) return 'text-accent-green'
  if (pct >= 0.4) return 'text-accent-gold'
  return 'text-accent-red'
}

function getWoWColor(change) {
  const c = parseFloat(change)
  if (isNaN(c)) return 'text-slate-400'
  if (c > 0) return 'text-accent-green'
  if (c < 0) return 'text-accent-red'
  return 'text-slate-400'
}

function formatWoW(change) {
  const c = parseFloat(change)
  if (isNaN(c)) return '--'
  return `${c > 0 ? '+' : ''}${c.toFixed(2)}`
}
