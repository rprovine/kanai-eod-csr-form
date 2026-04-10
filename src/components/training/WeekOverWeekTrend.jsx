import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart } from 'recharts'
import { TrendingUp } from 'lucide-react'

export default function WeekOverWeekTrend({ summaries }) {
  const chartData = useMemo(() => {
    if (!summaries || summaries.length === 0) return []

    // Group by week, aggregate if "all" CSRs
    const weekMap = {}
    for (const s of summaries) {
      const week = s.week_start
      if (!weekMap[week]) {
        weekMap[week] = { scores: [], calls: 0, booked: 0 }
      }
      weekMap[week].scores.push(parseFloat(s.avg_overall_score) || 0)
      weekMap[week].calls += s.scored_calls || 0
      weekMap[week].booked += s.booked_count || 0
    }

    return Object.entries(weekMap)
      .map(([week, data]) => ({
        week: formatWeekLabel(week),
        avgScore: data.scores.length > 0
          ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100
          : 0,
        calls: data.calls,
        booked: data.booked,
      }))
      .reverse() // oldest first for chart
  }, [summaries])

  if (chartData.length < 2) return null

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-kanai-blue-light" />
        Performance Trend
      </h3>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 5]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            label={{ value: 'Calls', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 11 }}
          />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload || !payload.length) return null
              return (
                <div className="bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-xs space-y-1">
                  <p className="text-slate-300 font-medium">{label}</p>
                  {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }}>
                      {p.name}: {p.value}
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Bar
            yAxisId="right"
            dataKey="calls"
            name="Calls Scored"
            fill="#6366f1"
            opacity={0.25}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="avgScore"
            name="Avg Score"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: '#22c55e', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
