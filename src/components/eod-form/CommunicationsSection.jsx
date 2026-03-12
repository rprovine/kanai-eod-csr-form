import { MessageSquare } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Checkbox } from '../shared/FormField'
import { COMMUNICATION_CHANNELS } from '../../lib/constants'

export default function CommunicationsSection({ formData, setField }) {
  const checkedCount = COMMUNICATION_CHANNELS.filter((ch) => formData[ch.key]).length
  const allChecked = checkedCount === COMMUNICATION_CHANNELS.length

  return (
    <FormCard
      title="Customer Communications"
      subtitle="Section 2 of 14 — Confirm all channels checked"
      icon={MessageSquare}
    >
      <div className="space-y-3">
        {COMMUNICATION_CHANNELS.map((channel) => (
          <Checkbox
            key={channel.key}
            label={channel.label}
            checked={formData[channel.key] || false}
            onChange={(e) => setField(channel.key, e.target.checked)}
          />
        ))}
      </div>

      <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
        allChecked
          ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
          : 'bg-accent-gold/10 border border-accent-gold/30 text-accent-gold'
      }`}>
        {allChecked
          ? 'All communication channels checked'
          : `${checkedCount}/${COMMUNICATION_CHANNELS.length} channels confirmed`
        }
      </div>
    </FormCard>
  )
}
