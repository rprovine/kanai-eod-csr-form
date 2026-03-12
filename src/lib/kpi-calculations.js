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

export function getPerformanceTier(bookingRate) {
  if (bookingRate >= 70) return { tier: 'elite', label: 'Elite', color: 'text-accent-green', perBooking: 5, tierBonus: 200 }
  if (bookingRate >= 60) return { tier: 'standard', label: 'Standard', color: 'text-kanai-blue-light', perBooking: 3, tierBonus: 75 }
  if (bookingRate >= 50) return { tier: 'developing', label: 'Developing', color: 'text-accent-gold', perBooking: 0, tierBonus: 0 }
  return { tier: 'below', label: 'Below Target', color: 'text-accent-red', perBooking: 0, tierBonus: 0 }
}

export function calcFollowupCompletion(formData) {
  // Count follow-ups that have a result logged
  const completed = formData.followups?.filter(f => f.result)?.length || 0
  const total = formData.followups?.length || 0
  if (total === 0) return 100
  return (completed / total) * 100
}

export function calcAllKPIs(formData) {
  const missedCallRate = calcMissedCallRate(formData.missed_calls, formData.total_inbound_calls)
  const bookingRate = calcBookingRate(
    formData.disp_booked || 0,
    formData.disp_quoted || 0,
    formData.disp_followup_required || 0,
    formData.disp_lost || 0
  )
  const followupCompletion = calcFollowupCompletion(formData)
  const performanceTier = getPerformanceTier(bookingRate)

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

  const bonusEligible = Object.values(activityMinimums).every(Boolean)

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
    totalBookings: formData.disp_booked || 0,
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
