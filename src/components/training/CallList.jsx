import { Phone, PhoneIncoming, PhoneOutgoing, Loader2, Clock, Star } from 'lucide-react'

export default function CallList({ calls, loading, onSelectCall }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading calls...
      </div>
    )
  }

  if (!calls || calls.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-8 text-center">
        <Phone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400">No scored calls found.</p>
        <p className="text-xs text-slate-500 mt-1">Calls are scored automatically by the AI coaching pipeline.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">{calls.length} scored calls</p>

      {/* Desktop Table */}
      <div className="hidden md:block bg-card-bg border border-card-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Direction</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Contact</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">CSR</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Duration</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Score</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Type</th>
              <th className="text-center py-3 px-4 text-slate-400 font-medium">Booked?</th>
            </tr>
          </thead>
          <tbody>
            {calls.map(call => {
              const scores = call.coaching_call_scores?.[0] || {}
              return (
                <tr
                  key={call.id}
                  onClick={() => onSelectCall(call.id)}
                  className="border-b border-card-border/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 text-slate-300 text-xs">
                    {formatDateTime(call.call_timestamp)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="w-4 h-4 text-accent-green mx-auto" />
                    ) : (
                      <PhoneOutgoing className="w-4 h-4 text-kanai-blue-light mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-200">
                    {call.contact_name || call.contact_phone || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-xs">{call.csr_name || '--'}</td>
                  <td className="py-3 px-4 text-center text-slate-400 text-xs">
                    {formatDuration(call.duration_seconds)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <ScoreBadge score={scores.overall_score} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CallTypeBadge type={scores.call_type} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scores.call_to_book_conversion ? (
                      <span className="text-accent-green font-bold text-xs">YES</span>
                    ) : (
                      <span className="text-slate-600 text-xs">--</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {calls.map(call => {
          const scores = call.coaching_call_scores?.[0] || {}
          return (
            <div
              key={call.id}
              onClick={() => onSelectCall(call.id)}
              className="bg-card-bg border border-card-border rounded-lg p-4 cursor-pointer hover:border-slate-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {call.direction === 'inbound' ? (
                    <PhoneIncoming className="w-4 h-4 text-accent-green" />
                  ) : (
                    <PhoneOutgoing className="w-4 h-4 text-kanai-blue-light" />
                  )}
                  <span className="text-sm text-slate-200">
                    {call.contact_name || call.contact_phone || 'Unknown'}
                  </span>
                </div>
                <ScoreBadge score={scores.overall_score} />
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{formatDateTime(call.call_timestamp)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(call.duration_seconds)}
                </span>
                {call.csr_name && <span>{call.csr_name}</span>}
                <CallTypeBadge type={scores.call_type} />
                {scores.call_to_book_conversion && (
                  <span className="text-accent-green font-bold">BOOKED</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-slate-600 text-xs">--</span>
  const s = Number(score)
  const color = s >= 4 ? 'bg-accent-green/15 text-accent-green' :
                s >= 3 ? 'bg-accent-gold/15 text-accent-gold' :
                'bg-accent-red/15 text-accent-red'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {s.toFixed(1)}
    </span>
  )
}

function CallTypeBadge({ type }) {
  if (!type) return null
  const config = {
    first_contact: { label: 'First', color: 'text-kanai-blue-light' },
    follow_up: { label: 'Follow-up', color: 'text-accent-gold' },
    non_sales: { label: 'Non-sales', color: 'text-slate-500' },
  }
  const c = config[type] || { label: type, color: 'text-slate-500' }
  return <span className={`text-xs ${c.color}`}>{c.label}</span>
}

function formatDateTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDuration(seconds) {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
