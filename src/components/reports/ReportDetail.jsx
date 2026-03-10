import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import FormCard from '../shared/FormCard'
import KPIDashboardSection from '../eod-form/KPIDashboardSection'
import {
  DISPOSITION_TYPES,
  COMMUNICATION_CHANNELS,
  PIPELINE_CHECKS,
  JOB_TYPES,
  LEAD_SOURCES,
  EMAIL_SOURCES,
  EMAIL_STATUSES,
  YELP_STATUSES,
  FOLLOWUP_CHANNELS,
  FOLLOWUP_RESULTS,
  FOLLOWUP_ATTEMPT_OPTIONS,
  SPEED_TO_LEAD_OPTIONS,
} from '../../lib/constants'

function DataRow({ label, value }) {
  if (value === undefined || value === null || value === '' || value === 0) return null
  return (
    <div className="flex justify-between py-1.5 border-b border-card-border/30">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  )
}

function CheckRow({ label, checked }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={`w-4 h-4 rounded flex items-center justify-center text-xs ${
        checked ? 'bg-accent-green/20 text-accent-green' : 'bg-slate-800 text-slate-600'
      }`}>
        {checked ? '\u2713' : ''}
      </div>
      <span className={`text-sm ${checked ? 'text-slate-200' : 'text-slate-500'}`}>{label}</span>
    </div>
  )
}

