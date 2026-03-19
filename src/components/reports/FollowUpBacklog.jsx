import { useState, useEffect } from 'react'
import { Clock, Loader2, AlertCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function FollowUpBacklog() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }

      try {
        const { data: rows, error } = await supabase
          .from('ghl_followup_tasks')
          .select('*, csr_employees(name)')
          .eq('is_overdue', true)
          .order('due_date', { ascending: true })

        if (error) throw error

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const enriched = (rows || []).map((row) => {
          const dueDate = new Date(row.due_date)
          dueDate.setHours(0, 0, 0, 0)
          const diffMs = today - dueDate
          const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

          return {
            ...row,
            csrName: row.csr_employees?.name || 'Unassigned',
            daysOverdue,
          }
        }).sort((a, b) => b.daysOverdue - a.daysOverdue)

        setData(enriched)
      } catch (err) {
        console.error('FollowUpBacklog fetch error:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-gold" />
          Follow-Up Backlog
        </h3>
        <span className="flex items-center gap-1 text-xs font-semibold bg-accent-red/15 text-accent-red px-2.5 py-1 rounded-full">
          <AlertCircle className="w-3 h-3" />
          {data.length} overdue
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border">
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Contact Name</th>
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Due Date</th>
            <th className="text-center py-2 px-2 text-slate-400 font-medium text-xs uppercase">Days Overdue</th>
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Assigned CSR</th>
            <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs uppercase">Task Type</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const urgencyColor =
              row.daysOverdue >= 7
                ? 'text-red-400'
                : row.daysOverdue >= 3
                ? 'text-amber-400'
                : 'text-yellow-400'

            return (
              <tr key={row.id || i} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-2 text-slate-200">{row.contact_name || '--'}</td>
                <td className="py-3 px-2 text-slate-400 text-xs whitespace-nowrap">
                  {new Date(row.due_date).toLocaleDateString()}
                </td>
                <td className="py-3 px-2 text-center">
                  <span className={`font-bold ${urgencyColor}`}>
                    {row.daysOverdue}d
                  </span>
                </td>
                <td className="py-3 px-2 text-slate-300">{row.csrName}</td>
                <td className="py-3 px-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
                    {row.task_type || 'Follow-up'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
