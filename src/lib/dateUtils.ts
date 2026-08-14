function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DDTHH:mm" in local time, the format <input type="datetime-local"> expects/emits. */
export function nowAsDateTimeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateTimeLocal(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
