import { Wrench } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, NumberInput, DollarInput, Checkbox, Textarea } from '../shared/FormField'

export default function WorkizActivitySection({ formData, setField }) {
  return (
    <FormCard title="Workiz Activity" subtitle="Section 10 of 13 — Junk Removal" icon={Wrench}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <Label>Jobs Created</Label>
          <NumberInput
            value={formData.workiz_jobs_created}
            onChange={(v) => setField('workiz_jobs_created', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Jobs Completed</Label>
          <NumberInput
            value={formData.workiz_jobs_completed}
            onChange={(v) => setField('workiz_jobs_completed', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Payments Processed</Label>
          <NumberInput
            value={formData.workiz_payments_count}
            onChange={(v) => setField('workiz_payments_count', v)}
            placeholder="0"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label>Total Payments Amount</Label>
          <DollarInput
            value={formData.workiz_payments_total}
            onChange={(v) => setField('workiz_payments_total', v)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Checkbox
          label="Tomorrow's Workiz Schedule Verified?"
          checked={formData.workiz_tomorrow_verified}
          onChange={(e) => setField('workiz_tomorrow_verified', e.target.checked)}
        />
        <Checkbox
          label="Any Leads Needing Follow-Up in Workiz?"
          checked={formData.workiz_followup_needed}
          onChange={(e) => setField('workiz_followup_needed', e.target.checked)}
        />
      </div>

      <div className="mt-4">
        <Label>Workiz Notes</Label>
        <Textarea
          value={formData.workiz_notes}
          onChange={(e) => setField('workiz_notes', e.target.value)}
          placeholder="Any additional notes about junk removal activity..."
        />
      </div>
    </FormCard>
  )
}
