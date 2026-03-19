import { useState, useEffect } from 'react'
import { Users, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function WorkloadDistribution({ dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalLeads, setTotalLeads] = useState(0)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      if (!dateRange?.start || !dateRange?.end) { setLoading(false); return }

      try {
        const { data: rows, error } = await supabase
          .from('lead_activity_log')
          .select('csr_name, opportunity_id')
          .gte('action_date', dateRange.start)
          .lte('action_date', dateRange.end)

        if (error) throw error

        const grouped = {}
        for (const row of rows || []) {
          if (!row.csr_name) continue
          if (!grouped[row.csr_name]) {
            grouped[row.csr_name] = new Set()
          }
          grouped[row.csr_name].add(row.opportunity_id)
        }

        const result = Object.entries(grouped)
          .map(([name, ids]) => ({
            csrName: name,
            leadCount: ids.size,
          }))
          .sort((a, b) => b.leadCount - a.leadCount)

        const total = result.reduce((sum, r) => sum + r.leadCount, 0)
        setTotalLeads(total)
        setData(result)
      } catch (err) {
        console.error('WorkloadDistribution fetch error:', err)
      }
      setLoading(false)
    }
    load()
  }, [dateRange?.start, dateRange?.end])

  if (loading) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-kanai-blue-light" />
      </div>
    )
  }

  if (!data || data.length === 0) return null

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null
    const d = payload[0].payload
    const pct = totalLeads > 0 ? Math.round((d.leadCount / totalLeads) * 100) : 0
    return (
      <div className="bg-slate-800 border border-card-border rounded-lg px-3 py-2 text-sm">
        <p className="text-slate-200 font-medium">{d.csrName}</p>
        <p className="text-slate-400">{d.leadCount} leads ({pct}%)</p>
      </div>
    )
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-400" />
        CSR Workload Distribution
      </h3>

      {/* Horizontal Bar Chart */}
      <div style={{ height: Math.max(data.length * 44, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
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
              dataKey="csrName"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="leadCount"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary below chart */}
      <div className="mt-4 pt-3 border-t border-card-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Total Leads</span>
          <span className="text-sm font-bold text-slate-200">{totalLeads}</span>
        </div>
        <div className="space-y-1.5">
          {data.map((row) => {
            const pct = totalLeads > 0 ? Math.round((row.leadCount / totalLeads) * 100) : 0
            return (
              <div key={row.csrName} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{row.csrName}</span>
                <span className="text-slate-300 font-medium">
                  {row.leadCount} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
