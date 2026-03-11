import { Briefcase } from 'lucide-react'
import FormCard from '../shared/FormCard'
import RepeatableEntry from '../shared/RepeatableEntry'
import { Label, Input, Select, DollarInput, Checkbox } from '../shared/FormField'
import { JOB_TYPES, LEAD_SOURCES } from '../../lib/constants'
import { getDefaultJobEntry } from '../../lib/form-defaults'

export default function JobsBookedSection({ formData, addArrayItem, updateArrayItem, removeArrayItem }) {
  const totalRevenue = formData.jobs_booked.reduce(
    (sum, job) => sum + (parseFloat(job.estimated_revenue) || 0), 0
  )

  return (
    <FormCard title="Jobs Booked Today" subtitle="Section 5 of 13" icon={Briefcase}>
      <RepeatableEntry
        title="Job"
        items={formData.jobs_booked}
        onAdd={() => addArrayItem('jobs_booked', getDefaultJobEntry())}
        onRemove={(id) => removeArrayItem('jobs_booked', id)}
        emptyMessage="No jobs booked yet. Click + to add a booking."
        renderItem={(item) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Job Number</Label>
              <Input
                value={item.job_number}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'job_number', e.target.value)}
                placeholder="WZ-1234 or DK-5678"
              />
            </div>
            <div>
              <Label>Customer Name</Label>
              <Input
                value={item.customer_name}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'customer_name', e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Job Type</Label>
              <Select
                value={item.job_type}
                onChange={(e) => {
                  const jt = e.target.value
                  const system = JOB_TYPES.find((j) => j.value === jt)?.system || ''
                  updateArrayItem('jobs_booked', item.id, 'job_type', jt)
                  updateArrayItem('jobs_booked', item.id, 'system', system)
                }}
              >
                <option value="">Select type...</option>
                {JOB_TYPES.map((jt) => (
                  <option key={jt.value} value={jt.value}>{jt.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>System</Label>
              <Input value={item.system || '—'} disabled className="opacity-60" />
            </div>
            <div>
              <Label>Estimated Revenue</Label>
              <DollarInput
                value={item.estimated_revenue}
                onChange={(v) => updateArrayItem('jobs_booked', item.id, 'estimated_revenue', v)}
              />
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={item.scheduled_date}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'scheduled_date', e.target.value)}
              />
            </div>
            <div>
              <Label>Lead Source</Label>
              <Select
                value={item.lead_source}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'lead_source', e.target.value)}
              >
                <option value="">Select source...</option>
                {LEAD_SOURCES.map((ls) => (
                  <option key={ls.value} value={ls.value}>{ls.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Checkbox
                label="GHL Pipeline Updated"
                checked={item.ghl_pipeline_updated}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'ghl_pipeline_updated', e.target.checked)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={item.notes}
                onChange={(e) => updateArrayItem('jobs_booked', item.id, 'notes', e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}
      />

      {formData.jobs_booked.length > 0 && (
        <div className="mt-4 flex items-center justify-between bg-accent-green/10 border border-accent-green/30 rounded-lg px-4 py-2.5">
          <span className="text-sm text-accent-green font-medium">
            {formData.jobs_booked.length} job{formData.jobs_booked.length !== 1 ? 's' : ''} booked
          </span>
          <span className="text-sm text-accent-green font-semibold">
            ${totalRevenue.toLocaleString()}
          </span>
        </div>
      )}
    </FormCard>
  )
}
