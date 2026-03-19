import { useState, useEffect } from 'react'
import { ShieldAlert, Loader2, AlertTriangle, XCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function QualityScorecard({ dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ lost: 0, unanswered: 0 })

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      if (!dateRange?.start || !dateRange?.end) { setLoading(false); return }

      try {
        const [lostRes, unansweredRes] = await Promise.all([
          supabase
            .from('premature_lost_alerts')
            .select('*')
            .gte('alert_date', dateRange.start)
            .lte('alert_date', dateRange.end)
            .order('alert_date', { ascending: false }),
          supabase
            .from('unanswered_lead_alerts')
            .select('*')
            .gte('alert_date', dateRange.start)
            .lte('alert_date', dateRange.end)
            .order('alert_date', { ascending: false }),
        ])

        if (lostRes.error) throw lostRes.error
        if (unansweredRes.error) throw unansweredRes.error

        const lostAlerts = (lostRes.data || []).map((a) => ({
          ...a,
          type: 'Lost',
          details: a.reason || a.details || 'Premature lost - no follow-up recorded',
        }))

        const unansweredAlerts = (unansweredRes.data || []).map((a) => ({
          ...a,
          type: 'Unanswered',
          details: a.reason || a.details || 'Lead went unanswered beyond SLA',
        }))

        setTotals({
          lost: lostAlerts.length,
          unanswered: unansweredAlerts.length,
        })

        const combined = [...lostAlerts, ...unansweredAlerts].sort(
          (a, b) => new Date(b.alert_date) - new Date(a.alert_date)
        )

        setData(combined)
      } catch (err) {
        console.error('QualityScorecard fetch error:', err)
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
        <ShieldAlert className="w-4 h-4 text-accent-red" />
        Quality Scorecard
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <p className="text-xs text-red-400">Premature Lost</p>
          </div>
          <p className="text-2xl font-bold text-red-300">{totals.lost}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs text-amber-400">Unanswered</p>
          </div>
          <p className="text-2xl font-bold text-amber-300">{totals.unanswered}</p>
        </div>
      </div>

      {/* Alert Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border">
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Date</th>
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Contact Name</th>
            <th className="text-center py-2 px-2 text-slate-400 font-medium text-xs uppercase">Type</th>
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Details</th>
          </tr>
        </thead>
        <tbody>
          {data.map((alert, i) => (
            <tr key={`${alert.type}-${i}`} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-3 px-2 text-slate-400 text-xs whitespace-nowrap">
                {new Date(alert.alert_date).toLocaleDateString()}
              </td>
              <td className="py-3 px-2 text-slate-200">
                {alert.contact_name || '--'}
              </td>
              <td className="py-3 px-2 text-center">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    alert.type === 'Lost'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {alert.type}
                </span>
              </td>
              <td className="py-3 px-2 text-slate-400 text-xs max-w-xs truncate">
                {alert.details}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
