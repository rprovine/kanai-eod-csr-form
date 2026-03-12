import { useState } from 'react'
import { Phone, AlertTriangle, RefreshCw, Loader2, MessageSquare, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, NumberInput, Select } from '../shared/FormField'
import { SPEED_TO_LEAD_OPTIONS } from '../../lib/constants'

function DiscrepancyWarning({ discrepancy }) {
  if (!discrepancy) return null
  return (
    <div className="mt-1 flex items-start gap-1.5 text-amber-400">
      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
      <p className="text-[11px]">
        GHL shows {discrepancy.ghlValue} ({discrepancy.deviationPercent}% difference). Both values will be recorded.
      </p>
    </div>
  )
}

export default function CallMetricsSection({ formData, setField, ghl }) {
  const getSource = ghl?.getFieldSource || (() => null)
  const getDiscrep = ghl?.getDiscrepancy || (() => null)
  const [showMessaging, setShowMessaging] = useState(false)
  const [stlOverride, setStlOverride] = useState(false)

  const hasMessagingData = (formData.total_messages_sent || 0) + (formData.total_messages_received || 0) > 0
  const hasStlData = formData.speed_to_lead_minutes != null && formData.speed_to_lead_minutes > 0
  const stlDetail = ghl?.speedToLeadDetail
  const stlChannels = stlDetail?.by_channel || {}

  const channelLabels = { calls: 'Calls', sms: 'SMS', facebook: 'Facebook', instagram: 'Instagram' }

  return (
    <FormCard title="Call & Messaging Activity" subtitle="Section 3 of 13 — From GHL" icon={Phone}>
      {ghl && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {ghl.loading && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading GHL data...
              </span>
            )}
            {ghl.error && (
              <span className="text-xs text-amber-400">{ghl.error}</span>
            )}
            {!ghl.loading && !ghl.error && Object.keys(ghl.fieldSources).length > 0 && (
              <span className="text-xs text-accent-green">Auto-filled from GHL</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => ghl.refreshGhlData(formData.employee_id, formData.report_date)}
            disabled={ghl.loading || !formData.employee_id}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-30"
          >
            <RefreshCw className={`w-3 h-3 ${ghl.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Call Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <Label>Inbound Calls</Label>
          <NumberInput
            value={formData.total_inbound_calls}
            onChange={(v) => setField('total_inbound_calls', v)}
            placeholder="0"
          />
          <p className="text-[11px] text-slate-500 mt-1">Manual entry</p>
        </div>
        <div>
          <Label source={getSource('total_outbound_calls')}>Outbound Calls</Label>
          <NumberInput
            value={formData.total_outbound_calls}
            onChange={(v) => setField('total_outbound_calls', v)}
            placeholder="0"
          />
          <DiscrepancyWarning discrepancy={getDiscrep('total_outbound_calls', formData.total_outbound_calls)} />
        </div>
        <div>
          <Label>Qualified Calls</Label>
          <NumberInput
            value={formData.total_qualified_calls}
            onChange={(v) => setField('total_qualified_calls', v)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Missed Calls</Label>
          <NumberInput
            value={formData.missed_calls}
            onChange={(v) => setField('missed_calls', v)}
            placeholder="0"
          />
          <p className="text-[11px] text-slate-500 mt-1">Manual entry</p>
        </div>
      </div>

      {/* Messaging Activity (collapsible) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowMessaging(!showMessaging)}
          className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors w-full"
        >
          <MessageSquare className="w-4 h-4" />
          Messaging Activity
          {hasMessagingData && (
            <span className="text-xs text-accent-green font-normal">
              {formData.total_messages_sent} sent / {formData.total_messages_received} received
            </span>
          )}
          {showMessaging ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
        </button>

        {showMessaging && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <Label source={getSource('total_sms_sent')}>SMS Sent</Label>
              <NumberInput
                value={formData.total_sms_sent}
                onChange={(v) => setField('total_sms_sent', v)}
                placeholder="0"
              />
            </div>
            <div>
              <Label source={getSource('total_sms_received')}>SMS Received</Label>
              <NumberInput
                value={formData.total_sms_received}
                onChange={(v) => setField('total_sms_received', v)}
                placeholder="0"
              />
            </div>
            <div>
              <Label source={getSource('total_fb_messages_sent')}>FB Sent</Label>
              <NumberInput
                value={formData.total_fb_messages_sent}
                onChange={(v) => setField('total_fb_messages_sent', v)}
                placeholder="0"
              />
            </div>
            <div>
              <Label source={getSource('total_fb_messages_received')}>FB Received</Label>
              <NumberInput
                value={formData.total_fb_messages_received}
                onChange={(v) => setField('total_fb_messages_received', v)}
                placeholder="0"
              />
            </div>
            <div>
              <Label source={getSource('total_ig_messages_sent')}>IG Sent</Label>
              <NumberInput
                value={formData.total_ig_messages_sent}
                onChange={(v) => setField('total_ig_messages_sent', v)}
                placeholder="0"
              />
            </div>
            <div>
              <Label source={getSource('total_ig_messages_received')}>IG Received</Label>
              <NumberInput
                value={formData.total_ig_messages_received}
                onChange={(v) => setField('total_ig_messages_received', v)}
                placeholder="0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Speed-to-Lead + Missed Call Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <Label source={getSource('speed_to_lead')}>Average Speed-to-Lead</Label>
          {hasStlData && !stlOverride ? (
            <>
              <div className={`px-4 py-2.5 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                formData.speed_to_lead_minutes < 5
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                  : formData.speed_to_lead_minutes < 10
                  ? 'bg-accent-gold/10 border-accent-gold/30 text-accent-gold'
                  : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
              }`}>
                <Clock className="w-4 h-4" />
                {formData.speed_to_lead_minutes} min avg
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Based on {formData.speed_to_lead_conversations} conversation{formData.speed_to_lead_conversations !== 1 ? 's' : ''}
                {' '}<button type="button" onClick={() => setStlOverride(true)} className="text-kanai-blue-light hover:underline">Override</button>
              </p>
              {Object.keys(stlChannels).length > 1 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(stlChannels).map(([ch, data]) => (
                    <div key={ch} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{channelLabels[ch] || ch}</span>
                      <span className={`font-medium ${
                        data.avg_minutes < 5 ? 'text-accent-green' :
                        data.avg_minutes < 10 ? 'text-accent-gold' : 'text-accent-red'
                      }`}>
                        {data.avg_minutes} min <span className="text-slate-500 font-normal">({data.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Select
                value={formData.speed_to_lead}
                onChange={(e) => setField('speed_to_lead', e.target.value)}
              >
                <option value="">Select...</option>
                {SPEED_TO_LEAD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Target: Under 5 min
                {hasStlData && stlOverride && (
                  <>{' '}<button type="button" onClick={() => setStlOverride(false)} className="text-kanai-blue-light hover:underline">Use GHL value</button></>
                )}
              </p>
            </>
          )}
        </div>

        <div>
          <Label>Missed Call Rate</Label>
          <div className={`px-4 py-2.5 rounded-lg border text-sm font-semibold ${
            formData.missed_call_rate < 10
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}>
            {formData.missed_call_rate}%
          </div>
          <p className="text-xs text-slate-500 mt-1">Target: Under 10%</p>
        </div>
      </div>

      {formData.missed_call_rate >= 10 && formData.total_inbound_calls > 0 && (
        <div className="mt-4 flex items-start gap-2 bg-accent-red/10 border border-accent-red/30 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
          <p className="text-sm text-accent-red">
            Missed call rate is above the 10% target. This affects bonus eligibility.
          </p>
        </div>
      )}
    </FormCard>
  )
}
