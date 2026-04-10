import { BarChart3 } from 'lucide-react'
import { COACHING_CATEGORIES } from '../../lib/constants'

export default function ScoreBreakdown({ scores }) {
  if (!scores) return null

  const overallScore = scores.overall_score ? Number(scores.overall_score).toFixed(1) : '--'

  return (
    <div className="bg-slate-800/50 border border-card-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-kanai-blue-light" />
          <span className="text-xs font-medium text-slate-300">Score Breakdown</span>
        </div>
        <span className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
          {overallScore}<span className="text-xs text-slate-500">/5</span>
        </span>
      </div>

      <div className="space-y-2">
        {COACHING_CATEGORIES.map(cat => {
          const score = scores[cat.key] || 0
          const pct = (score / 5) * 100
          return (
            <div key={cat.key} className="flex items-center gap-3">
              <span className="w-28 text-xs text-slate-400 truncate">{cat.short}</span>
              <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    score >= 4 ? 'bg-accent-green' :
                    score >= 3 ? 'bg-accent-gold' : 'bg-accent-red'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`w-6 text-right text-xs font-bold ${
                score >= 4 ? 'text-accent-green' :
                score >= 3 ? 'text-accent-gold' : 'text-accent-red'
              }`}>
                {score}
              </span>
            </div>
          )
        })}
      </div>

      {/* Additional indicators */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-card-border/50 text-xs">
        {scores.sentiment && (
          <span className="text-slate-400">
            Sentiment: <span className={getSentimentColor(scores.sentiment)}>{scores.sentiment}</span>
          </span>
        )}
        {scores.is_qualified_lead != null && (
          <span className="text-slate-400">
            Qualified: <span className={scores.is_qualified_lead ? 'text-accent-green' : 'text-accent-red'}>
              {scores.is_qualified_lead ? 'Yes' : 'No'}
            </span>
          </span>
        )}
        {scores.call_to_book_conversion && (
          <span className="text-accent-green font-bold">BOOKED</span>
        )}
        {scores.missed_opportunity && (
          <span className="text-accent-red font-bold">MISSED OPP</span>
        )}
      </div>
    </div>
  )
}

function getScoreColor(score) {
  const s = parseFloat(score)
  if (isNaN(s)) return 'text-slate-400'
  if (s >= 4) return 'text-accent-green'
  if (s >= 3) return 'text-accent-gold'
  return 'text-accent-red'
}

function getSentimentColor(sentiment) {
  const colors = {
    positive: 'text-accent-green',
    neutral: 'text-slate-300',
    frustrated: 'text-accent-gold',
    confused: 'text-accent-gold',
    angry: 'text-accent-red',
  }
  return colors[sentiment] || 'text-slate-300'
}
