import { useState, useEffect } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const STAGE_COLORS = {
  'New Lead': '#6366f1',
  'Contacted': '#3b82f6',
  'Quoted': '#f59e0b',
  'Booked': '#22c55e',
  'Lost': '#ef4444',
}

export default function ConversionFunnel({ reports, dateRange }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!dateRange?.start || !dateRange?.end) return

    async function fetchFunnel() {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          start_date: dateRange.start,
          end_date: dateRange.end,
        })
        const res = await fetch(`/api/reports/funnel-timing?${params}`)
        if (!res.ok) {
          throw new Error(`Failed to fetch funnel data: ${res.status}`)
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error('Funnel fetch error:', err)
        setError(err.message)
      }
      setIsLoading(false)
    }

    fetchFunnel()
  }, [dateRange?.start, dateRange?.end])

  if (isLoading) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-kanai-blue-light" />
      </div>
    )
  }

  if (error || !data) return null

  const { conversionTimes, stageDistribution } = data
  const hasConversionData = conversionTimes && conversionTimes.count > 0
  const hasStageData = stageDistribution && stageDistribution.length > 0

  if (!hasConversionData && !hasStageData) return null

  const chartData = (stageDistribution || []).map(s => ({
    ...s,
    fill: STAGE_COLORS[s.stage] || '#64748b',
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null
    const d = payload[0].payload
    return (
      <div className="bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm">
        <p className="text-slate-200 font-medium">{d.stage}</p>
        <p className="text-slate-400">{d.count} opportunities</p>
      </div>
    )
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-kanai-blue-light" />
        Conversion Funnel
      </h3>

      {/* Conversion time stats */}
      {hasConversionData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Avg Time to Book</p>
            <p className="text-lg font-bold text-slate-100">{conversionTimes.average}h</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Median</p>
            <p className="text-lg font-bold text-slate-100">{conversionTimes.median}h</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Fastest</p>
            <p className="text-lg font-bold text-accent-green">{conversionTimes.min}h</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Slowest</p>
            <p className="text-lg font-bold text-accent-red">{conversionTimes.max}h</p>
          </div>
        </div>
      )}

      {/* Stage distribution chart */}
      {hasStageData && (
        <>
          <p className="text-xs text-slate-400 mb-2">Opportunities by Stage</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#475569' }}
                  tickLine={{ stroke: '#475569' }}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#475569' }}
                  tickLine={{ stroke: '#475569' }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
