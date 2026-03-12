// Date helper functions for Reports view

export function getLocalDate(offsetDays = 0) {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateLocal(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWeekRange(offsetWeeks = 0) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek + (offsetWeeks * 7))
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  return {
    start: formatDateLocal(startOfWeek),
    end: formatDateLocal(endOfWeek),
  }
}

export function getMonthRange(offsetMonths = 0) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offsetMonths
  const startOfMonth = new Date(year, month, 1)
  const endOfMonth = new Date(year, month + 1, 0)

  return {
    start: formatDateLocal(startOfMonth),
    end: formatDateLocal(endOfMonth),
  }
}

export function formatDisplayDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Get the bi-weekly pay period containing a given date.
 * Kanai uses bi-weekly pay periods starting from a known anchor date.
 * Anchor: Jan 6, 2026 (Monday) — first pay period of 2026.
 */
export function getPayPeriodRange(date = new Date()) {
  const anchor = new Date(2026, 0, 6) // Jan 6, 2026
  const target = new Date(date)
  const diffDays = Math.floor((target - anchor) / (1000 * 60 * 60 * 24))
  const periodIndex = Math.floor(diffDays / 14)
  const periodStart = new Date(anchor)
  periodStart.setDate(anchor.getDate() + (periodIndex * 14))
  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodStart.getDate() + 13)

  return {
    start: formatDateLocal(periodStart),
    end: formatDateLocal(periodEnd),
    label: `${formatDisplayDate(formatDateLocal(periodStart))} – ${formatDisplayDate(formatDateLocal(periodEnd))}`,
  }
}

export function getCurrentPayPeriod() {
  return getPayPeriodRange(new Date())
}

export function getPreviousPayPeriod() {
  const current = getPayPeriodRange(new Date())
  const start = new Date(current.start + 'T00:00:00')
  start.setDate(start.getDate() - 1) // go to last day of previous period
  return getPayPeriodRange(start)
}

export const DATE_PRESETS = [
  { label: 'Today', getValue: () => { const d = getLocalDate(); return { start: d, end: d } } },
  { label: 'Yesterday', getValue: () => { const d = getLocalDate(-1); return { start: d, end: d } } },
  { label: 'This Week', getValue: () => getWeekRange(0) },
  { label: 'Last Week', getValue: () => getWeekRange(-1) },
  { label: 'Pay Period', getValue: () => { const pp = getCurrentPayPeriod(); return { start: pp.start, end: pp.end } } },
  { label: 'Last Pay Period', getValue: () => { const pp = getPreviousPayPeriod(); return { start: pp.start, end: pp.end } } },
  { label: 'This Month', getValue: () => getMonthRange(0) },
  { label: 'Custom', getValue: () => null },
]
