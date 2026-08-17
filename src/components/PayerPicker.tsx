import type { Person } from '../types'
import { colorForIndex } from '../lib/palette'

interface PayerPickerProps {
  people: Person[]
  payerId: string | null
  onChange: (payerId: string | null) => void
}

export default function PayerPicker({ people, payerId, onChange }: PayerPickerProps) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-800">Who paid this bill?</h2>
      <p className="mt-1 text-xs text-slate-400">
        Carries over automatically if you add this bill into a Combine Receipts session.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {people.map((person) => {
          const active = payerId === person.id
          const swatch = colorForIndex(person.colorIndex)
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onChange(active ? null : person.id)}
              className="rounded-full border px-3 py-1.5 text-sm font-medium transition"
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
        {people.length === 0 && <span className="text-xs text-slate-400">Add people above first.</span>}
      </div>
    </section>
  )
}
