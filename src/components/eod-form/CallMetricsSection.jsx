import { Phone, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
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

  return (
    <FormCard title="Call Activity Metrics" subtitle="Section 3 of 13 — From GHL" icon={Phone}>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <Label>Inbound Calls</Label>
          <NumberInput
            value={formData.total_inbound_calls}
            onChange={(v) => setField('total_inbound_calls', v)}
            placeholder="0"
          />
          {ghl?.locationInbound != null && ghl.locationInbound > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              {ghl.locationInbound} total location inbound today
            </p>
          )}
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
          <Label source={getSource('missed_calls')}>Missed Calls</Label>
          <NumberInput
            value={formData.missed_calls}
            onChange={(v) => setField('missed_calls', v)}
            placeholder="0"
          />
          <DiscrepancyWarning discrepancy={getDiscrep('missed_calls', formData.missed_calls)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <Label source={getSource('speed_to_lead')}>Average Speed-to-Lead</Label>
          <Select
            value={formData.speed_to_lead}
            onChange={(e) => setField('speed_to_lead', e.target.value)}
          >
            <option value="">Select...</option>
            {SPEED_TO_LEAD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <p className="text-xs text-slate-500 mt-1">Target: Under 5 min</p>
        </div>

        <div>
          <Label source={getSource('missed_call_rate')}>Missed Call Rate</Label>
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
