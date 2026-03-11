import { GitBranch } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Checkbox } from '../shared/FormField'
import { PIPELINE_CHECKS } from '../../lib/constants'

export default function PipelineCheckSection({ formData, setField }) {
  const checkedCount = PIPELINE_CHECKS.filter((ch) => formData[ch.key]).length
  const allChecked = checkedCount === PIPELINE_CHECKS.length

  return (
    <FormCard
      title="GHL Pipeline Status"
      subtitle="Section 11 of 13 — End-of-day pipeline hygiene"
      icon={GitBranch}
    >
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
