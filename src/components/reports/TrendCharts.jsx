import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

function formatWeekLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function TrendCharts({ reports }) {
  const weeklyData = useMemo(() => {
    if (!reports || reports.length === 0) return []

    const weeks = {}

    for (const r of reports) {
      if (!r.report_date) continue
      const monday = getMonday(r.report_date)
      const key = formatDateKey(monday)

      if (!weeks[key]) {
        weeks[key] = {
          weekKey: key,
          monday,
          label: formatWeekLabel(monday),
          bookingRates: [],
          stlValues: [],
          totalFollowups: 0,
          totalBooked: 0,
        }
      }

      if (r.bookingRate != null) {
        weeks[key].bookingRates.push(r.bookingRate)
      }
      if (r.speed_to_lead_minutes != null && r.speed_to_lead_minutes > 0) {
        weeks[key].stlValues.push(r.speed_to_lead_minutes)
      }
      weeks[key].totalFollowups += parseInt(r.disp_followup_required) || 0
      weeks[key].totalBooked += parseInt(r.disp_booked) || 0
    }

    return Object.values(weeks)
      .sort((a, b) => a.monday - b.monday)
      .map(w => ({
        label: w.label,
        bookingRate: w.bookingRates.length > 0
          ? Math.round(w.bookingRates.reduce((s, v) => s + v, 0) / w.bookingRates.length * 10) / 10
          : 0,
        speedToLead: w.stlValues.length > 0
          ? Math.round(w.stlValues.reduce((s, v) => s + v, 0) / w.stlValues.length * 10) / 10
          : null,
        totalFollowups: w.totalFollowups,
        totalBooked: w.totalBooked,
      }))
  }, [reports])

  if (weeklyData.length < 2) return null

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm">
        <p className="text-slate-200 font-medium mb-1">Week of {label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-slate-400">
            <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
            {entry.name === 'Booking Rate' ? `${entry.value}%` :
             entry.name === 'Speed-to-Lead' ? `${entry.value} min` :
             entry.value}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-kanai-blue-light" />
        Performance Trends
      </h3>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              domain={[0, 100]}
              label={{ value: 'Booking %', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              label={{ value: 'STL (min)', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="totalBooked"
              name="Booked"
              fill="#6366f1"
              opacity={0.3}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="bookingRate"
              name="Booking Rate"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="speedToLead"
              name="Speed-to-Lead"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Booking Rate %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Speed-to-Lead (min)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-indigo-500/30 inline-block rounded" /> Booked Count
        </span>
      </div>
    </div>
  )
}
