import { MessageSquare } from 'lucide-react'

export default function DiarizedTranscript({ diarized, rawTranscript }) {
  // Use diarized if available, fall back to raw
  const hasDiarized = diarized && Array.isArray(diarized) && diarized.length > 0

  if (!hasDiarized && !rawTranscript) return null

  return (
    <div className="bg-slate-800/50 border border-card-border rounded-lg p-4">
      <h4 className="text-xs font-medium text-slate-300 mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-kanai-blue-light" />
        Call Transcript
      </h4>

      {hasDiarized ? (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {diarized.map((turn, i) => {
            const isCsr = isCsrSpeaker(turn.speaker)
            return (
              <div
                key={i}
                className={`pl-3 border-l-2 ${
                  isCsr ? 'border-kanai-blue-light' : 'border-slate-600'
                }`}
              >
                <p className={`text-xs font-medium mb-0.5 ${
                  isCsr ? 'text-kanai-blue-light' : 'text-slate-400'
                }`}>
                  {turn.speaker || (isCsr ? 'CSR' : 'Customer')}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">{turn.text}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto pr-2">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{rawTranscript}</p>
        </div>
      )}
    </div>
  )
}

function isCsrSpeaker(speaker) {
  if (!speaker) return false
  const lower = speaker.toLowerCase()
  return lower.includes('csr') || lower.includes('agent') || lower.includes('rep') || lower === 'speaker 1'
}
