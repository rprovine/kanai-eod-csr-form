import { RotateCcw, Info } from 'lucide-react'
import FormCard from '../shared/FormCard'
import RepeatableEntry from '../shared/RepeatableEntry'
import { Label, Input, Select } from '../shared/FormField'
import { FOLLOWUP_ATTEMPT_OPTIONS, FOLLOWUP_TIMING_OPTIONS, FOLLOWUP_CHANNELS, FOLLOWUP_RESULTS } from '../../lib/constants'
import { getDefaultFollowupEntry } from '../../lib/form-defaults'

export default function FollowUpsSection({ formData, addArrayItem, updateArrayItem, removeArrayItem }) {
  return (
    <FormCard title="Estimate Follow-Ups" subtitle="Section 8 of 14" icon={RotateCcw}>
      {/* Follow-up schedule reminder */}
      <div className="mb-4 bg-ghl-purple/10 border border-ghl-purple/30 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-ghl-purple shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-ghl-purple">Follow-Up Schedule</p>
            <p>1. 2 hours after quote — Soft follow-up SMS via GHL</p>
            <p>2. Next day — Second follow-up with urgency</p>
            <p>3. Day 3 — Final soft close SMS</p>
            <p>4. After Day 3 — Move to "Lost" with reason noted</p>
          </div>
        </div>
      </div>

      <RepeatableEntry
        title="Follow-Up"
        items={formData.followups}
        onAdd={() => addArrayItem('followups', getDefaultFollowupEntry())}
        onRemove={(id) => removeArrayItem('followups', id)}
        emptyMessage="No follow-ups performed today."
        renderItem={(item) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Job Number</Label>
              <Input
                value={item.job_number}
                onChange={(e) => updateArrayItem('followups', item.id, 'job_number', e.target.value)}
                placeholder="WZ-1234"
              />
            </div>
            <div>
              <Label>Customer Name</Label>
              <Input
                value={item.customer_name}
                onChange={(e) => updateArrayItem('followups', item.id, 'customer_name', e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Attempt #</Label>
              <Select
                value={item.attempt_number}
                onChange={(e) => updateArrayItem('followups', item.id, 'attempt_number', parseInt(e.target.value) || '')}
              >
                <option value="">Select...</option>
                {FOLLOWUP_ATTEMPT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Timing</Label>
              <Select
                value={item.followup_timing}
                onChange={(e) => updateArrayItem('followups', item.id, 'followup_timing', e.target.value)}
              >
                <option value="">Select...</option>
                {FOLLOWUP_TIMING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select
                value={item.channel}
                onChange={(e) => updateArrayItem('followups', item.id, 'channel', e.target.value)}
              >
                <option value="">Select...</option>
                {FOLLOWUP_CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Result</Label>
              <Select
                value={item.result}
                onChange={(e) => updateArrayItem('followups', item.id, 'result', e.target.value)}
              >
                <option value="">Select...</option>
                {FOLLOWUP_RESULTS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={item.notes}
                onChange={(e) => updateArrayItem('followups', item.id, 'notes', e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}
      />
    </FormCard>
  )
}
