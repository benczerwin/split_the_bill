import { useRef } from 'react'
import type { CombineState, SavedReceipt, SettleGroupBy } from '../types'
import { formatCurrency } from '../lib/calculations'
import {
  buildBalances,
  buildCombined,
  buildNameColorMap,
  groupSettlements,
  simplifySettlements,
  SETTLEMENT_EPSILON,
} from '../lib/combineCalculations'
import PersonTag from './PersonTag'
import ReceiptSection from './ReceiptSection'
import { PencilIcon } from './icons'

interface CombinePageProps {
  combineState: CombineState
  library: SavedReceipt[]
  onAddFiles: (files: FileList | null) => void
  onStartNewBillForCombine: () => void
  onRemoveReceipt: (id: string) => void
  onToggleExpanded: (id: string) => void
  onSetPayer: (id: string, payerId: string | null) => void
  onCashBackPercentChange: (value: number) => void
  onSettleGroupByChange: (value: SettleGroupBy) => void
  onAddFromLibrary: (ids: string[]) => void
  onEditLibraryItem: (id: string) => void
  onRemoveLibraryItem: (id: string) => void
  onClearLibrary: () => void
}

export default function CombinePage({
  combineState,
  library,
  onAddFiles,
  onStartNewBillForCombine,
  onRemoveReceipt,
  onToggleExpanded,
  onSetPayer,
  onCashBackPercentChange,
  onSettleGroupByChange,
  onAddFromLibrary,
  onEditLibraryItem,
  onRemoveLibraryItem,
  onClearLibrary,
}: CombinePageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { receipts, cashBackPercent, settleGroupBy } = combineState
  const doneEntries = receipts.filter((e) => e.status === 'done')
  const addedLibraryIds = new Set(receipts.map((e) => e.libraryId).filter((id): id is string => !!id))

  const nameColorMap = buildNameColorMap(receipts)
  const combined = buildCombined(receipts, nameColorMap, cashBackPercent)
  const grandTotal = combined.reduce((sum, p) => sum + p.total, 0)
  const balances = buildBalances(receipts, combined, nameColorMap)
  const settlements = simplifySettlements(balances)
  const groupedSettlements = groupSettlements(settlements, settleGroupBy)
  const missingPayerCount = doneEntries.filter((e) => !e.payerId).length

  // Checking a box adds that bill immediately; if it's already in the combine list, the same
  // checkbox doubles as a remove shortcut — no staging step, no separate "add selected" button.
  function toggleLibraryItem(libraryId: string) {
    const addedEntry = receipts.find((r) => r.libraryId === libraryId)
    if (addedEntry) {
      onRemoveReceipt(addedEntry.id)
    } else {
      onAddFromLibrary([libraryId])
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">From your device ({library.length})</h2>
          {library.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear your saved receipt library? This only affects receipts saved on this device.')) {
                  onClearLibrary()
                }
              }}
              className="text-xs font-medium text-slate-400 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
        {library.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            Bills you clear or save from Single Bill mode appear here automatically, so you can add them into a
            combine session without exporting and re-uploading a PDF.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-400">Check a bill to add it below; uncheck to remove it.</p>
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {library.map((item) => {
                const alreadyAdded = addedLibraryIds.has(item.id)
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={alreadyAdded}
                        onChange={() => toggleLibraryItem(item.id)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{item.bill.title || 'Untitled bill'}</span>
                      {alreadyAdded && <span className="shrink-0 text-xs font-medium text-emerald-600">Added</span>}
                      <span className="shrink-0 text-xs text-slate-400">{item.bill.date}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onEditLibraryItem(item.id)}
                      aria-label={`Edit ${item.bill.title || 'saved bill'}`}
                      className="shrink-0 rounded-full p-1 text-slate-300 hover:text-slate-600"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveLibraryItem(item.id)}
                      aria-label={`Remove ${item.bill.title || 'saved bill'} from library`}
                      className="shrink-0 rounded-full px-1 text-slate-300 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            onAddFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
          >
            + Add receipt PDFs
          </button>
          <button
            type="button"
            onClick={onStartNewBillForCombine}
            className="rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
          >
            + Build a new bill
          </button>
        </div>

        {receipts.length > 0 && (
          <div className="mt-4 space-y-2">
            {receipts.map((entry) => (
              <ReceiptSection
                key={entry.id}
                entry={entry}
                nameColorMap={nameColorMap}
                onRemove={() => onRemoveReceipt(entry.id)}
                onToggleExpanded={() => onToggleExpanded(entry.id)}
                onSetPayer={(payerId) => onSetPayer(entry.id, payerId)}
              />
            ))}
          </div>
        )}

        {receipts.length === 0 && (
          <p className="mt-4 text-center text-sm text-slate-400">
            No receipts yet — add some from your library above, upload a few exported PDFs, or build one from
            scratch.
          </p>
        )}
      </section>

      {combined.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Combined totals</h2>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Cash back
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={cashBackPercent === 0 ? '' : cashBackPercent}
                  onChange={(e) => onCashBackPercentChange(e.target.valueAsNumber || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-14 rounded-lg border border-slate-300 py-1 pl-2 pr-5 text-right text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-xs text-slate-400">%</span>
              </div>
            </label>
          </div>

          <div className="mt-3 flex items-start">
            {/* Frozen name column — a separate table outside the scroll area. Row heights are
                forced equal (h-9/h-11) so this table's lines stay aligned with the scrollable
                one, since a plain PersonTag pill and a currency string don't naturally render
                at the same height. */}
            <table className="shrink-0 border-collapse text-sm">
              <thead>
                <tr className="h-9 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="border-r border-slate-200 pr-4 font-medium">Person</th>
                </tr>
              </thead>
              <tbody>
                {combined.map((p) => (
                  <tr key={p.key} className="h-11 border-b border-slate-100 last:border-0">
                    <td className="border-r border-slate-200 pr-4">
                      <PersonTag name={p.name} colorIndex={p.colorIndex} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="h-9 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    {doneEntries.map((entry) => (
                      <th
                        key={entry.id}
                        className="max-w-[7rem] truncate pl-3 pr-3 font-medium"
                        title={entry.bill?.title || entry.fileName}
                      >
                        {entry.bill?.title || entry.fileName}
                      </th>
                    ))}
                    <th className="pl-3 pr-3 font-semibold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.map((p) => (
                    <tr key={p.key} className="h-11 border-b border-slate-100 last:border-0">
                      {doneEntries.map((entry) => (
                        <td key={entry.id} className="pl-3 pr-3 text-slate-700">
                          {entry.id in p.perReceipt ? (
                            formatCurrency(p.perReceipt[entry.id])
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="pl-3 pr-3 font-semibold text-slate-900">{formatCurrency(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm">
            <span className="text-slate-500">
              {doneEntries.length} receipt{doneEntries.length === 1 ? '' : 's'} combined
            </span>
            <span className="font-semibold text-slate-800">Grand total: {formatCurrency(grandTotal)}</span>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-800">Balances</h3>
            {missingPayerCount > 0 && (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {missingPayerCount} of {doneEntries.length} receipt{missingPayerCount === 1 ? '' : 's'} don&rsquo;t have
                a payer set — mark who paid each one for accurate balances.
              </p>
            )}
            <div className="mt-3 space-y-1.5">
              {balances.map((b) => (
                <div key={b.key} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <PersonTag name={b.name} colorIndex={b.colorIndex} size="sm" />
                    <span
                      className={`font-semibold ${
                        b.net > SETTLEMENT_EPSILON ? 'text-emerald-600' : b.net < -SETTLEMENT_EPSILON ? 'text-red-600' : 'text-slate-400'
                      }`}
                    >
                      {b.net > SETTLEMENT_EPSILON
                        ? `is owed ${formatCurrency(b.net)}`
                        : b.net < -SETTLEMENT_EPSILON
                          ? `owes ${formatCurrency(-b.net)}`
                          : 'settled up'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    paid {formatCurrency(b.paid)} · owes {formatCurrency(b.owed)}
                  </p>
                </div>
              ))}
            </div>

            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested settlements</h4>
            {settlements.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">Group by</span>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onSettleGroupByChange('payer')}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      settleGroupBy === 'payer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Who pays
                  </button>
                  <button
                    type="button"
                    onClick={() => onSettleGroupByChange('payee')}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      settleGroupBy === 'payee' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Who&rsquo;s owed
                  </button>
                </div>
              </div>
            )}
            {groupedSettlements.length > 0 ? (
              <div className="mt-2 space-y-3">
                {groupedSettlements.map(([name, items]) => (
                  <div key={name}>
                    <p className="text-xs font-semibold text-slate-600">{name}</p>
                    <ul className="mt-1 space-y-1.5">
                      {items.map((s, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          <span className="text-slate-700">
                            {settleGroupBy === 'payer' ? (
                              <>
                                pays <span className="font-medium">{s.toName}</span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">{s.fromName}</span> pays
                              </>
                            )}
                          </span>
                          <span className="font-semibold text-slate-900">{formatCurrency(s.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Everyone&rsquo;s settled up.</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
