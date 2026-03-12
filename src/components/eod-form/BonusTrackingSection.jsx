import { Trophy, TrendingUp, Star, RotateCcw, AlertTriangle, XCircle } from 'lucide-react'
import FormCard from '../shared/FormCard'
import { Label, NumberInput } from '../shared/FormField'

export default function BonusTrackingSection({ formData, setField }) {
  const cancellationRate = formData.disp_booked > 0
    ? Math.round((formData.cancellation_count / formData.disp_booked) * 1000) / 10
    : 0
  const noshowRate = formData.disp_booked > 0
    ? Math.round((formData.noshow_count / formData.disp_booked) * 1000) / 10
    : 0

  return (
    <FormCard title="Bonus Tracking" subtitle="Section 13 of 14 — Accelerators & Guardrails" icon={Trophy}>
      {/* Accelerators */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-accent-green mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Bonus Accelerators
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>
              <span className="flex items-center gap-1">
                Upsells
                <span className="text-xs text-accent-gold font-normal">($5 each)</span>
              </span>
            </Label>
            <NumberInput
              value={formData.upsell_count}
              onChange={(v) => setField('upsell_count', v)}
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">Added services to existing job</p>
          </div>
          <div>
            <Label>
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                Review Assists
                <span className="text-xs text-accent-gold font-normal">($10 each)</span>
              </span>
            </Label>
            <NumberInput
              value={formData.review_assists}
              onChange={(v) => setField('review_assists', v)}
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">5-star review request sent</p>
          </div>
          <div>
            <Label>
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Win-Back Bookings
                <span className="text-xs text-accent-gold font-normal">($10 each)</span>
              </span>
            </Label>
            <NumberInput
              value={formData.winback_bookings}
              onChange={(v) => setField('winback_bookings', v)}
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">Booking from previously lost lead</p>
          </div>
        </div>

        {/* Accelerator total */}
        {(formData.upsell_count > 0 || formData.review_assists > 0 || formData.winback_bookings > 0) && (
          <div className="mt-3 bg-accent-gold/10 border border-accent-gold/30 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm text-accent-gold font-medium">Accelerator Bonus Today</span>
            <span className="text-sm text-accent-gold font-bold">
              ${(formData.upsell_count * 5) + (formData.review_assists * 10) + (formData.winback_bookings * 10)}
            </span>
          </div>
        )}
      </div>

      {/* Guardrails */}
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-red" />
          Quality Guardrails
        </h4>
        <p className="text-xs text-slate-500 mb-3">
          Cancellation rate over 20% reduces bonus by 50%. No-show rate over 15% reduces bonus by 25%.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Cancellations Today</Label>
            <NumberInput
              value={formData.cancellation_count}
              onChange={(v) => setField('cancellation_count', v)}
              placeholder="0"
            />
            {cancellationRate > 20 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <XCircle className="w-3.5 h-3.5 text-accent-red shrink-0" />
                <span className="text-xs text-accent-red font-medium">
                  {cancellationRate}% cancellation rate — bonus reduced 50%
                </span>
              </div>
            )}
          </div>
          <div>
            <Label>No-Shows Today</Label>
            <NumberInput
              value={formData.noshow_count}
              onChange={(v) => setField('noshow_count', v)}
              placeholder="0"
            />
            {noshowRate > 15 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <XCircle className="w-3.5 h-3.5 text-accent-red shrink-0" />
                <span className="text-xs text-accent-red font-medium">
                  {noshowRate}% no-show rate — bonus reduced 25%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </FormCard>
  )
}
