import { colorForIndex } from '../lib/palette'

interface PersonTagProps {
  name: string
  colorIndex: number
  size?: 'sm' | 'md'
  onRemove?: () => void
}

export default function PersonTag({ name, colorIndex, size = 'md', onRemove }: PersonTagProps) {
  const swatch = colorForIndex(colorIndex)
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding}`}
      style={{ backgroundColor: swatch.bg, color: swatch.text }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="ml-0.5 rounded-full leading-none opacity-60 hover:opacity-100"
        >
          &times;
        </button>
      )}
    </span>
  )
}
