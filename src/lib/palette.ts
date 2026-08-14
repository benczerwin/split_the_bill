// Distinct, accessible colors assigned to people in a stable rotation.
export const PALETTE = [
  { bg: '#dbeafe', text: '#1e40af', ring: '#3b82f6' }, // blue
  { bg: '#dcfce7', text: '#166534', ring: '#22c55e' }, // green
  { bg: '#fef3c7', text: '#92400e', ring: '#f59e0b' }, // amber
  { bg: '#fce7f3', text: '#9d174d', ring: '#ec4899' }, // pink
  { bg: '#ede9fe', text: '#5b21b6', ring: '#8b5cf6' }, // violet
  { bg: '#ffedd5', text: '#9a3412', ring: '#f97316' }, // orange
  { bg: '#ccfbf1', text: '#115e59', ring: '#14b8a6' }, // teal
  { bg: '#fee2e2', text: '#991b1b', ring: '#ef4444' }, // red
  { bg: '#e0e7ff', text: '#3730a3', ring: '#6366f1' }, // indigo
  { bg: '#fae8ff', text: '#86198f', ring: '#d946ef' }, // fuchsia
]

export function colorForIndex(index: number) {
  return PALETTE[index % PALETTE.length]
}
