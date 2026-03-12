import { FileText } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, Textarea } from '../shared/FormField'

export default function NotesSection({ formData, setField }) {
  return (
    <FormCard title="Issues, Escalations & Notes" subtitle="Section 12 of 14" icon={FileText}>
      <div className="space-y-4">
        <div>
          <Label>Issues Encountered Today</Label>
          <Textarea
            value={formData.issues}
            onChange={(e) => setField('issues', e.target.value)}
            placeholder="System problems, customer escalations, scheduling conflicts..."
          />
        </div>
        <div>
          <Label>Items Requiring Management Attention</Label>
          <Textarea
            value={formData.management_attention}
            onChange={(e) => setField('management_attention', e.target.value)}
            placeholder="Anything that needs supervisor/management review..."
          />
        </div>
        <div>
          <Label>Suggestions / Feedback</Label>
          <Textarea
            value={formData.suggestions}
            onChange={(e) => setField('suggestions', e.target.value)}
            placeholder="Process improvements, tool suggestions, feedback..."
          />
        </div>
        <div>
          <Label>Anything Carried Over to Tomorrow</Label>
          <Textarea
            value={formData.carried_over}
            onChange={(e) => setField('carried_over', e.target.value)}
            placeholder="Unfinished tasks, pending callbacks, items for next shift..."
          />
        </div>
      </div>
    </FormCard>
  )
}
