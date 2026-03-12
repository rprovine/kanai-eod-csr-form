import { Mail } from 'lucide-react'
import FormCard from '../shared/FormCard'
import RepeatableEntry from '../shared/RepeatableEntry'
import { Label, Input, Select } from '../shared/FormField'
import { EMAIL_SOURCES, EMAIL_STATUSES } from '../../lib/constants'
import { getDefaultEmailEntry } from '../../lib/form-defaults'

export default function EmailSubmissionsSection({ formData, addArrayItem, updateArrayItem, removeArrayItem }) {
  return (
    <FormCard title="Emails & Web Form Submissions" subtitle="Section 6 of 14" icon={Mail}>
      <RepeatableEntry
        title="Entry"
        items={formData.email_submissions}
        onAdd={() => addArrayItem('email_submissions', getDefaultEmailEntry())}
        onRemove={(id) => removeArrayItem('email_submissions', id)}
        emptyMessage="No email/form submissions to report."
        renderItem={(item) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Customer Name</Label>
              <Input
                value={item.customer_name}
                onChange={(e) => updateArrayItem('email_submissions', item.id, 'customer_name', e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Source</Label>
              <Select
                value={item.source}
                onChange={(e) => updateArrayItem('email_submissions', item.id, 'source', e.target.value)}
              >
                <option value="">Select source...</option>
                {EMAIL_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={item.status}
                onChange={(e) => updateArrayItem('email_submissions', item.id, 'status', e.target.value)}
              >
                <option value="">Select status...</option>
                {EMAIL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={item.notes}
                onChange={(e) => updateArrayItem('email_submissions', item.id, 'notes', e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}
      />
    </FormCard>
  )
}
