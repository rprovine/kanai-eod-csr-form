import { useState, useEffect } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

function formatRelativeTime(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

function formatHST(dateString) {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'Pacific/Honolulu',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return dateString
  }
}

function getActionBadge(action, stage) {
  const actionLower = (action || '').toLowerCase()
  const stageLower = (stage || '').toLowerCase()

  if (actionLower.includes('booked') || stageLower.includes('booked')) {
    return { color: 'bg-green-500/15 text-green-400', label: action || 'Booked' }
  }
  if (actionLower.includes('lost') || stageLower.includes('lost')) {
    return { color: 'bg-red-500/15 text-red-400', label: action || 'Lost' }
  }
  if (actionLower.startsWith('stage:') || stageLower) {
    return { color: 'bg-blue-500/15 text-blue-400', label: action || `Stage: ${stage}` }
  }
  return { color: 'bg-slate-600/30 text-slate-400', label: action || 'Unknown' }
}

export default function WebhookTimeline() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }

      try {
        const { data: rows, error } = await supabase
          .from('webhook_log')
          .select('*')
          .eq('source', 'ghl-opportunity')
          .order('received_at', { ascending: false })
          .limit(20)

        if (error) throw error

        const entries = (rows || []).map((row) => {
          const payload = row.payload || {}
          return {
            id: row.id,
            receivedAt: row.received_at,
            contactName: payload.contactName || payload.contact_name || '--',
            action: payload.action || payload.event || '--',
            stage: payload.stage || payload.pipelineStage || '',
          }
        })

        setData(entries)
      } catch (err) {
        console.error('WebhookTimeline fetch error:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-kanai-blue-light" />
      </div>
    )
  }

  if (!data || data.length === 0) return null

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-kanai-blue-light" />
        Recent Pipeline Activity
      </h3>

      <div className="space-y-0">
        {data.map((entry, i) => {
          const badge = getActionBadge(entry.action, entry.stage)
          return (
            <div
              key={entry.id || i}
              className="flex items-start gap-3 py-3 border-b border-card-border/50 last:border-b-0 hover:bg-slate-800/30 transition-colors"
            >
              {/* Timeline dot */}
              <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-200 text-sm font-medium truncate">
                    {entry.contactName}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>
                  {entry.stage && !badge.label.toLowerCase().includes(entry.stage.toLowerCase()) && (
                    <span className="text-xs text-slate-500">{entry.stage}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500" title={formatHST(entry.receivedAt)}>
                    {formatRelativeTime(entry.receivedAt)}
                  </span>
                  <span className="text-xs text-slate-600">
                    {formatHST(entry.receivedAt)} HST
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
