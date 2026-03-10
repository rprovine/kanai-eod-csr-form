import { GitBranch, AlertTriangle } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Checkbox } from '../shared/FormField'
import { PIPELINE_CHECKS } from '../../lib/constants'

function PipelineContext({ pipelineData }) {
  if (!pipelineData) return null

  return (
    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {pipelineData.booked_today != null && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-accent-green">{pipelineData.booked_today}</div>
          <div className="text-[10px] text-accent-green/80 uppercase tracking-wide">Booked Today</div>
        </div>
      )}
      {pipelineData.lost_today != null && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-accent-red">{pipelineData.lost_today}</div>
          <div className="text-[10px] text-accent-red/80 uppercase tracking-wide">Lost Today</div>
        </div>
      )}
      {pipelineData.total != null && (
        <div className="bg-kanai-blue/10 border border-kanai-blue/30 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-kanai-blue">{pipelineData.total}</div>
          <div className="text-[10px] text-kanai-blue/80 uppercase tracking-wide">Total Pipeline</div>
        </div>
      )}
      {pipelineData.stale_count != null && pipelineData.stale_count > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-center">
          <div className="text-lg font-bold text-amber-400">{pipelineData.stale_count}</div>
          <div className="text-[10px] text-amber-400/80 uppercase tracking-wide">Stale Leads</div>
        </div>
      )}
    </div>
  )
}

export default function PipelineCheckSection({ formData, setField, ghl }) {
  const checkedCount = PIPELINE_CHECKS.filter((ch) => formData[ch.key]).length
  const allChecked = checkedCount === PIPELINE_CHECKS.length
  const pipelineData = ghl?.pipelineData || null

  return (
    <FormCard
      title="GHL Pipeline Status"
      subtitle="Section 11 of 13 — End-of-day pipeline hygiene"
      icon={GitBranch}
    >
      <PipelineContext pipelineData={pipelineData} />

      {pipelineData?.stale_leads?.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">Stale leads detected in GHL:</p>
            <ul className="mt-1 space-y-0.5">
              {pipelineData.stale_leads.slice(0, 5).map((lead, i) => (
                <li key={i} className="text-xs text-amber-400/80">
                  {lead.name} — {lead.stage} ({lead.daysSinceUpdate}d without update)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {PIPELINE_CHECKS.map((check) => (
          <Checkbox
            key={check.key}
            label={check.label}
            checked={formData[check.key] || false}
            onChange={(e) => setField(check.key, e.target.checked)}
          />
        ))}
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
