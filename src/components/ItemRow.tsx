import type { Item, Person } from '../types'
import { colorForIndex } from '../lib/palette'

interface ItemRowProps {
  item: Item
  people: Person[]
  currencySymbol: string
  onChange: (patch: Partial<Item>) => void
  onDelete: () => void
}

export default function ItemRow({ item, people, currencySymbol, onChange, onDelete }: ItemRowProps) {
  const isEveryone = item.assignedTo.length === 0

  function toggleEveryone() {
    onChange({ assignedTo: [] })
  }

  function togglePerson(personId: string) {
    if (isEveryone) {
      onChange({ assignedTo: [personId] })
      return
    }
    const next = item.assignedTo.includes(personId)
      ? item.assignedTo.filter((id) => id !== personId)
      : [...item.assignedTo, personId]
    onChange({ assignedTo: next })
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Item name"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <div className="relative w-28 shrink-0">
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-slate-400">
            {currencySymbol}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={item.price === 0 ? '' : item.price}
            onChange={(e) => onChange({ price: e.target.valueAsNumber || 0 })}
            onFocus={(e) => e.target.select()}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.name || 'item'}`}
          className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-red-500"
        >
          &times;
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={toggleEveryone}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            isEveryone
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
          }`}
        >
          Everyone
        </button>
        {people.map((person) => {
          const active = !isEveryone && item.assignedTo.includes(person.id)
          const swatch = colorForIndex(person.colorIndex)
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => togglePerson(person.id)}
              className="rounded-full border px-2.5 py-1 text-xs font-medium transition"
              style={
                active
                  ? { backgroundColor: swatch.ring, borderColor: swatch.ring, color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#cbd5e1', color: '#64748b' }
              }
            >
              {person.name}
            </button>
          )
        })}
        {people.length === 0 && <span className="text-xs text-slate-400">Add people to assign this item.</span>}
      </div>
    </div>
  )
}
