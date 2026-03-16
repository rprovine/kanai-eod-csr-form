import { GitBranch, AlertTriangle } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Checkbox } from '../shared/FormField'
import { PIPELINE_CHECKS } from '../../lib/constants'

// Map pipeline check keys to relevant pipelineData counts (keys match API response)
const PIPELINE_CONTEXT = {
  pipeline_new_leads_contacted: { dataKey: 'new_leads_count', label: 'new leads' },
  pipeline_no_stale_leads: { dataKey: 'stale_count', label: 'stale', warnIfPositive: true },
  pipeline_booked_updated: { dataKey: 'booked_today', label: 'booked today' },
  pipeline_lost_updated: { dataKey: 'lost_today', label: 'lost today' },
  pipeline_quoted_followup_scheduled: null,
  pipeline_stages_match: null,
}

export default function PipelineCheckSection({ formData, setField, ghl }) {
  const checkedCount = PIPELINE_CHECKS.filter((ch) => formData[ch.key]).length
  const allChecked = checkedCount === PIPELINE_CHECKS.length
  const pipelineData = ghl?.pipelineData
  const staleLeads = pipelineData?.stale_leads || []
  const prematureLost = pipelineData?.premature_lost || []
  const minAttempts = pipelineData?.min_contact_attempts || 3

  // Derive counts that aren't direct API keys
  const enrichedData = pipelineData ? {
    ...pipelineData,
    new_leads_count: (pipelineData.stages?.['New Lead'] || pipelineData.stages?.['New'] || []).length,
  } : null

  return (
    <FormCard
      title="GHL Pipeline Status"
      subtitle="Section 11 of 14 — End-of-day pipeline hygiene"
      icon={GitBranch}
    >
      <div className="space-y-3">
        {PIPELINE_CHECKS.map((check) => {
          const ctx = PIPELINE_CONTEXT[check.key]
          const count = ctx && enrichedData ? enrichedData[ctx.dataKey] : null

          return (
            <div key={check.key} className="flex items-start gap-3">
              <div className="flex-1">
                <Checkbox
                  label={check.label}
                  checked={formData[check.key] || false}
                  onChange={(e) => setField(check.key, e.target.checked)}
                />
              </div>
              {count != null && count > 0 && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                  ctx.warnIfPositive
                    ? 'bg-accent-red/10 text-accent-red border border-accent-red/30'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                }`}>
                  {count} {ctx.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Premature Lost Warnings */}
      {prematureLost.length > 0 && (
        <div className="mt-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-accent-red shrink-0" />
            <span className="text-sm font-semibold text-accent-red">
              Insufficient Follow-Up Before Lost
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            These leads were moved to Lost with fewer than {minAttempts} contact attempts.
            Each lead must be contacted at least {minAttempts} times before marking as Lost.
          </p>
          <div className="space-y-1.5">
            {prematureLost.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium truncate">{lead.name || 'Unknown'}</span>
                <span className="text-accent-red font-medium shrink-0 ml-2">
                  {lead.attempts}/{lead.required} attempts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stale Leads Detail */}
      {staleLeads.length > 0 && (
        <div className="mt-4 p-3 bg-accent-red/5 border border-accent-red/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-accent-red shrink-0" />
            <span className="text-sm font-semibold text-accent-red">
              {staleLeads.length} Stale {staleLeads.length === 1 ? 'Lead' : 'Leads'} — Action Required
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            These leads haven't moved in over 48 hours. Follow up or update to Booked, Lost, or Not Qualified.
            Minimum {minAttempts} contact attempts required before moving to Lost.
          </p>
          <div className="space-y-1.5">
            {staleLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-200 font-medium truncate">{lead.name || 'Unknown'}</span>
                  <span className="text-slate-500 shrink-0">{lead.stage}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className={`font-medium ${lead.needsFollowUp ? 'text-accent-gold' : 'text-accent-green'}`}>
                    {lead.contactAttempts}/{minAttempts} contacts
                  </span>
                  <span className="text-accent-red font-medium">
                    {lead.daysSinceUpdate}d ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
        allChecked
          ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
          : 'bg-accent-gold/10 border border-accent-gold/30 text-accent-gold'
      }`}>
        {allChecked
          ? 'Pipeline is clean — all checks passed'
          : `${checkedCount}/${PIPELINE_CHECKS.length} pipeline checks completed`
        }
      </div>
    </FormCard>
  )
}
