function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD" in local time, the format <input type="date"> expects/emits. */
export function nowAsDateOnly(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Coerces any previously-stored date value to plain "YYYY-MM-DD". Older saved bills (and
 * PDFs exported before the date field dropped its time component) hold a datetime-local
 * value like "2026-08-14T19:30" — a value <input type="date"> rejects as invalid, so it
 * would otherwise render blank. Falls back to today when there's nothing usable.
 */
export function toDateOnly(value: string | undefined | null): string {
  const datePart = value?.split('T')[0]
  return datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : nowAsDateOnly()
}

export function formatDateOnly(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return value
  // Built from parts (not `new Date(value)`) so it's interpreted in local time, not UTC —
  // otherwise the date can shift a day backward for timezones west of UTC.
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function monthIndexFromName(name: string): number {
  return MONTH_NAMES.findIndex((m) => name.toLowerCase().startsWith(m))
}

function isPlausibleDate(year: number, month: number, day: number): boolean {
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/** Best-effort search for a printed date (receipt/scanned text) in common formats, normalized to "YYYY-MM-DD". */
export function extractDateFromText(text: string): string | null {
  let m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (m) {
    const [, y, mo, d] = m.map(Number)
    if (isPlausibleDate(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`
  }

  m = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    const rawYear = m[3]
    const year = rawYear.length === 2 ? (Number(rawYear) < 70 ? 2000 + Number(rawYear) : 1900 + Number(rawYear)) : Number(rawYear)
    if (isPlausibleDate(year, month, day)) return `${year}-${pad(month)}-${pad(day)}`
  }

  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (m) {
    const monthIdx = monthIndexFromName(m[1])
    const day = Number(m[2])
    const year = Number(m[3])
    if (monthIdx >= 0 && isPlausibleDate(year, monthIdx + 1, day)) return `${year}-${pad(monthIdx + 1)}-${pad(day)}`
  }

  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/)
  if (m) {
    const day = Number(m[1])
    const monthIdx = monthIndexFromName(m[2])
    const year = Number(m[3])
    if (monthIdx >= 0 && isPlausibleDate(year, monthIdx + 1, day)) return `${year}-${pad(monthIdx + 1)}-${pad(day)}`
  }

  return null
}
