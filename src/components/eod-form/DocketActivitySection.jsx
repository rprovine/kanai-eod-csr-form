import { Container } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, NumberInput, Checkbox, Textarea } from '../shared/FormField'

export default function DocketActivitySection({ formData, setField }) {
  return (
    <FormCard title="Docket Activity" subtitle="Section 9 of 13 — Dumpster Rentals" icon={Container}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <Label>New Clients Created</Label>
          <NumberInput
            value={formData.docket_clients_created}
            onChange={(v) => setField('docket_clients_created', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Agreements Sent</Label>
          <NumberInput
            value={formData.docket_agreements_sent}
            onChange={(v) => setField('docket_agreements_sent', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Agreements Signed</Label>
          <NumberInput
            value={formData.docket_agreements_signed}
            onChange={(v) => setField('docket_agreements_signed', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Tasks Created</Label>
          <NumberInput
            value={formData.docket_tasks_created}
            onChange={(v) => setField('docket_tasks_created', v)}
            placeholder="0"
          />
          <p className="text-xs text-slate-500 mt-1">Deliveries, pickups, swaps</p>
        </div>
        <div>
          <Label>Dumpsters.com Orders</Label>
          <NumberInput
            value={formData.docket_dumpsters_com_orders}
            onChange={(v) => setField('docket_dumpsters_com_orders', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Unsigned Follow-Ups</Label>
          <NumberInput
            value={formData.docket_followups}
            onChange={(v) => setField('docket_followups', v)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="mt-4">
        <Checkbox
          label="Asset Availability Verified? (yard counts are accurate)"
          checked={formData.docket_asset_availability_verified}
          onChange={(e) => setField('docket_asset_availability_verified', e.target.checked)}
        />
      </div>

      <div className="mt-4">
        <Label>Docket Notes</Label>
        <Textarea
          value={formData.docket_notes}
          onChange={(e) => setField('docket_notes', e.target.value)}
          placeholder="Any additional notes about dumpster rental activity..."
        />
      </div>
    </FormCard>
  )
}
