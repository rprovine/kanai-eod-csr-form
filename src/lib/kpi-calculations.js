export function calcMissedCallRate(missedCalls, totalInbound) {
  if (!totalInbound || totalInbound === 0) return 0
  return (missedCalls / totalInbound) * 100
}

export function calcBookingRate(booked, quoted, followup, lost) {
  const denominator = booked + quoted + followup + lost
  if (denominator === 0) return 0
  return (booked / denominator) * 100
}

export function calcTotalHours(shiftStart, shiftEnd) {
  if (!shiftStart || !shiftEnd) return 0
  const [startH, startM] = shiftStart.split(':').map(Number)
  const [endH, endM] = shiftEnd.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const diff = endMinutes - startMinutes
  if (diff <= 0) return 0
  return Math.round((diff / 60) * 100) / 100
}

export function getPerformanceTier(bookingRate, isRamp = false) {
  if (isRamp) {
    // New hire ramp: 40% threshold for weeks 3-4
    if (bookingRate >= 70) return { tier: 'elite', label: 'Elite', color: 'text-accent-green', perBooking: 5, tierBonus: 200 }
    if (bookingRate >= 60) return { tier: 'standard', label: 'Standard', color: 'text-kanai-blue-light', perBooking: 3, tierBonus: 75 }
    if (bookingRate >= 40) return { tier: 'developing', label: 'Developing (Ramp)', color: 'text-accent-gold', perBooking: 0, tierBonus: 0 }
    return { tier: 'below', label: 'Below Target', color: 'text-accent-red', perBooking: 0, tierBonus: 0 }
  }
  if (bookingRate >= 70) return { tier: 'elite', label: 'Elite', color: 'text-accent-green', perBooking: 5, tierBonus: 200 }
  if (bookingRate >= 60) return { tier: 'standard', label: 'Standard', color: 'text-kanai-blue-light', perBooking: 3, tierBonus: 75 }
  if (bookingRate >= 50) return { tier: 'developing', label: 'Developing', color: 'text-accent-gold', perBooking: 0, tierBonus: 0 }
  return { tier: 'below', label: 'Below Target', color: 'text-accent-red', perBooking: 0, tierBonus: 0 }
}

export function calcFollowupCompletion(formData) {
  const completed = formData.followups?.filter(f => f.result)?.length || 0
  const total = formData.followups?.length || 0
  if (total === 0) return 100
  return (completed / total) * 100
}

/**
 * Calculate new hire ramp status from hire_date
 * Returns: { isNewHire, rampWeek, guaranteedBonus, useReducedThreshold }
 */
export function calcNewHireRamp(hireDate) {
  if (!hireDate) return { isNewHire: false, rampWeek: 0, guaranteedBonus: 0, useReducedThreshold: false }

  const hire = new Date(hireDate)
  const today = new Date()
  const daysSinceHire = Math.floor((today - hire) / (1000 * 60 * 60 * 24))

  if (daysSinceHire > 30) return { isNewHire: false, rampWeek: 0, guaranteedBonus: 0, useReducedThreshold: false }

  const rampWeek = Math.floor(daysSinceHire / 7) + 1

  if (rampWeek <= 2) {
    // Weeks 1-2: guaranteed $100 bonus
    return { isNewHire: true, rampWeek, guaranteedBonus: 100, useReducedThreshold: false }
  }
  // Weeks 3-4: 40% booking rate threshold
  return { isNewHire: true, rampWeek, guaranteedBonus: 0, useReducedThreshold: true }
}

/**
 * Calculate guardrail deductions
 * - Cancellation rate >20% → bonus drops 50%
 * - No-show rate >15% → bonus reduced 25%
 */
export function calcGuardrailDeductions(formData) {
  const totalBooked = formData.disp_booked || 0
  const cancellations = formData.cancellation_count || 0
  const noShows = formData.noshow_count || 0

  let cancellationRate = 0
  let noshowRate = 0
  let bonusMultiplier = 1.0

  if (totalBooked > 0) {
    cancellationRate = (cancellations / totalBooked) * 100
    noshowRate = (noShows / totalBooked) * 100
  }

  if (cancellationRate > 20) bonusMultiplier *= 0.5
  if (noshowRate > 15) bonusMultiplier *= 0.75

  return {
    cancellationRate: Math.round(cancellationRate * 10) / 10,
    noshowRate: Math.round(noshowRate * 10) / 10,
    cancellationWarning: cancellationRate > 20,
    noshowWarning: noshowRate > 15,
    bonusMultiplier,
  }
}

