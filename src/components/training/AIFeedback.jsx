import { Lightbulb, ThumbsUp, AlertTriangle, PhoneOff } from 'lucide-react'

export default function AIFeedback({ scores }) {
  if (!scores) return null

  const { strengths, improvements, coaching_tip, missed_opportunity, missed_opportunity_reason } = scores
  const hasContent = (strengths?.length > 0) || (improvements?.length > 0) || coaching_tip || missed_opportunity

  if (!hasContent) return null

  return (
    <div className="bg-slate-800/50 border border-card-border rounded-lg p-4 space-y-4">
      <h4 className="text-xs font-medium text-slate-300 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-accent-gold" />
        AI Coaching Feedback
      </h4>

      {/* Strengths */}
      {strengths && strengths.length > 0 && (
        <div>
          <p className="text-xs text-accent-green font-medium mb-1 flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            Strengths
          </p>
          <ul className="space-y-1">
            {strengths.map((s, i) => (
              <li key={i} className="text-xs text-slate-300 pl-4 relative before:absolute before:left-1 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-accent-green/40">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {improvements && improvements.length > 0 && (
        <div>
          <p className="text-xs text-accent-gold font-medium mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Areas to Improve
          </p>
          <ul className="space-y-1">
            {improvements.map((s, i) => (
              <li key={i} className="text-xs text-slate-300 pl-4 relative before:absolute before:left-1 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-accent-gold/40">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Coaching Tip */}
      {coaching_tip && (
        <div className="bg-kanai-blue/10 border border-kanai-blue/20 rounded-lg p-3">
          <p className="text-xs text-kanai-blue-light font-medium mb-1">Coaching Tip</p>
          <p className="text-xs text-slate-300 leading-relaxed">{coaching_tip}</p>
        </div>
      )}

      {/* Missed Opportunity */}
      {missed_opportunity && missed_opportunity_reason && (
        <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg p-3">
          <p className="text-xs text-accent-red font-medium mb-1 flex items-center gap-1">
            <PhoneOff className="w-3 h-3" />
            Missed Opportunity
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">{missed_opportunity_reason}</p>
        </div>
      )}
    </div>
  )
}
