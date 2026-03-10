import { useState, useEffect, useMemo } from 'react'
import { Calendar, ChevronRight, Loader2, Search, CheckCircle2, XCircle } from 'lucide-react'
import FormCard from '../shared/FormCard'
import ReportDetail from './ReportDetail'
import { fetchReports, fetchReportDetail, fetchEmployees } from '../../lib/supabase-data'
import { calcAllKPIs } from '../../lib/kpi-calculations'

const DATE_RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

function getDateRange(rangeKey) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  switch (rangeKey) {
    case 'today':
      return { startDate: today, endDate: today }
    case 'week': {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      return { startDate: monday.toISOString().split('T')[0], endDate: today }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: first.toISOString().split('T')[0], endDate: today }
    }
    case 'all':
    default:
      return {}
  }
}

export default function ReportsView() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('week')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [employees, setEmployees] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchEmployees().then(data => {
      if (data.length > 0) setEmployees(data)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const filters = { ...getDateRange(dateRange) }
    if (employeeFilter) filters.employeeId = employeeFilter
    fetchReports(filters).then(data => {
      setReports(data)
      setLoading(false)
    })
  }, [dateRange, employeeFilter])

  const handleViewReport = async (reportId) => {
    setLoadingDetail(true)
    setSelectedReport(reportId)
    const detail = await fetchReportDetail(reportId)
    setDetailData(detail)
    setLoadingDetail(false)
  }

  const handleBack = () => {
    setSelectedReport(null)
    setDetailData(null)
  }

  const reportsWithKPIs = useMemo(() => {
    return reports.map(r => {
      const kpis = calcAllKPIs(r)
      return { ...r, kpis }
    })
  }, [reports])

  if (selectedReport) {
    if (loadingDetail) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-kanai-blue-light" />
        </div>
      )
    }
    return <ReportDetail report={detailData} onBack={handleBack} />
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <FormCard title="Reports" subtitle="View submitted CSR EOD reports" icon={Search}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {DATE_RANGES.map(range => (
              <button
                key={range.key}
                onClick={() => setDateRange(range.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  dateRange === range.key
                    ? 'bg-kanai-blue text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <select
            value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-card-border text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-kanai-blue"
          >
            <option value="">All CSRs</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      </FormCard>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-kanai-blue-light" />
          <span className="ml-2 text-sm text-slate-400">Loading reports...</span>
        </div>
      ) : reports.length === 0 ? (
        <FormCard>
          <p className="text-center text-slate-400 py-8">No reports found for the selected filters.</p>
        </FormCard>
      ) : (
        <div className="space-y-2">
          {reportsWithKPIs.map(report => (
            <button
              key={report.id}
              onClick={() => handleViewReport(report.id)}
              className="w-full text-left bg-card-bg border border-card-border rounded-xl p-4 hover:border-kanai-blue/50 hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100">{report.employee_name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      report.kpis.bonusEligible
                        ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                        : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                    }`}>
                      {report.kpis.bonusEligible ? (
                        <><CheckCircle2 className="w-3 h-3" /> Bonus</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> No Bonus</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {report.report_date}
                    </span>
                    <span className={report.kpis.performanceTier.color}>
                      {report.kpis.performanceTier.label}
                    </span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
                  <div className="text-center">
                    <div className="font-semibold text-slate-200">{report.kpis.bookingRate}%</div>
                    <div>Book Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-200">{report.kpis.qualifiedCalls}</div>
                    <div>Qual Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-200">{report.kpis.missedCallRate}%</div>
                    <div>Missed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-200">{report.disp_booked || 0}</div>
                    <div>Booked</div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
              </div>

              {/* Mobile Stats */}
              <div className="sm:hidden grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-card-border/50 text-xs text-slate-400">
                <div>
                  <div className="font-semibold text-slate-200">{report.kpis.bookingRate}%</div>
                  <div>Book %</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{report.kpis.qualifiedCalls}</div>
                  <div>Calls</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{report.kpis.missedCallRate}%</div>
                  <div>Missed</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{report.disp_booked || 0}</div>
                  <div>Booked</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
