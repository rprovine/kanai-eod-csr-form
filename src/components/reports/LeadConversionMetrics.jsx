import { useState, useEffect } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function LeadConversionMetrics({ dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      if (!dateRange?.start || !dateRange?.end) { setLoading(false); return }

      try {
        const { data: rows, error } = await supabase
          .from('lead_activity_log')
          .select('csr_name, opportunity_id, action')
          .gte('action_date', dateRange.start)
          .lte('action_date', dateRange.end)

        if (error) throw error

        const grouped = {}
        for (const row of rows || []) {
          if (!row.csr_name) continue
          if (!grouped[row.csr_name]) {
            grouped[row.csr_name] = { leads: new Set(), booked: 0 }
          }
          grouped[row.csr_name].leads.add(row.opportunity_id)
          if (row.action === 'booked') {
            grouped[row.csr_name].booked += 1
          }
        }

        const result = Object.entries(grouped)
          .map(([name, stats]) => ({
            csrName: name,
            leadsWorked: stats.leads.size,
            booked: stats.booked,
            conversionRate: stats.leads.size > 0
              ? Math.round((stats.booked / stats.leads.size) * 100)
              : 0,
          }))
          .sort((a, b) => b.conversionRate - a.conversionRate)

        setData(result)
      } catch (err) {
        console.error('LeadConversionMetrics fetch error:', err)
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

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent-green" />
        Lead Conversion by CSR
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border">
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">CSR Name</th>
            <th className="text-center py-2 px-2 text-slate-400 font-medium text-xs uppercase">Qualified Leads</th>
            <th className="text-center py-2 px-2 text-slate-400 font-medium text-xs uppercase">Booked</th>
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Conversion Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const barColor =
              row.conversionRate >= 60
                ? 'bg-accent-green'
                : row.conversionRate >= 40
                ? 'bg-accent-gold'
                : 'bg-accent-red'
            const textColor =
              row.conversionRate >= 60
                ? 'text-accent-green'
                : row.conversionRate >= 40
                ? 'text-accent-gold'
                : 'text-accent-red'

            return (
              <tr key={row.csrName} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-2 text-slate-200 font-medium">{row.csrName}</td>
                <td className="py-3 px-2 text-center text-slate-300">{row.leadsWorked}</td>
                <td className="py-3 px-2 text-center text-slate-100 font-semibold">{row.booked}</td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(row.conversionRate, 100)}%` }}
                      />
                    </div>
                    <span className={`font-bold text-sm w-12 text-right ${textColor}`}>
                      {row.conversionRate}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
