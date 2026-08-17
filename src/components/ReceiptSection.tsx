import { useEffect, useState } from 'react'
import type { CombineReceiptEntry } from '../types'
import { formatCurrency } from '../lib/calculations'
import { colorForIndex } from '../lib/palette'
import { computeBillDisplay } from '../lib/currency'
import PersonTag from './PersonTag'
import { ChevronDownIcon, PencilIcon } from './icons'

interface ReceiptSectionProps {
  entry: CombineReceiptEntry
  /** Maps a lowercased, trimmed person name to one shared colorIndex, so the same person
   *  looks the same everywhere in Combine Receipts even though each bill assigned its own
   *  colors independently when it was created. */
  nameColorMap: Map<string, number>
  /** USD-based exchange rates, if fetched — used to convert this receipt into its own charged
   *  currency for display when it doesn't have an entered charged total. */
  usdRates: Record<string, number> | null
  /** Briefly flashes then fades this card's background — used right after it's added/updated
   *  from the single-bill build/edit flows, so the change is noticeable but not jarring. */
  highlighted?: boolean
  onRemove: () => void
  onEdit: () => void
  onToggleExpanded: () => void
  onSetPayer: (personId: string | null) => void
}

export default function ReceiptSection({
  entry,
  nameColorMap,
  usdRates,
  highlighted,
  onRemove,
  onEdit,
  onToggleExpanded,
  onSetPayer,
}: ReceiptSectionProps) {
  const label = entry.status === 'done' && entry.bill ? entry.bill.title || entry.fileName : entry.fileName
  const canExpand = entry.status === 'done'
  const display =
    entry.status === 'done' && entry.bill && entry.summary ? computeBillDisplay(entry.bill, entry.summary, usdRates) : null

  // The animation only needs to run once per highlight — re-mounting the class on every
  // render (e.g. when other state in the list changes) would restart the flash repeatedly.
  const [playFlash, setPlayFlash] = useState(!!highlighted)
  useEffect(() => {
    if (highlighted) setPlayFlash(true)
  }, [highlighted])

  function colorIndexFor(name: string, fallback: number): number {
    return nameColorMap.get(name.trim().toLowerCase()) ?? fallback
  }

  return (
    <div
      className={`rounded-xl border ${entry.status === 'error' ? 'border-red-200' : 'border-slate-200'} ${playFlash ? 'flash-fade' : ''}`}
      onAnimationEnd={() => setPlayFlash(false)}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleExpanded}
            disabled={!canExpand}
            className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
          >
            {entry.status === 'loading' && (
              <span className="block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            )}
            {canExpand && (
              <ChevronDownIcon
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${entry.expanded ? '' : '-rotate-90'}`}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{label}</span>
          </button>
          {canExpand && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${label}`}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500"
          >
            &times;
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-slate-400">
          {entry.bill?.date && <span>{entry.bill.date}</span>}
          {display && (
            <span className="font-medium text-slate-600">{formatCurrency(display.summary.totalWithTaxTip, display.currency)}</span>
          )}
          {display && entry.bill && display.currency !== entry.bill.currency && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              charged in {display.currency}
            </span>
          )}
          {entry.status === 'done' && !entry.payerId && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">No payer</span>
          )}
        </div>
      </div>

      {entry.status === 'error' && (
        <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{entry.error}</p>
      )}

      {canExpand && entry.expanded && entry.bill && entry.summary && (
        <div className="space-y-4 border-t border-slate-100 px-3 py-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Who paid this bill?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.bill.people.map((person) => {
                const active = entry.payerId === person.id
                const swatch = colorForIndex(colorIndexFor(person.name, person.colorIndex))
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onSetPayer(active ? null : person.id)}
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
              {entry.bill.people.length === 0 && (
                <span className="text-xs text-slate-400">No people on this receipt.</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-3 font-medium">Item</th>
                  <th className="py-1.5 pr-3 font-medium">Price</th>
                  <th className="py-1.5 pr-3 font-medium">Who</th>
                </tr>
              </thead>
              <tbody>
                {entry.bill.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 text-slate-700">{item.name || 'Untitled item'}</td>
                    <td className="py-1.5 pr-3 text-slate-700">{formatCurrency(item.price, entry.bill?.currency)}</td>
                    <td className="py-1.5 pr-3 text-slate-500">
                      {item.assignedTo.length === 0
                        ? 'Everyone'
                        : item.assignedTo
                            .map((pid) => entry.bill?.people.find((p) => p.id === pid)?.name)
                            .filter(Boolean)
                            .join(', ')}
                    </td>
                  </tr>
                ))}
                {entry.bill.items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-2 text-center text-slate-400">
                      No items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[240px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-3 font-medium">Person</th>
                  <th className="py-1.5 pr-3 font-medium">Owes</th>
                </tr>
              </thead>
              <tbody>
                {(display?.summary.results ?? entry.summary.results).map((r) => (
                  <tr key={r.person.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3">
                      <PersonTag
                        name={r.person.name}
                        colorIndex={colorIndexFor(r.person.name, r.person.colorIndex)}
                        size="sm"
                      />
                    </td>
                    <td className="py-1.5 pr-3 font-medium text-slate-900">
                      {formatCurrency(r.costWithTaxTip, display?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
