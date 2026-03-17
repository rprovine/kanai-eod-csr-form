import { Target } from 'lucide-react'

export default function LeadSourceBreakdown({ jobsBooked, workizRevenue }) {
  if (!jobsBooked || jobsBooked.length === 0) return null

  // Group jobs by lead_source
  const sourceMap = {}
  for (const job of jobsBooked) {
    const source = job.lead_source || 'Unknown'
    if (!sourceMap[source]) {
      sourceMap[source] = { source, count: 0, revenue: 0 }
    }
    sourceMap[source].count++
    const csrRev = parseFloat(job.estimated_revenue) || 0
    const workizRev = job.job_number ? (workizRevenue?.[job.job_number] || 0) : 0
    sourceMap[source].revenue += csrRev > 0 ? csrRev : workizRev
  }

  const sources = Object.values(sourceMap).sort((a, b) => b.revenue - a.revenue)
  const totalJobs = sources.reduce((sum, s) => sum + s.count, 0)
  const totalRevenue = sources.reduce((sum, s) => sum + s.revenue, 0)

  // Only show if we have lead sources with data
  const hasLeadSources = sources.some(s => s.source !== 'Unknown')
  if (!hasLeadSources && sources.length <= 1) return null

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-kanai-blue-light" />
        Lead Source Breakdown
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Lead Source</th>
              <th className="text-center py-2 px-3 text-slate-400 font-medium">Jobs Booked</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium">Revenue</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium">Avg Job Size</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.source} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 text-slate-200 font-medium">{s.source}</td>
                <td className="py-3 px-3 text-center text-slate-300">{s.count}</td>
                <td className="py-3 px-3 text-right text-slate-300">
                  {s.revenue > 0 ? `$${s.revenue.toLocaleString()}` : '--'}
                </td>
                <td className="py-3 px-3 text-right text-slate-400">
                  {s.revenue > 0 && s.count > 0
                    ? `$${Math.round(s.revenue / s.count).toLocaleString()}`
                    : '--'}
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="bg-slate-800/60 font-semibold">
              <td className="py-3 px-3 text-slate-200">Total</td>
              <td className="py-3 px-3 text-center text-slate-100">{totalJobs}</td>
              <td className="py-3 px-3 text-right text-slate-100">
                {totalRevenue > 0 ? `$${totalRevenue.toLocaleString()}` : '--'}
              </td>
              <td className="py-3 px-3 text-right text-slate-300">
                {totalRevenue > 0 && totalJobs > 0
                  ? `$${Math.round(totalRevenue / totalJobs).toLocaleString()}`
                  : '--'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
