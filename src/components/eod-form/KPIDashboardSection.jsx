import { BarChart3, CheckCircle2, XCircle, AlertTriangle, Trophy, Target, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import FormCard from '../shared/FormCard'
import { calcAllKPIs, getKPIStatus } from '../../lib/kpi-calculations'
import { SPEED_TO_LEAD_OPTIONS } from '../../lib/constants'

function StatusIcon({ status }) {
  if (status === 'green') return <CheckCircle2 className="w-5 h-5 text-accent-green" />
  if (status === 'yellow') return <AlertTriangle className="w-5 h-5 text-accent-gold" />
  return <XCircle className="w-5 h-5 text-accent-red" />
}

export default function KPIDashboardSection({ formData, hireDate }) {
  const kpis = calcAllKPIs(formData, { hireDate })

  // Speed-to-lead: prefer numeric GHL value, fall back to dropdown label
  let stlDisplay, stlStatus
  if (kpis.speedToLeadMinutes != null && kpis.speedToLeadMinutes > 0) {
    stlDisplay = `${kpis.speedToLeadMinutes} min`
    stlStatus = kpis.speedToLeadMinutes < 5 ? 'green' : kpis.speedToLeadMinutes < 10 ? 'yellow' : 'red'
  } else {
    const speedLabel = SPEED_TO_LEAD_OPTIONS.find((o) => o.value === kpis.speedToLead)?.label || 'Not set'
    stlDisplay = speedLabel
    stlStatus = kpis.speedToLead === 'under_5' ? 'green' : kpis.speedToLead === '5_to_10' ? 'yellow' : 'red'
  }

  const kpiRows = [
    {
      label: 'Booking Rate',
      display: `${kpis.bookingRate}%`,
      target: '60%+ (Standard) / 70%+ (Elite)',
      status: getKPIStatus(kpis.bookingRate, 60, 'gte'),
    },
    {
      label: 'Missed Call Rate',
      display: `${kpis.missedCallRate}%`,
      target: 'Under 10%',
      status: getKPIStatus(kpis.missedCallRate, 10, 'lte'),
    },
    {
      label: 'Speed-to-Lead',
      display: stlDisplay,
      target: 'Under 5 min',
      status: stlStatus,
    },
    {
      label: 'Follow-Ups Completed',
      display: `${kpis.followupCompletion}%`,
      target: '100% of scheduled',
      status: getKPIStatus(kpis.followupCompletion, 100, 'gte'),
    },
    {
      label: 'GHL Pipeline Clean',
      display: kpis.pipelineClean ? 'Yes' : 'No',
      target: 'Yes',
      status: kpis.pipelineClean ? 'green' : 'red',
    },
  ]

  const chartData = [
    { name: 'Book %', value: Math.min(kpis.bookingRate, 100), fill: getKPIStatus(kpis.bookingRate, 60, 'gte') },
    { name: 'F/U %', value: Math.min(kpis.followupCompletion, 100), fill: getKPIStatus(kpis.followupCompletion, 100, 'gte') },
  ]

  const chartColors = { green: '#27AE60', yellow: '#F39C12', red: '#E74C3C' }

  return (
    <FormCard title="Daily KPI Summary" subtitle="Section 14 of 14 — Auto-calculated" icon={Target}>
      {/* New Hire Ramp Banner */}
      {kpis.ramp.isNewHire && (
        <div className="mb-4 p-3 rounded-xl bg-kanai-blue/10 border border-kanai-blue/30 text-center">
          <span className="text-sm text-kanai-blue-light font-medium">
            New Hire Ramp — Week {kpis.ramp.rampWeek}
            {kpis.ramp.guaranteedBonus > 0
              ? ` (Guaranteed $${kpis.ramp.guaranteedBonus} bonus)`
              : ' (40% booking rate threshold)'}
          </span>
        </div>
      )}

      {/* Bonus Eligibility Banner */}
      <div className={`mb-6 p-4 rounded-xl border-2 text-center ${
        kpis.bonusEligible
          ? 'bg-accent-green/10 border-accent-green/50'
          : 'bg-accent-red/10 border-accent-red/50'
      }`}>
        <div className="flex items-center justify-center gap-2 mb-1">
          {kpis.bonusEligible ? (
            <Trophy className="w-6 h-6 text-accent-green" />
          ) : (
            <XCircle className="w-6 h-6 text-accent-red" />
          )}
          <span className={`text-xl font-bold ${kpis.bonusEligible ? 'text-accent-green' : 'text-accent-red'}`}>
            BONUS ELIGIBLE: {kpis.bonusEligible ? 'YES' : 'NO'}
          </span>
        </div>
        {kpis.bonusEligible && kpis.performanceTier.tier !== 'below' && (
          <p className="text-sm text-slate-300 mt-1">
            Performance Tier: <span className={`font-semibold ${kpis.performanceTier.color}`}>
              {kpis.performanceTier.label}
            </span>
            {kpis.performanceTier.perBooking > 0 && (
              <> — ${kpis.performanceTier.perBooking}/booking + ${kpis.performanceTier.tierBonus} tier bonus</>
            )}
          </p>
        )}
      </div>

      {/* KPI Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">KPI</th>
              <th className="text-center py-2 px-4 text-slate-400 font-medium">Today</th>
              <th className="text-center py-2 px-4 text-slate-400 font-medium hidden sm:table-cell">Target</th>
              <th className="text-center py-2 pl-4 text-slate-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {kpiRows.map((row) => (
              <tr key={row.label} className="border-b border-card-border/50">
                <td className="py-3 pr-4 text-slate-200">{row.label}</td>
                <td className="py-3 px-4 text-center font-semibold text-slate-100">{row.display}</td>
                <td className="py-3 px-4 text-center text-slate-400 text-xs hidden sm:table-cell">{row.target}</td>
                <td className="py-3 pl-4 text-center">
                  <StatusIcon status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Activity Minimums Checklist */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Activity Minimums (all 3 required for bonus)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: 'speedToLead', label: 'Under 5-min speed-to-lead', met: kpis.activityMinimums.speedToLead },
            { key: 'followupCompletion', label: '100% follow-up completion', met: kpis.activityMinimums.followupCompletion },
            { key: 'missedCallRate', label: 'Under 10% missed calls', met: kpis.activityMinimums.missedCallRate },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm">
              {item.met ? (
                <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-accent-red shrink-0" />
              )}
              <span className={item.met ? 'text-accent-green' : 'text-slate-400'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guardrail Warnings */}
      {(kpis.guardrails.cancellationWarning || kpis.guardrails.noshowWarning) && (
        <div className="mt-6 bg-accent-red/10 border border-accent-red/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-accent-red mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Quality Guardrail Warnings
          </h4>
          <div className="space-y-1 text-sm">
            {kpis.guardrails.cancellationWarning && (
              <p className="text-accent-red">
                Cancellation rate: {kpis.guardrails.cancellationRate}% (over 20% — bonus reduced 50%)
              </p>
            )}
            {kpis.guardrails.noshowWarning && (
              <p className="text-accent-red">
                No-show rate: {kpis.guardrails.noshowRate}% (over 15% — bonus reduced 25%)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Performance Overview</h4>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={chartColors[entry.fill]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Compensation Preview */}
      <div className="mt-6 bg-accent-gold/10 border border-accent-gold/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-accent-gold mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Today's Estimated Bonus
        </h4>
        <div className="space-y-2 text-sm">
          {/* Per-booking bonus */}
          <div className="flex justify-between">
            <span className="text-slate-400">
              Per-Booking ({kpis.totalBookings} x ${kpis.performanceTier.perBooking})
            </span>
            <span className="text-slate-100 font-medium">
              ${kpis.perBookingBonus}
              {kpis.guardrails.bonusMultiplier < 1 && (
                <span className="text-accent-red text-xs ml-1">
                  → ${kpis.adjustedPerBookingBonus} after guardrails
                </span>
              )}
            </span>
          </div>

          {/* Guaranteed bonus (new hire) */}
          {kpis.guaranteedBonus > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">New Hire Guaranteed</span>
              <span className="text-kanai-blue-light font-medium">${kpis.guaranteedBonus}</span>
            </div>
          )}

          {/* Accelerators */}
          {kpis.accelerators.upsells > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Upsells ({kpis.accelerators.upsells} x $5)</span>
              <span className="text-slate-100 font-medium">${kpis.accelerators.upsellBonus}</span>
            </div>
          )}
          {kpis.accelerators.reviews > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Review Assists ({kpis.accelerators.reviews} x $10)</span>
              <span className="text-slate-100 font-medium">${kpis.accelerators.reviewBonus}</span>
            </div>
          )}
          {kpis.accelerators.winbacks > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Win-Backs ({kpis.accelerators.winbacks} x $10)</span>
              <span className="text-slate-100 font-medium">${kpis.accelerators.winbackBonus}</span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between pt-2 border-t border-accent-gold/30">
            <span className="text-accent-gold font-semibold">Total Daily Bonus</span>
            <span className="text-accent-gold font-bold text-lg">${kpis.totalDailyBonus}</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Tier bonus of ${kpis.performanceTier.tierBonus} calculated per pay period, not daily.
          {kpis.guardrails.bonusMultiplier < 1 && ' Guardrail deductions applied.'}
        </p>
      </div>
    </FormCard>
  )
}
