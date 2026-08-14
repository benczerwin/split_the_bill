import { useState } from 'react'
import type { Item, Person } from '../types'
import ItemRow from './ItemRow'
import SwipeToDelete from './SwipeToDelete'
import { formatCurrency } from '../lib/calculations'
import { CameraIcon } from './icons'

interface ItemsListProps {
  items: Item[]
  people: Person[]
  subtotal: number
  onAdd: () => void
  onChange: (id: string, patch: Partial<Item>) => void
  onDelete: (id: string) => void
  onScanReceipt: () => void
}

export default function ItemsList({ items, people, subtotal, onAdd, onChange, onDelete, onScanReceipt }: ItemsListProps) {
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Items</h2>
        <button
          type="button"
          onClick={onScanReceipt}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <CameraIcon className="h-4 w-4" />
          Scan receipt
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Tap the &ldquo;Everyone&rdquo; pill or specific names to control who splits each item. Swipe an item left to
        delete it.
      </p>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <SwipeToDelete
            key={item.id}
            onDelete={() => onDelete(item.id)}
            isOpen={openItemId === item.id}
            onOpenChange={(open) => setOpenItemId(open ? item.id : null)}
          >
            <ItemRow item={item} people={people} onChange={(patch) => onChange(item.id, patch)} onDelete={() => onDelete(item.id)} />
          </SwipeToDelete>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
            No items yet. Add one, or scan a receipt.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Add item
        </button>
        <p className="text-sm text-slate-600">
          Subtotal: <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
        </p>
      </div>
    </section>
  )
}
