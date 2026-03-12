import { BarChart3, TrendingUp } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, NumberInput } from '../shared/FormField'
import { DISPOSITION_TYPES } from '../../lib/constants'
import { getPerformanceTier } from '../../lib/kpi-calculations'

export default function DispositionsSection({ formData, setField, ghl }) {
  const getSource = ghl?.getFieldSource || (() => null)
  const totalDispositions = DISPOSITION_TYPES.reduce(
    (sum, d) => sum + (formData[d.key] || 0), 0
  )
  const tier = getPerformanceTier(formData.daily_booking_rate)

  return (
    <FormCard title="Call Dispositions" subtitle="Section 4 of 13 — From GHL Pipeline" icon={BarChart3}>
      <div className="space-y-4">
        {DISPOSITION_TYPES.map((disp) => (
          <div key={disp.key} className="flex items-center gap-4">
            <div className="flex-1">
              <Label source={getSource(disp.key)} className="mb-0">{disp.label}</Label>
              <p className="text-xs text-slate-500">{disp.definition}</p>
            </div>
            <div className="w-20">
              <NumberInput
                value={formData[disp.key]}
                onChange={(v) => setField(disp.key, v)}
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Auto-calculated metrics */}
      <div className="mt-6 space-y-3">
        <div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Total Dispositions</p>
            <p className="text-xl font-bold text-slate-100">{totalDispositions}</p>
          </div>
        </div>

        {/* Booking Rate */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-kanai-blue-light" />
              <span className="text-sm font-medium text-slate-300">Daily Booking Rate</span>
            </div>
            <span className={`text-2xl font-bold ${tier.color}`}>
              {formData.daily_booking_rate}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              tier.tier === 'elite' ? 'bg-accent-green/20 text-accent-green' :
              tier.tier === 'standard' ? 'bg-kanai-blue/20 text-kanai-blue-light' :
              tier.tier === 'developing' ? 'bg-accent-gold/20 text-accent-gold' :
              'bg-accent-red/20 text-accent-red'
            }`}>
              {tier.label}
            </span>
            <span className="text-xs text-slate-500">
              Standard: 60%+ | Elite: 70%+
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Rate = Booked / (Booked + Quoted + Follow-up + Lost). Non-qualified leads excluded.
          </p>
        </div>
      </div>

    </FormCard>
  )
}
