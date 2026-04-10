import { X, PhoneIncoming, PhoneOutgoing, Clock, Loader2 } from 'lucide-react'
import AudioPlayer from './AudioPlayer'
import ScoreBreakdown from './ScoreBreakdown'
import AIFeedback from './AIFeedback'
import KeyMoments from './KeyMoments'
import DiarizedTranscript from './DiarizedTranscript'

export default function CallDetailModal({ call, loading, onClose }) {
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card-bg border border-card-border rounded-xl p-8">
          <Loader2 className="w-6 h-6 animate-spin text-kanai-blue-light mx-auto" />
          <p className="text-sm text-slate-400 mt-2">Loading call details...</p>
        </div>
      </div>
    )
  }

  if (!call) return null

  const scores = call.coaching_call_scores?.[0] || {}

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen py-4 px-4">
        <div className="max-w-4xl mx-auto bg-card-bg border border-card-border rounded-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-card-bg border-b border-card-border rounded-t-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {call.direction === 'inbound' ? (
                <PhoneIncoming className="w-5 h-5 text-accent-green" />
              ) : (
                <PhoneOutgoing className="w-5 h-5 text-kanai-blue-light" />
              )}
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  {call.contact_name || call.contact_phone || 'Unknown Caller'}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{formatDateTime(call.call_timestamp)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(call.duration_seconds)}
                  </span>
                  {call.csr_name && <span>CSR: {call.csr_name}</span>}
                  {scores.call_type && (
                    <span className="capitalize">{scores.call_type.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Audio Player */}
            <AudioPlayer url={call.recording_url} />

            {/* Scores */}
            <ScoreBreakdown scores={scores} />

            {/* AI Feedback */}
            <AIFeedback scores={scores} />

            {/* Key Moments */}
            <KeyMoments moments={scores.key_moments} />

            {/* Transcript */}
            <DiarizedTranscript
              diarized={scores.diarized_transcript}
              rawTranscript={call.transcript}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatDuration(seconds) {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
