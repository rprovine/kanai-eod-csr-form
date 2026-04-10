import { Zap } from 'lucide-react'

const MOMENT_COLORS = {
  greeting: 'border-accent-green/30 bg-accent-green/5',
  needs_discovery: 'border-kanai-blue/30 bg-kanai-blue/5',
  pricing: 'border-accent-gold/30 bg-accent-gold/5',
  objection: 'border-orange-400/30 bg-orange-400/5',
  close: 'border-purple-400/30 bg-purple-400/5',
  booking: 'border-accent-green/30 bg-accent-green/5',
  missed: 'border-accent-red/30 bg-accent-red/5',
}

export default function KeyMoments({ moments }) {
  if (!moments || !Array.isArray(moments) || moments.length === 0) return null

  return (
    <div className="bg-slate-800/50 border border-card-border rounded-lg p-4">
      <h4 className="text-xs font-medium text-slate-300 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-accent-gold" />
        Key Moments
      </h4>

      <div className="space-y-2">
        {moments.map((moment, i) => {
          const colorClass = MOMENT_COLORS[moment.type] || 'border-card-border bg-slate-800/30'
          return (
            <div key={i} className={`border rounded-lg p-3 ${colorClass}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate-200 capitalize">
                  {(moment.type || '').replace(/_/g, ' ')}
                </span>
                {moment.timestamp_hint && (
                  <span className="text-xs text-slate-500">{moment.timestamp_hint}</span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{moment.summary}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
