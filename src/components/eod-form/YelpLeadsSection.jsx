import { Star } from 'lucide-react'
import FormCard from '../shared/FormCard'
import RepeatableEntry from '../shared/RepeatableEntry'
import { Label, Input, Select, Checkbox } from '../shared/FormField'
import { YELP_STATUSES } from '../../lib/constants'
import { getDefaultYelpEntry } from '../../lib/form-defaults'

export default function YelpLeadsSection({ formData, addArrayItem, updateArrayItem, removeArrayItem }) {
  return (
    <FormCard title="Yelp Lead Activity" subtitle="Section 7 of 13" icon={Star}>
      <RepeatableEntry
        title="Yelp Lead"
        items={formData.yelp_leads}
        onAdd={() => addArrayItem('yelp_leads', getDefaultYelpEntry())}
        onRemove={(id) => removeArrayItem('yelp_leads', id)}
        emptyMessage="No Yelp leads to report."
        renderItem={(item) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Customer Name</Label>
              <Input
                value={item.customer_name}
                onChange={(e) => updateArrayItem('yelp_leads', item.id, 'customer_name', e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={item.status}
                onChange={(e) => updateArrayItem('yelp_leads', item.id, 'status', e.target.value)}
              >
                <option value="">Select status...</option>
                {YELP_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Checkbox
                label="Follow-Up Needed?"
                checked={item.followup_needed}
                onChange={(e) => updateArrayItem('yelp_leads', item.id, 'followup_needed', e.target.checked)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={item.notes}
                onChange={(e) => updateArrayItem('yelp_leads', item.id, 'notes', e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}
      />
    </FormCard>
  )
}
