import { GitBranch } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Checkbox } from '../shared/FormField'
import { PIPELINE_CHECKS } from '../../lib/constants'

// Map pipeline check keys to relevant pipelineData counts
const PIPELINE_CONTEXT = {
  pipeline_new_leads_contacted: { dataKey: 'newLeads', label: 'new leads' },
  pipeline_no_stale_leads: { dataKey: 'staleLeads', label: 'stale', warnIfPositive: true },
  pipeline_booked_updated: { dataKey: 'bookedToday', label: 'booked today' },
  pipeline_lost_updated: { dataKey: 'lostToday', label: 'lost today' },
  pipeline_quoted_followup_scheduled: { dataKey: 'quotedOpen', label: 'quoted/open' },
  pipeline_stages_match: null,
}

export default function PipelineCheckSection({ formData, setField, ghl }) {
  const checkedCount = PIPELINE_CHECKS.filter((ch) => formData[ch.key]).length
  const allChecked = checkedCount === PIPELINE_CHECKS.length
  const pipelineData = ghl?.pipelineData

  return (
    <FormCard
      title="GHL Pipeline Status"
      subtitle="Section 11 of 13 — End-of-day pipeline hygiene"
      icon={GitBranch}
    >
      <div className="space-y-3">
        {PIPELINE_CHECKS.map((check) => {
          const ctx = PIPELINE_CONTEXT[check.key]
          const count = ctx && pipelineData ? pipelineData[ctx.dataKey] : null

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