export default function ReportDetail({ report, onBack }) {
  if (!report) {
    return (
      <FormCard>
        <p className="text-center text-slate-400 py-8">Report not found.</p>
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-kanai-blue-light hover:underline mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to reports
        </button>
      </FormCard>
    )
  }

  const speedLabel = SPEED_TO_LEAD_OPTIONS.find(o => o.value === report.speed_to_lead)?.label || report.speed_to_lead || 'Not set'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-100">{report.employee_name || 'Unknown'}</h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {report.report_date}
            </span>
            {report.shift_start && report.shift_end && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {report.shift_start} - {report.shift_end}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Dashboard */}
      <KPIDashboardSection formData={report} />

      {/* Communications */}
      <FormCard title="Communications Checklist">
        <div className="space-y-1">
          {COMMUNICATION_CHANNELS.map(ch => (
            <CheckRow key={ch.key} label={ch.label} checked={report[ch.key]} />
          ))}
        </div>
      </FormCard>

      {/* Call Metrics */}
      <FormCard title="Call Metrics">
        <div className="space-y-1">
          <DataRow label="Total Inbound Calls" value={report.total_inbound_calls} />
          <DataRow label="Total Outbound Calls" value={report.total_outbound_calls} />
          <DataRow label="Total Qualified Calls" value={report.total_qualified_calls} />
          <DataRow label="Missed Calls" value={report.missed_calls} />
          <DataRow label="Speed-to-Lead" value={speedLabel} />
        </div>
      </FormCard>

      {/* Dispositions */}
      <FormCard title="Dispositions">
        <div className="space-y-1">
          {DISPOSITION_TYPES.map(d => (
            <DataRow key={d.key} label={d.label} value={report[d.key]} />
          ))}
        </div>
      </FormCard>

      {/* Jobs Booked */}
      {report.jobs_booked?.length > 0 && (
        <FormCard title="Jobs Booked">
          <div className="space-y-3">
            {report.jobs_booked.map((job, idx) => (
              <div key={job.id || idx} className="p-3 bg-slate-800/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200">{job.customer_name || 'Unknown'}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-kanai-blue/20 text-kanai-blue-light">
                    {JOB_TYPES.find(t => t.value === job.job_type)?.label || job.job_type}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                    {LEAD_SOURCES.find(s => s.value === job.lead_source)?.label || job.lead_source}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {job.job_number && <span>#{job.job_number}</span>}
                  {job.job_value > 0 && <span>${job.job_value}</span>}
                  {job.notes && <span>{job.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </FormCard>
      )}

      {/* Email Submissions */}
      {report.email_submissions?.length > 0 && (
        <FormCard title="Email Submissions">
          <div className="space-y-3">
            {report.email_submissions.map((email, idx) => (
              <div key={email.id || idx} className="p-3 bg-slate-800/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200">{email.customer_name || 'Unknown'}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                    {EMAIL_SOURCES.find(s => s.value === email.source)?.label || email.source}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    email.status === 'booked' ? 'bg-accent-green/20 text-accent-green' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {EMAIL_STATUSES.find(s => s.value === email.status)?.label || email.status}
                  </span>
                </div>
                {email.notes && <p className="text-xs text-slate-400">{email.notes}</p>}
              </div>
            ))}
          </div>
        </FormCard>
      )}

      {/* Yelp Leads */}
      {report.yelp_leads?.length > 0 && (
        <FormCard title="Yelp Leads">
          <div className="space-y-3">
            {report.yelp_leads.map((lead, idx) => (
              <div key={lead.id || idx} className="p-3 bg-slate-800/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200">{lead.customer_name || 'Unknown'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    lead.status === 'booked' ? 'bg-accent-green/20 text-accent-green' :
                    lead.status === 'lost' || lead.status === 'not_qualified' ? 'bg-accent-red/20 text-accent-red' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {YELP_STATUSES.find(s => s.value === lead.status)?.label || lead.status}
                  </span>
                </div>
                {lead.notes && <p className="text-xs text-slate-400">{lead.notes}</p>}
              </div>
            ))}
          </div>
        </FormCard>
      )}

      {/* Follow-Ups */}
      {report.followups?.length > 0 && (
        <FormCard title="Follow-Ups">
          <div className="space-y-3">
            {report.followups.map((fu, idx) => (
              <div key={fu.id || idx} className="p-3 bg-slate-800/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200">{fu.customer_name || 'Unknown'}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                    {FOLLOWUP_ATTEMPT_OPTIONS.find(a => a.value === fu.attempt_number)?.label || `Attempt ${fu.attempt_number}`}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-kanai-blue/20 text-kanai-blue-light">
                    {FOLLOWUP_CHANNELS.find(c => c.value === fu.channel)?.label || fu.channel}
                  </span>
                  {fu.result && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      fu.result === 'booked' ? 'bg-accent-green/20 text-accent-green' :
                      fu.result === 'declined' || fu.result === 'moved_to_lost' ? 'bg-accent-red/20 text-accent-red' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {FOLLOWUP_RESULTS.find(r => r.value === fu.result)?.label || fu.result}
                    </span>
                  )}
                </div>
                {fu.notes && <p className="text-xs text-slate-400">{fu.notes}</p>}
              </div>
            ))}
          </div>
        </FormCard>
      )}

      {/* Docket Activity */}
      <FormCard title="Docket Activity">
        <div className="space-y-1">
          <DataRow label="Clients Created" value={report.docket_clients_created} />
          <DataRow label="Agreements Sent" value={report.docket_agreements_sent} />
          <CheckRow label="Asset Availability Verified" checked={report.docket_asset_availability_verified} />
        </div>
      </FormCard>

      {/* Workiz Activity */}
      <FormCard title="Workiz Activity">
        <div className="space-y-1">
          <DataRow label="Jobs Created" value={report.workiz_jobs_created} />
          <DataRow label="Jobs Completed" value={report.workiz_jobs_completed} />
          <CheckRow label="Tomorrow's Schedule Verified" checked={report.workiz_tomorrow_verified} />
        </div>
      </FormCard>

      {/* Pipeline Checks */}
      <FormCard title="GHL Pipeline Checks">
        <div className="space-y-1">
          {PIPELINE_CHECKS.map(ch => (
            <CheckRow key={ch.key} label={ch.label} checked={report[ch.key]} />
          ))}
        </div>
      </FormCard>

      {/* Notes */}
      {(report.issues || report.management_attention || report.suggestions || report.carried_over) && (
        <FormCard title="Notes">
          <div className="space-y-3">
            {report.issues && (
              <div>
                <h5 className="text-xs font-medium text-slate-400 mb-1">Issues & Blockers</h5>
                <p className="text-sm text-slate-200">{report.issues}</p>
              </div>
            )}
            {report.management_attention && (
              <div>
                <h5 className="text-xs font-medium text-slate-400 mb-1">Management Attention</h5>
                <p className="text-sm text-slate-200">{report.management_attention}</p>
              </div>
            )}
            {report.suggestions && (
              <div>
                <h5 className="text-xs font-medium text-slate-400 mb-1">Suggestions</h5>
                <p className="text-sm text-slate-200">{report.suggestions}</p>
              </div>
            )}
            {report.carried_over && (
              <div>
                <h5 className="text-xs font-medium text-slate-400 mb-1">Carried Over to Tomorrow</h5>
                <p className="text-sm text-slate-200">{report.carried_over}</p>
              </div>
            )}
          </div>
        </FormCard>
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl bg-slate-800 border border-card-border text-slate-300 font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reports
      </button>
    </div>
  )
}
