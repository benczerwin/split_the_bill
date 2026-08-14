import { useState } from 'react'
import type { Person } from '../types'
import PersonTag from './PersonTag'

interface PeopleManagerProps {
  people: Person[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}

export default function PeopleManager({ people, onAdd, onRemove }: PeopleManagerProps) {
  const [name, setName] = useState('')

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-800">Who&rsquo;s splitting the bill?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {people.map((person) => (
          <PersonTag key={person.id} name={person.name} colorIndex={person.colorIndex} onRemove={() => onRemove(person.id)} />
        ))}
        {people.length === 0 && <p className="text-sm text-slate-400">Add everyone splitting the bill below.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Add a person's name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add
        </button>
      </div>
    </section>
  )
}
