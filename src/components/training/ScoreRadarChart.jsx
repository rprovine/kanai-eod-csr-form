import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { COACHING_CATEGORIES } from '../../lib/constants'

export default function ScoreRadarChart({ summary, weekLabel }) {
  if (!summary) return null

  const data = COACHING_CATEGORIES.map(cat => ({
    category: cat.short,
    score: parseFloat(summary[cat.summaryKey]) || 0,
    fullMark: 5,
  }))

  const overallScore = summary.avg_overall_score ? Number(summary.avg_overall_score).toFixed(1) : '--'

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-200">Score Breakdown</h3>
        {weekLabel && (
          <span className="text-xs text-slate-500">Week of {weekLabel}</span>
        )}
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 5]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickCount={6}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#2563EB"
              fill="#1B4D7A"
              fillOpacity={0.5}
              strokeWidth={2}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-xs">
                    <p className="text-slate-200 font-medium">{d.category}</p>
                    <p className="text-kanai-blue-light font-bold">{d.score.toFixed(1)} / 5</p>
                  </div>
                )
              }}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Center score overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">{overallScore}</p>
            <p className="text-xs text-slate-500">Overall</p>
          </div>
        </div>
      </div>

      {/* Category bars below */}
      <div className="space-y-2 mt-2">
        {COACHING_CATEGORIES.map(cat => {
          const score = parseFloat(summary[cat.summaryKey]) || 0
          const pct = (score / 5) * 100
          return (
            <div key={cat.key} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-slate-400 truncate">{cat.short}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    score >= 4 ? 'bg-accent-green' :
                    score >= 3 ? 'bg-accent-gold' : 'bg-accent-red'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`w-8 text-right font-semibold ${
                score >= 4 ? 'text-accent-green' :
                score >= 3 ? 'text-accent-gold' : 'text-accent-red'
              }`}>
                {score.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
