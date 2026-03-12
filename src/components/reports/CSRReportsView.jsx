import { useState, useEffect, useCallback } from 'react'
import { Calendar, Download, Users, Phone, TrendingUp, Target, CheckCircle2, XCircle, Loader2, Trophy } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TABLES } from '../../lib/constants'
import { calcBookingRate, calcMissedCallRate, getPerformanceTier } from '../../lib/kpi-calculations'
import { fetchEmployees } from '../../lib/supabase-data'
import { DATE_PRESETS, getWeekRange, formatDisplayDate } from '../../lib/dateHelpers'

export default function CSRReportsView() {
  const [dateRange, setDateRange] = useState(() => getWeekRange(0))
  const [selectedPreset, setSelectedPreset] = useState('This Week')
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [reports, setReports] = useState([])
  const [jobsBooked, setJobsBooked] = useState([])
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Load employees on mount
  useEffect(() => {
    fetchEmployees().then(setEmployees)
  }, [])

  // Fetch reports for date range
  const loadReports = useCallback(async () => {
    if (!dateRange.start || !dateRange.end) return
    if (!isSupabaseConfigured()) {
      setReports([])
      setJobsBooked([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      let query = supabase
        .from(TABLES.eod_reports)
        .select('*, csr_employees!csr_eod_reports_employee_id_fkey(name)')
        .eq('status', 'submitted')
        .gte('report_date', dateRange.start)
        .lte('report_date', dateRange.end)
        .order('report_date', { ascending: true })

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee)
      }

      const { data, error } = await query
      if (error) throw error
      setReports(data || [])

      // Fetch jobs booked for these reports
      if (data && data.length > 0) {
        const reportIds = data.map(r => r.id)
        const { data: jobs, error: jobsError } = await supabase
          .from(TABLES.jobs_booked)
          .select('*')
          .in('eod_report_id', reportIds)
        if (!jobsError) setJobsBooked(jobs || [])
        else setJobsBooked([])
      } else {
        setJobsBooked([])
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
      setReports([])
      setJobsBooked([])
    }
    setIsLoading(false)
  }, [dateRange, selectedEmployee])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // Handle preset selection
  const handlePresetChange = (preset) => {
    setSelectedPreset(preset.label)
    if (preset.label !== 'Custom') {
      const range = preset.getValue()
      if (range) setDateRange(range)
    }
  }

  // Enrich reports with computed KPIs
  const enrichedReports = reports.map(r => {
    const bookingRate = calcBookingRate(
      r.disp_booked || 0, r.disp_quoted || 0,
      r.disp_followup_required || 0, r.disp_lost || 0
    )
    const missedCallRate = calcMissedCallRate(r.missed_calls || 0, r.total_inbound_calls || 0)
    const tier = getPerformanceTier(bookingRate)
    const jobCount = jobsBooked.filter(j => j.eod_report_id === r.id).length

    return {
      ...r,
      csrName: r.csr_employees?.name || 'Unknown',
      bookingRate: Math.round(bookingRate * 10) / 10,
      missedCallRate: Math.round(missedCallRate * 10) / 10,
      tier,
      jobCount,
    }
  })

  // Calculate totals
  const totals = enrichedReports.reduce((acc, r) => {
    acc.inbound += parseInt(r.total_inbound_calls) || 0
    acc.outbound += parseInt(r.total_outbound_calls) || 0
    acc.qualified += parseInt(r.total_qualified_calls) || 0
    acc.missed += parseInt(r.missed_calls) || 0
    acc.booked += parseInt(r.disp_booked) || 0
    acc.quoted += parseInt(r.disp_quoted) || 0
    acc.followup += parseInt(r.disp_followup_required) || 0
    acc.lost += parseInt(r.disp_lost) || 0
    acc.jobsBooked += r.jobCount
    return acc
  }, {
    inbound: 0, outbound: 0, qualified: 0, missed: 0,
    booked: 0, quoted: 0, followup: 0, lost: 0, jobsBooked: 0,
  })

  const avgBookingRate = enrichedReports.length > 0
    ? Math.round(enrichedReports.reduce((sum, r) => sum + r.bookingRate, 0) / enrichedReports.length * 10) / 10
    : 0
  const avgMissedRate = enrichedReports.length > 0
    ? Math.round(enrichedReports.reduce((sum, r) => sum + r.missedCallRate, 0) / enrichedReports.length * 10) / 10
    : 0

  // Per-CSR performance breakdown
  const csrPerformance = Object.values(
    enrichedReports.reduce((acc, r) => {
      const key = r.employee_id
      if (!acc[key]) {
        acc[key] = { name: r.csrName, reports: 0, totalBookingRate: 0, totalBooked: 0, totalQualified: 0, totalJobsBooked: 0 }
      }
      acc[key].reports++
      acc[key].totalBookingRate += r.bookingRate
      acc[key].totalBooked += parseInt(r.disp_booked) || 0
      acc[key].totalQualified += parseInt(r.total_qualified_calls) || 0
      acc[key].totalJobsBooked += r.jobCount
      return acc
    }, {})
  ).map(csr => ({
    ...csr,
    avgBookingRate: Math.round(csr.totalBookingRate / csr.reports * 10) / 10,
    tier: getPerformanceTier(csr.totalBookingRate / csr.reports),
  }))

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'CSR', 'Inbound', 'Outbound', 'Qualified', 'Booked', 'Quoted', 'Follow-up', 'Lost', 'Booking Rate', 'Missed Rate', 'Jobs Booked']
    const rows = enrichedReports.map(r => [
      r.report_date,
      r.csrName,
      r.total_inbound_calls || 0,
      r.total_outbound_calls || 0,
      r.total_qualified_calls || 0,
      r.disp_booked || 0,
      r.disp_quoted || 0,
      r.disp_followup_required || 0,
      r.disp_lost || 0,
      r.bookingRate + '%',
      r.missedCallRate + '%',
      r.jobCount,
    ])
    rows.push([
      'TOTAL', '', totals.inbound, totals.outbound, totals.qualified,
      totals.booked, totals.quoted, totals.followup, totals.lost,
      avgBookingRate + '%', avgMissedRate + '%', totals.jobsBooked,
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kanai-csr-report-${dateRange.start}-to-${dateRange.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100">CSR Reports</h2>
          <p className="text-sm text-slate-400">View submitted EOD report summaries</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={reports.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-green text-white font-medium text-sm
            hover:bg-accent-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date Range Controls */}
      <div className="p-4 rounded-xl bg-card-bg border border-card-border">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetChange(preset)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${selectedPreset === preset.label
                    ? 'bg-kanai-blue text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* CSR Filter */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-card-border bg-slate-800 text-sm text-slate-200 cursor-pointer"
            >
              <option value="all">All CSRs</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Date Inputs */}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }))
                setSelectedPreset('Custom')
              }}
              className="px-3 py-1.5 rounded-lg border border-card-border bg-slate-800 text-sm text-slate-200"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }))
                setSelectedPreset('Custom')
              }}
              className="px-3 py-1.5 rounded-lg border border-card-border bg-slate-800 text-sm text-slate-200"
            />
          </div>
        </div>

        {selectedEmployee !== 'all' && (
          <div className="mt-2 text-sm font-medium text-kanai-blue-light">
            Showing: {employees.find(e => e.id === selectedEmployee)?.name || selectedEmployee}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-kanai-blue-light" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && reports.length === 0 && (
        <div className="bg-card-bg border border-card-border rounded-xl p-8 text-center">
          <p className="text-slate-400">No submitted reports found for this date range.</p>
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && reports.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Total Qualified</span>
              </div>
              <div className="text-2xl font-bold">{totals.qualified}</div>
              <div className="text-xs opacity-60 mt-1">{reports.length} report{reports.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Avg Booking Rate</span>
              </div>
              <div className="text-2xl font-bold">{avgBookingRate}%</div>
              <div className="text-xs opacity-60 mt-1">Target: 60%+</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Total Jobs Booked</span>
              </div>
              <div className="text-2xl font-bold">{totals.jobsBooked}</div>
              <div className="text-xs opacity-60 mt-1">{totals.booked} dispositions booked</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Avg Missed Rate</span>
              </div>
              <div className="text-2xl font-bold">{avgMissedRate}%</div>
              <div className="text-xs opacity-60 mt-1">Target: Under 10%</div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">CSR</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">In</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Out</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Qual</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Booked</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Book %</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Miss %</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedReports.map(r => (
                    <tr key={r.id} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-300">{formatDisplayDate(r.report_date)}</td>
                      <td className="py-3 px-4 text-slate-200 font-medium">{r.csrName}</td>
                      <td className="py-3 px-3 text-center text-slate-300">{r.total_inbound_calls || 0}</td>
                      <td className="py-3 px-3 text-center text-slate-300">{r.total_outbound_calls || 0}</td>
                      <td className="py-3 px-3 text-center text-slate-100 font-semibold">{r.total_qualified_calls || 0}</td>
                      <td className="py-3 px-3 text-center text-slate-100 font-semibold">{r.disp_booked || 0}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-semibold ${r.tier.color}`}>{r.bookingRate}%</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-semibold ${r.missedCallRate < 10 ? 'text-accent-green' : 'text-accent-red'}`}>
                          {r.missedCallRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r.bookingRate >= 60
                          ? <CheckCircle2 className="w-4 h-4 text-accent-green mx-auto" />
                          : <XCircle className="w-4 h-4 text-accent-red mx-auto" />}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-800/60 font-semibold">
                    <td className="py-3 px-4 text-slate-200">TOTAL</td>
                    <td className="py-3 px-4 text-slate-400">{enrichedReports.length} reports</td>
                    <td className="py-3 px-3 text-center text-slate-200">{totals.inbound}</td>
                    <td className="py-3 px-3 text-center text-slate-200">{totals.outbound}</td>
                    <td className="py-3 px-3 text-center text-slate-100">{totals.qualified}</td>
                    <td className="py-3 px-3 text-center text-slate-100">{totals.booked}</td>
                    <td className="py-3 px-3 text-center text-kanai-blue-light">{avgBookingRate}%</td>
                    <td className="py-3 px-3 text-center text-slate-200">{avgMissedRate}%</td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-CSR Performance Breakdown */}
          {csrPerformance.length > 1 && (
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-accent-gold" />
                CSR Performance Breakdown
              </h3>
              <div className="space-y-3">
                {csrPerformance
                  .sort((a, b) => b.avgBookingRate - a.avgBookingRate)
                  .map(csr => (
                    <div key={csr.name} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-slate-200 truncate">{csr.name}</div>
                      <div className="flex-1">
                        <div className="h-6 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              csr.avgBookingRate >= 70 ? 'bg-accent-green' :
                              csr.avgBookingRate >= 60 ? 'bg-kanai-blue-light' :
                              csr.avgBookingRate >= 50 ? 'bg-accent-gold' : 'bg-accent-red'
                            }`}
                            style={{ width: `${Math.min(csr.avgBookingRate, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className={`w-16 text-right text-sm font-bold ${csr.tier.color}`}>
                        {csr.avgBookingRate}%
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        csr.tier.tier === 'elite' ? 'bg-accent-green/15 text-accent-green' :
                        csr.tier.tier === 'standard' ? 'bg-kanai-blue/15 text-kanai-blue-light' :
                        csr.tier.tier === 'developing' ? 'bg-accent-gold/15 text-accent-gold' :
                        'bg-accent-red/15 text-accent-red'
                      }`}>
                        {csr.tier.label}
                      </span>
                      <div className="w-20 text-right text-xs text-slate-400">
                        {csr.totalBooked} booked
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
