import { useState, useEffect } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

// GHL pipeline stage ID → name mapping (from Kanai's 1-LEADS pipeline)
const STAGE_MAP = {
  '385c8669-3b27-4dd2-8014-d45ec3e0efca': 'New Lead',
  'd0359468-1622-4a3c-9c62-60cf522ff624': 'Contacted',
  '17dc9a7f-b22e-4746-b466-496416d355a2': 'Needs Follow-Up',
  'a4f500f3-c9bc-479d-a4e0-6cffefb31fe6': 'Estimate Scheduled',
  '90913cea-97c6-4e99-aa7f-1c4f629b5ed3': 'Estimate Completed',
  '29bff7b4-596c-4458-8530-3bea8cf8a8e3': 'DR Quote Given',
  '6197ea4f-ec72-45c6-86c7-c1b635728692': 'DR Agreement Sent',
  '40568a91-8969-4ada-b066-eb144d4ab799': 'JR Booked',
  'f6bf1393-c911-413a-8635-6e134b7f6dbd': 'JR Lost',
  'd24bfaad-766e-4f57-9b87-dc40170cfc5b': 'DR Booked',
  'be3a7102-a3d8-4089-b076-9719029800f6': 'DR Lost',
  '8eb1f7a5-cb94-484f-87fc-5367b1a02d7d': 'Non-Qualified',
}

const STAGE_COLORS = {
  'New Lead': '#6366f1',
  'Contacted': '#3b82f6',
  'Needs Follow-Up': '#8b5cf6',
  'Estimate Scheduled': '#06b6d4',
  'Estimate Completed': '#0ea5e9',
  'DR Quote Given': '#f59e0b',
  'DR Agreement Sent': '#f97316',
  'JR Booked': '#22c55e',
  'DR Booked': '#10b981',
  'JR Lost': '#ef4444',
  'DR Lost': '#dc2626',
  'Non-Qualified': '#64748b',
}

// Order stages should appear in the chart
const STAGE_ORDER = [
  'New Lead', 'Contacted', 'Needs Follow-Up',
  'Estimate Scheduled', 'Estimate Completed',
  'DR Quote Given', 'DR Agreement Sent',
  'JR Booked', 'DR Booked',
  'JR Lost', 'DR Lost',
  'Non-Qualified',
]

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

  // Fetch live pipeline stage distribution from ghl_daily_pipeline_summary
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    async function fetchPipeline() {
      // Get the most recent summary entries (one per CSR)
      const { data, error } = await supabase
        .from('ghl_daily_pipeline_summary')
        .select('opportunities')
        .order('summary_date', { ascending: false })
        .limit(10)

      if (error || !data || data.length === 0) return

      // Deduplicate opportunities across CSR summaries
      const seenIds = new Set()
      const allOpps = []
      for (const row of data) {
        const opps = row.opportunities || []
        if (!Array.isArray(opps)) continue
        for (const opp of opps) {
          if (opp.id && !seenIds.has(opp.id)) {
            seenIds.add(opp.id)
            allOpps.push(opp)
          }
        }
      }

      // Count by stage
      const stageCounts = {}
      for (const opp of allOpps) {
        const stageName = STAGE_MAP[opp.pipelineStageId] || 'Other'
        stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
      }

      // Convert to chart data, ordered
      const chartData = STAGE_ORDER
        .filter(s => stageCounts[s] > 0)
        .map(s => ({
          stage: s,
          count: stageCounts[s],
          fill: STAGE_COLORS[s] || '#64748b',
        }))

      // Add any "Other" stages not in the order
      if (stageCounts['Other']) {
        chartData.push({ stage: 'Other', count: stageCounts['Other'], fill: '#64748b' })
      }

      setPipelineStages(chartData)
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