/**
 * Calculate bonus accelerator earnings for the day
 */
export function calcAcceleratorBonus(formData) {
  const upsells = formData.upsell_count || 0
  const reviews = formData.review_assists || 0
  const winbacks = formData.winback_bookings || 0

  return {
    upsellBonus: upsells * 5,
    reviewBonus: reviews * 10,
    winbackBonus: winbacks * 10,
    totalAccelerator: (upsells * 5) + (reviews * 10) + (winbacks * 10),
    upsells,
    reviews,
    winbacks,
  }
}

export function calcAllKPIs(formData, { hireDate } = {}) {
  const missedCallRate = calcMissedCallRate(formData.missed_calls, formData.total_inbound_calls)
  const bookingRate = calcBookingRate(
    formData.disp_booked || 0,
    formData.disp_quoted || 0,
    formData.disp_followup_required || 0,
    formData.disp_lost || 0
  )
  const followupCompletion = calcFollowupCompletion(formData)

  // New hire ramp
  const ramp = calcNewHireRamp(hireDate)
  const performanceTier = getPerformanceTier(bookingRate, ramp.useReducedThreshold)

  const pipelineClean =
    formData.pipeline_new_leads_contacted &&
    formData.pipeline_no_stale_leads &&
    formData.pipeline_booked_updated &&
    formData.pipeline_lost_updated &&
    formData.pipeline_quoted_followup_scheduled &&
    formData.pipeline_stages_match

  // Speed-to-lead: prefer numeric GHL value, fall back to dropdown enum
  let speedToLeadMet = false
  if (formData.speed_to_lead_minutes != null && formData.speed_to_lead_minutes > 0) {
    speedToLeadMet = formData.speed_to_lead_minutes < 5
  } else {
    speedToLeadMet = formData.speed_to_lead === 'under_5'
  }

  // Activity minimums
  const activityMinimums = {
    speedToLead: speedToLeadMet,
    followupCompletion: followupCompletion >= 100,
    missedCallRate: missedCallRate < 10,
  }

  const bonusEligible = ramp.guaranteedBonus > 0 || Object.values(activityMinimums).every(Boolean)

  // Guardrails and accelerators
  const guardrails = calcGuardrailDeductions(formData)
  const accelerators = calcAcceleratorBonus(formData)

  // Total bookings and qualified leads for bonus calc
  const totalBookings = formData.disp_booked || 0
  const qualifiedLeads = (formData.disp_booked || 0) + (formData.disp_quoted || 0) +
    (formData.disp_followup_required || 0) + (formData.disp_lost || 0)

  // Daily bonus estimate
  let perBookingBonus = 0
  if (bonusEligible && performanceTier.perBooking > 0) {
    perBookingBonus = totalBookings * performanceTier.perBooking
  }

  // Apply guardrail multiplier
  const adjustedPerBookingBonus = Math.round(perBookingBonus * guardrails.bonusMultiplier)

  // Guaranteed bonus for new hire weeks 1-2
  const guaranteedBonus = ramp.guaranteedBonus

  // Total daily bonus estimate (per-booking + accelerators, after guardrails)
  const totalDailyBonus = Math.max(guaranteedBonus, adjustedPerBookingBonus) + accelerators.totalAccelerator

  return {
    bookingRate: Math.round(bookingRate * 10) / 10,
    missedCallRate: Math.round(missedCallRate * 10) / 10,
    speedToLead: formData.speed_to_lead,
    speedToLeadMinutes: formData.speed_to_lead_minutes,
    followupCompletion: Math.round(followupCompletion * 10) / 10,
    pipelineClean,
    performanceTier,
    activityMinimums,
    bonusEligible,
    totalBookings,
    qualifiedLeads,
    ramp,
    guardrails,
    accelerators,
    perBookingBonus,
    adjustedPerBookingBonus,
    guaranteedBonus,
    totalDailyBonus,
  }
}

export function getKPIStatus(value, target, comparison = 'gte') {
  if (comparison === 'gte') {
    if (value >= target) return 'green'
    if (value >= target * 0.9) return 'yellow'
    return 'red'
  }
  if (comparison === 'lte') {
    if (value <= target) return 'green'
    if (value <= target * 1.1) return 'yellow'
    return 'red'
  }
  if (comparison === 'eq') {
    return value === target ? 'green' : 'red'
  }
  return 'red'
}
