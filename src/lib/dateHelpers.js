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

export const DATE_PRESETS = [
  { label: 'Today', getValue: () => { const d = getLocalDate(); return { start: d, end: d } } },
  { label: 'Yesterday', getValue: () => { const d = getLocalDate(-1); return { start: d, end: d } } },
  { label: 'This Week', getValue: () => getWeekRange(0) },
  { label: 'Last Week', getValue: () => getWeekRange(-1) },
  { label: 'This Month', getValue: () => getMonthRange(0) },
  { label: 'Last Month', getValue: () => getMonthRange(-1) },
  { label: 'Custom', getValue: () => null },
]
