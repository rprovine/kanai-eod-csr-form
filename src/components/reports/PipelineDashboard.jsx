import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { TrendingUp } from 'lucide-react'

const STAGE_COLORS = {
  'Qualified Leads': '#6366f1',   // indigo
  'Booked': '#22c55e',            // green
  'Revenue': '#f59e0b',           // amber
}

function formatValue(value, isRevenue) {
  if (isRevenue) return `$${value.toLocaleString()}`
  return value.toLocaleString()
}

function ConversionArrow({ from, to, label }) {
  if (!from || from === 0) return null
  const rate = Math.round((to / from) * 100)
  return (
    <div className="flex items-center justify-center text-xs text-slate-400">
      <span className="text-kanai-blue-light font-semibold">{rate}%</span>
    </div>
  )
}

export default function PipelineDashboard({ totals, pipelineSummary }) {
  const totalDispositions = totals.booked + totals.quoted + totals.followup + totals.lost

  if (!totals || totalDispositions === 0) return null

  const stages = [
    { name: 'Qualified Leads', value: totalDispositions, isRevenue: false },
    { name: 'Booked', value: totals.booked, isRevenue: false },
  ]

  // Only add revenue stage if there's revenue
  if (totals.revenue > 0) {
    stages.push({ name: 'Revenue', value: totals.revenue, isRevenue: true })
  }

  // For the funnel bar chart, normalize widths relative to max (total dispositions)
  const maxVal = totalDispositions || 1
  const chartData = stages.filter(s => !s.isRevenue).map(s => ({
    name: s.name,
    value: s.value,
    fill: STAGE_COLORS[s.name],
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm">
          <p className="text-slate-200 font-medium">{data.name}</p>
          <p className="text-slate-400">{data.value.toLocaleString()}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-kanai-blue-light" />
        Lead-to-Revenue Pipeline
      </h3>

      {/* Funnel Visualization */}
      <div className="space-y-2 mb-4">
        {stages.map((stage, i) => {
          const widthPct = stage.isRevenue ? 100 : Math.max((stage.value / maxVal) * 100, 8)
          const color = STAGE_COLORS[stage.name]
          const prevStage = i > 0 ? stages[i - 1] : null

          return (
            <div key={stage.name}>
              {/* Conversion rate between stages */}
              {prevStage && !stage.isRevenue && !prevStage.isRevenue && prevStage.value > 0 && (
                <ConversionArrow from={prevStage.value} to={stage.value} />
              )}

              <div className="flex items-center gap-3">
                <div className="w-36 sm:w-44 text-right text-xs text-slate-400 shrink-0">
                  {stage.name}
                </div>
                <div className="flex-1 relative">
                  {stage.isRevenue ? (
                    <div className="h-9 rounded-lg flex items-center px-3"
                      style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
                      <span className="text-sm font-bold" style={{ color }}>${stage.value.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="h-9 bg-slate-800 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      >
                        <span className="text-sm font-bold text-white whitespace-nowrap">
                          {stage.value.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Conversion Summary */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-card-border">
        <div className="text-center">
          <p className="text-xs text-slate-500">Booking Rate</p>
          <p className="text-sm font-semibold text-accent-green">
            {totalDispositions > 0 ? `${Math.round((totals.booked / totalDispositions) * 100)}%` : '--'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500">Avg Revenue/Booking</p>
          <p className="text-sm font-semibold text-accent-gold">
            {totals.booked > 0 && totals.revenue > 0
              ? `$${Math.round(totals.revenue / totals.booked).toLocaleString()}`
              : '--'}
          </p>
        </div>
      </div>

      {/* Pipeline Health from ghl_daily_pipeline_summary */}
      {pipelineSummary && pipelineSummary.length > 0 && (() => {
        const latest = pipelineSummary[0]
        return (
          <div className="mt-4 pt-4 border-t border-card-border">
            <p className="text-xs text-slate-500 mb-3">Pipeline Health (latest snapshot)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">New Leads</p>
                <p className="text-lg font-bold text-kanai-blue-light">{(latest.new_leads_count ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Stale Leads</p>
                <p className={`text-lg font-bold ${(latest.stale_leads_count ?? 0) > 0 ? 'text-accent-red' : 'text-slate-300'}`}>
                  {(latest.stale_leads_count ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Quoted Pending</p>
                <p className="text-lg font-bold text-accent-gold">{(latest.quoted_pending ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Total Pipeline</p>
                <p className="text-lg font-bold text-slate-200">{(latest.opportunities ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
