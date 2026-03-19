import { useState, useEffect } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

// Color assignment for stage names by keyword
function getStageColor(name) {
  const n = name.toLowerCase()
  if (n.includes('new lead') || n === 'new') return '#6366f1'
  if (n.includes('contacted')) return '#3b82f6'
  if (n.includes('follow')) return '#8b5cf6'
  if (n.includes('estimate scheduled') || n.includes('discovery')) return '#06b6d4'
  if (n.includes('estimate completed')) return '#0ea5e9'
  if (n.includes('quote') || n.includes('proposal')) return '#f59e0b'
  if (n.includes('agreement') || n.includes('rental')) return '#f97316'
  if (n.includes('booked') || n.includes('won') || n.includes('activated')) return '#22c55e'
  if (n.includes('lost') || n.includes('closed lost')) return '#ef4444'
  if (n.includes('non-qualified') || n.includes('not qualified')) return '#64748b'
  if (n.includes('nurture') || n.includes('conversation')) return '#a78bfa'
  if (n.includes('referral')) return '#14b8a6'
  return '#94a3b8'
}

export default function ConversionFunnel({ reports, dateRange }) {
  const [conversionData, setConversionData] = useState(null)
  const [pipelineStages, setPipelineStages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch conversion timing from API
  useEffect(() => {
    if (!dateRange?.start || !dateRange?.end) return

    async function fetchFunnel() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          start_date: dateRange.start,
          end_date: dateRange.end,
        })
        const res = await fetch(`/api/reports/funnel-timing?${params}`)
        if (res.ok) {
          const json = await res.json()
          setConversionData(json.conversionTimes || null)
        }
      } catch (err) {
        console.error('Funnel fetch error:', err)
      }
      setIsLoading(false)
    }

    fetchFunnel()
  }, [dateRange?.start, dateRange?.end])

  // Fetch live pipeline stage distribution directly from GHL API
  useEffect(() => {
    async function fetchPipeline() {
      try {
        const res = await fetch('/api/ghl/stages')
        if (!res.ok) return
        const { stageCounts, totalOpportunities } = await res.json()
        if (!stageCounts || Object.keys(stageCounts).length === 0) return

        const chartData = Object.entries(stageCounts)
          .map(([stage, count]) => ({
            stage,
            count,
            fill: getStageColor(stage),
          }))
          .sort((a, b) => b.count - a.count)

        setPipelineStages(chartData)
      } catch (err) {
        console.error('Pipeline stages fetch error:', err)
      }
    }

    fetchPipeline()
  }, [dateRange?.start, dateRange?.end])

  if (isLoading) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-kanai-blue-light" />
      </div>
    )
  }

  const hasConversionData = conversionData && conversionData.count > 0
  const hasStageData = pipelineStages.length > 0

  if (!hasConversionData && !hasStageData) return null

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

  const totalPipeline = pipelineStages.reduce((sum, s) => sum + s.count, 0)

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
            <p className="text-lg font-bold text-slate-100">{conversionData.average}h</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Median</p>
            <p className="text-lg font-bold text-slate-100">{conversionData.median}h</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Fastest</p>
            <p className="text-lg font-bold text-accent-green">{conversionData.min}h</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Slowest</p>
            <p className="text-lg font-bold text-accent-red">{conversionData.max}h</p>
          </div>
        </div>
      )}

      {/* Live pipeline stage distribution */}
      {hasStageData && (
        <>
          <p className="text-xs text-slate-400 mb-2">
            Live Pipeline ({totalPipeline} opportunities)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pipelineStages}
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
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#475569' }}
                  tickLine={{ stroke: '#475569' }}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {pipelineStages.map((entry, index) => (
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
