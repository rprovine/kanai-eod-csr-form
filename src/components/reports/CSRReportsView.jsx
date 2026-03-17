import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, Download, Users, Phone, TrendingUp, Target, CheckCircle2, XCircle, Loader2, Trophy, MessageSquare, Clock, DollarSign, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TABLES } from '../../lib/constants'
import { calcBookingRate, calcMissedCallRate, getPerformanceTier, calcGuardrailDeductions, calcAcceleratorBonus } from '../../lib/kpi-calculations'
import { fetchEmployees } from '../../lib/supabase-data'
import { DATE_PRESETS, getWeekRange, formatDisplayDate, getCurrentPayPeriod } from '../../lib/dateHelpers'
import CSRLeaderboard from './CSRLeaderboard'
import LeadSourceBreakdown from './LeadSourceBreakdown'
import PipelineDashboard from './PipelineDashboard'

export default function CSRReportsView() {
  const [dateRange, setDateRange] = useState(() => getWeekRange(0))
  const [selectedPreset, setSelectedPreset] = useState('This Week')
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [reports, setReports] = useState([])
  const [jobsBooked, setJobsBooked] = useState([])
  const [workizRevenue, setWorkizRevenue] = useState({}) // job_number → revenue from field supervisor data
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
        if (!jobsError) {
          setJobsBooked(jobs || [])

          // Cross-reference with junk_removal_jobs for actual revenue
          const jobNumbers = (jobs || [])
            .map(j => j.job_number)
            .filter(Boolean)
          if (jobNumbers.length > 0) {
            const { data: jrJobs } = await supabase
              .from('junk_removal_jobs')
              .select('job_number, revenue')
              .in('job_number', jobNumbers)
            if (jrJobs) {
              const revenueMap = {}
              for (const jr of jrJobs) {
                if (jr.job_number && jr.revenue > 0) {
                  revenueMap[jr.job_number] = parseFloat(jr.revenue)
                }
              }
              setWorkizRevenue(revenueMap)
            }
          }
        } else {
          setJobsBooked([])
        }
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
    const accelerators = calcAcceleratorBonus(r)
    const guardrails = calcGuardrailDeductions(r)
    const revenue = jobsBooked
      .filter(j => j.eod_report_id === r.id)
      .reduce((sum, j) => {
        // Use CSR-entered revenue first, fall back to actual Workiz revenue from field supervisor data
        const csrRev = parseFloat(j.estimated_revenue) || 0
        const workizRev = j.job_number ? (workizRevenue[j.job_number] || 0) : 0
        return sum + (csrRev > 0 ? csrRev : workizRev)
      }, 0)

    return {
      ...r,
      csrName: r.csr_employees?.name || 'Unknown',
      bookingRate: Math.round(bookingRate * 10) / 10,
      missedCallRate: Math.round(missedCallRate * 10) / 10,
      tier,
      jobCount,
      accelerators,
      guardrails,
      revenue,
    }
  })

  // Calculate totals
  const totals = enrichedReports.reduce((acc, r) => {
    acc.inbound += parseInt(r.total_inbound_calls) || 0
    acc.outbound += parseInt(r.total_outbound_calls) || 0
    acc.missed += parseInt(r.missed_calls) || 0
    acc.booked += parseInt(r.disp_booked) || 0
    acc.quoted += parseInt(r.disp_quoted) || 0
    acc.followup += parseInt(r.disp_followup_required) || 0
    acc.lost += parseInt(r.disp_lost) || 0
    acc.jobsBooked += r.jobCount
    acc.smsSent += parseInt(r.total_sms_sent) || 0
    acc.smsReceived += parseInt(r.total_sms_received) || 0
    acc.fbReceived += parseInt(r.total_fb_messages_received) || 0
    acc.igReceived += parseInt(r.total_ig_messages_received) || 0
    acc.msgsSent += parseInt(r.total_messages_sent) || 0
    acc.msgsReceived += parseInt(r.total_messages_received) || 0
    acc.upsells += parseInt(r.upsell_count) || 0
    acc.reviews += parseInt(r.review_assists) || 0
    acc.winbacks += parseInt(r.winback_bookings) || 0
    acc.cancellations += parseInt(r.cancellation_count) || 0
    acc.noShows += parseInt(r.noshow_count) || 0
    acc.acceleratorBonus += r.accelerators.totalAccelerator
    acc.revenue += r.revenue
    if (r.speed_to_lead_minutes != null && r.speed_to_lead_minutes > 0) {
      acc.stlSum += r.speed_to_lead_minutes
      acc.stlCount++
    }
    return acc
  }, {
    inbound: 0, outbound: 0, missed: 0,
    booked: 0, quoted: 0, followup: 0, lost: 0, jobsBooked: 0,
    smsSent: 0, smsReceived: 0, fbReceived: 0, igReceived: 0, msgsSent: 0, msgsReceived: 0,
    upsells: 0, reviews: 0, winbacks: 0, cancellations: 0, noShows: 0,
    acceleratorBonus: 0, revenue: 0,
    stlSum: 0, stlCount: 0,
  })

  // Use aggregate booking rate (total booked / total qualified leads) — not average of daily rates
  const totalQualified = totals.booked + totals.quoted + totals.followup + totals.lost
  const avgBookingRate = totalQualified > 0
    ? Math.round((totals.booked / totalQualified) * 1000) / 10
    : 0
  const avgMissedRate = enrichedReports.length > 0
    ? Math.round(enrichedReports.reduce((sum, r) => sum + r.missedCallRate, 0) / enrichedReports.length * 10) / 10
    : 0
  const avgStl = totals.stlCount > 0
    ? Math.round(totals.stlSum / totals.stlCount * 10) / 10
    : null

  // Pay period bonus calculation
  const payPeriodTier = getPerformanceTier(avgBookingRate)
  const payPeriodPerBookingBonus = payPeriodTier.perBooking * totals.booked
  const payPeriodCancellationRate = totals.booked > 0 ? (totals.cancellations / totals.booked) * 100 : 0
  const payPeriodNoshowRate = totals.booked > 0 ? (totals.noShows / totals.booked) * 100 : 0
  let payPeriodMultiplier = 1.0
  if (payPeriodCancellationRate > 20) payPeriodMultiplier *= 0.5
  if (payPeriodNoshowRate > 15) payPeriodMultiplier *= 0.75
  const adjustedPerBookingBonus = Math.round(payPeriodPerBookingBonus * payPeriodMultiplier)
  const payPeriodTotalBonus = adjustedPerBookingBonus + payPeriodTier.tierBonus + totals.acceleratorBonus

  // Revenue milestone check
  const revenueMilestoneBonus = totals.revenue >= 75000 ? 300 : totals.revenue >= 50000 ? 150 : 0

  // Per-CSR performance breakdown
  const csrPerformance = Object.values(
    enrichedReports.reduce((acc, r) => {
      const key = r.employee_id
      if (!acc[key]) {
        acc[key] = { name: r.csrName, reports: 0, totalBookingRate: 0, totalBooked: 0, totalJobsBooked: 0, totalRevenue: 0, totalStl: 0, stlCount: 0 }
      }
      acc[key].reports++
      acc[key].totalBookingRate += r.bookingRate
      acc[key].totalBooked += parseInt(r.disp_booked) || 0
      acc[key].totalJobsBooked += r.jobCount
      acc[key].totalRevenue += r.revenue
      acc[key].totalStl += r.speed_to_lead_minutes || 0
      acc[key].stlCount += (r.speed_to_lead_minutes > 0 ? 1 : 0)
      return acc
    }, {})
  ).map(csr => ({
    ...csr,
    avgBookingRate: Math.round(csr.totalBookingRate / csr.reports * 10) / 10,
    avgStl: csr.stlCount > 0 ? Math.round(csr.totalStl / csr.stlCount * 10) / 10 : null,
    tier: getPerformanceTier(csr.totalBookingRate / csr.reports),
  }))

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'Date', 'CSR', 'Inbound', 'Outbound', 'Missed',
      'SMS Sent', 'SMS Received', 'FB Sent', 'FB Received', 'IG Sent', 'IG Received',
      'Total Msgs Sent', 'Total Msgs Received',
      'Booked', 'Quoted', 'Follow-up', 'Lost',
      'Booking Rate', 'Missed Rate', 'Speed-to-Lead (min)', 'Jobs Booked',
      'Revenue', 'Upsells', 'Review Assists', 'Win-Backs', 'Cancellations', 'No-Shows',
    ]
    const rows = enrichedReports.map(r => [
      r.report_date,
      r.csrName,
      r.total_inbound_calls || 0,
      r.total_outbound_calls || 0,
      r.missed_calls || 0,
      r.total_sms_sent || 0,
      r.total_sms_received || 0,
      r.total_fb_messages_sent || 0,
      r.total_fb_messages_received || 0,
      r.total_ig_messages_sent || 0,
      r.total_ig_messages_received || 0,
      r.total_messages_sent || 0,
      r.total_messages_received || 0,
      r.disp_booked || 0,
      r.disp_quoted || 0,
      r.disp_followup_required || 0,
      r.disp_lost || 0,
      r.bookingRate + '%',
      r.missedCallRate + '%',
      r.speed_to_lead_minutes != null ? r.speed_to_lead_minutes : '',
      r.jobCount,
      r.revenue,
      r.upsell_count || 0,
      r.review_assists || 0,
      r.winback_bookings || 0,
      r.cancellation_count || 0,
      r.noshow_count || 0,
    ])
    rows.push([
      'TOTAL', '', totals.inbound, totals.outbound, totals.missed,
      totals.smsSent, totals.smsReceived, '', '', '', '',
      totals.msgsSent, totals.msgsReceived,
      totals.booked, totals.quoted, totals.followup, totals.lost,
      avgBookingRate + '%', avgMissedRate + '%', avgStl != null ? avgStl : '',
      totals.jobsBooked,
      totals.revenue, totals.upsells, totals.reviews, totals.winbacks,
      totals.cancellations, totals.noShows,
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

      {/* Pipeline Dashboard */}
      {!isLoading && reports.length > 0 && (
        <PipelineDashboard totals={totals} />
      )}

      {/* Summary Cards */}
      {!isLoading && reports.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Avg Booking Rate</span>
              </div>
              <div className="text-2xl font-bold">{avgBookingRate}%</div>
              <div className="text-xs opacity-60 mt-1">{payPeriodTier.label}</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Total Booked</span>
              </div>
              <div className="text-2xl font-bold">{totals.booked}</div>
              <div className="text-xs opacity-60 mt-1">{totals.jobsBooked} jobs logged</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Revenue</span>
              </div>
              <div className="text-2xl font-bold">${totals.revenue.toLocaleString()}</div>
              <div className="text-xs opacity-60 mt-1">
                {revenueMilestoneBonus > 0 ? `+$${revenueMilestoneBonus} milestone` : `$${(50000 - totals.revenue).toLocaleString()} to milestone`}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Messages</span>
              </div>
              <div className="text-2xl font-bold">{totals.msgsSent + totals.msgsReceived}</div>
              <div className="text-xs opacity-60 mt-1">{totals.msgsSent} sent / {totals.msgsReceived} recv</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Avg Speed-to-Lead</span>
              </div>
              <div className="text-2xl font-bold">{avgStl != null ? `${avgStl}m` : '--'}</div>
              <div className="text-xs opacity-60 mt-1">Target: Under 5 min</div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80">Est. Bonus</span>
              </div>
              <div className="text-2xl font-bold">${payPeriodTotalBonus + revenueMilestoneBonus}</div>
              <div className="text-xs opacity-60 mt-1">
                {payPeriodMultiplier < 1 ? 'Guardrails applied' : `${payPeriodTier.label} tier`}
              </div>
            </div>
          </div>

          {/* Pay Period Bonus Breakdown */}
          {(selectedPreset === 'Pay Period' || selectedPreset === 'Last Pay Period' || enrichedReports.length >= 5) && (
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-accent-gold mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Bonus Breakdown ({dateRange.start} to {dateRange.end})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Per-Booking</p>
                  <p className="text-slate-100 font-semibold">
                    {totals.booked} x ${payPeriodTier.perBooking} = ${payPeriodPerBookingBonus}
                    {payPeriodMultiplier < 1 && (
                      <span className="text-accent-red text-xs block">
                        After guardrails: ${adjustedPerBookingBonus}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Tier Bonus</p>
                  <p className="text-slate-100 font-semibold">${payPeriodTier.tierBonus}</p>
                </div>
                <div>
                  <p className="text-slate-400">Accelerators</p>
                  <p className="text-slate-100 font-semibold">
                    ${totals.acceleratorBonus}
                    <span className="text-xs text-slate-500 block">
                      {totals.upsells} upsells, {totals.reviews} reviews, {totals.winbacks} winbacks
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Revenue Milestone</p>
                  <p className="text-slate-100 font-semibold">
                    ${revenueMilestoneBonus}
                    <span className="text-xs text-slate-500 block">
                      {totals.revenue >= 75000 ? '$75K reached' : totals.revenue >= 50000 ? '$50K reached' : `$${totals.revenue.toLocaleString()} / $50K`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Guardrail warnings */}
              {(payPeriodCancellationRate > 20 || payPeriodNoshowRate > 15) && (
                <div className="mt-3 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-accent-red">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      {payPeriodCancellationRate > 20 && (
                        <p>Cancellation rate: {Math.round(payPeriodCancellationRate)}% — bonus reduced 50%</p>
                      )}
                      {payPeriodNoshowRate > 15 && (
                        <p>No-show rate: {Math.round(payPeriodNoshowRate)}% — bonus reduced 25%</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-card-border flex justify-between items-center">
                <span className="text-accent-gold font-semibold">Estimated Total Bonus</span>
                <span className="text-accent-gold font-bold text-xl">${payPeriodTotalBonus + revenueMilestoneBonus}</span>
              </div>
            </div>
          )}

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
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Msgs</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Booked</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Book %</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Miss %</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">STL</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Rev</th>
                    <th className="text-center py-3 px-3 text-slate-400 font-medium">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedReports.map(r => {
                    const msgsTotal = (parseInt(r.total_messages_sent) || 0) + (parseInt(r.total_messages_received) || 0)
                    const stlMin = r.speed_to_lead_minutes != null && r.speed_to_lead_minutes > 0 ? r.speed_to_lead_minutes : null
                    const dailyBonus = r.accelerators.totalAccelerator +
                      (r.bookingRate >= 60 ? (r.disp_booked || 0) * r.tier.perBooking : 0)

                    return (
                      <tr key={r.id} className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-300">{formatDisplayDate(r.report_date)}</td>
                        <td className="py-3 px-4 text-slate-200 font-medium">{r.csrName}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{r.total_inbound_calls || 0}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{r.total_outbound_calls || 0}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{msgsTotal || '--'}</td>
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
                          {stlMin != null ? (
                            <span className={`font-semibold ${stlMin < 5 ? 'text-accent-green' : stlMin < 10 ? 'text-accent-gold' : 'text-accent-red'}`}>
                              {stlMin}m
                            </span>
                          ) : '--'}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">
                          {r.revenue > 0 ? `$${r.revenue.toLocaleString()}` : '--'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {dailyBonus > 0 ? (
                            <span className="text-accent-gold font-medium">${dailyBonus}</span>
                          ) : (
                            r.bookingRate >= 60
                              ? <CheckCircle2 className="w-4 h-4 text-accent-green mx-auto" />
                              : <XCircle className="w-4 h-4 text-accent-red mx-auto" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals Row */}
                  <tr className="bg-slate-800/60 font-semibold">
                    <td className="py-3 px-4 text-slate-200">TOTAL</td>
                    <td className="py-3 px-4 text-slate-400">{enrichedReports.length} reports</td>
                    <td className="py-3 px-3 text-center text-slate-200">{totals.inbound}</td>
                    <td className="py-3 px-3 text-center text-slate-200">{totals.outbound}</td>
                    <td className="py-3 px-3 text-center text-slate-200">{totals.msgsSent + totals.msgsReceived}</td>
                    <td className="py-3 px-3 text-center text-slate-100">{totals.booked}</td>
                    <td className="py-3 px-3 text-center text-kanai-blue-light">{avgBookingRate}%</td>
                    <td className="py-3 px-3 text-center text-slate-200">{avgMissedRate}%</td>
                    <td className="py-3 px-3 text-center text-slate-200">{avgStl != null ? `${avgStl}m` : '--'}</td>
                    <td className="py-3 px-3 text-center text-slate-200">${totals.revenue.toLocaleString()}</td>
                    <td className="py-3 px-3 text-center text-accent-gold font-bold">
                      ${payPeriodTotalBonus + revenueMilestoneBonus}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-CSR Leaderboard */}
          <CSRLeaderboard csrPerformance={csrPerformance} />

          {/* Lead Source Breakdown */}
          <LeadSourceBreakdown jobsBooked={jobsBooked} workizRevenue={workizRevenue} />
        </>
      )}
    </div>
  )
}
