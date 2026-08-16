import { useRef, useState } from 'react'
import type { BillState, SplitSummary } from '../types'
import { computeSplit, formatCurrency } from '../lib/calculations'
import PersonTag from './PersonTag'

interface ReceiptEntry {
  id: string
  fileName: string
  status: 'loading' | 'done' | 'error'
  error?: string
  bill?: BillState
  summary?: SplitSummary
}

interface CombinedPerson {
  key: string
  name: string
  colorIndex: number
  perReceipt: Record<string, number>
  total: number
}

function uid(): string {
  return crypto.randomUUID()
}

function buildCombined(entries: ReceiptEntry[], useCashBack: boolean): CombinedPerson[] {
  const byKey = new Map<string, CombinedPerson>()
  for (const entry of entries) {
    if (entry.status !== 'done' || !entry.summary) continue
    for (const r of entry.summary.results) {
      const key = r.person.name.trim().toLowerCase()
      let combined = byKey.get(key)
      if (!combined) {
        combined = { key, name: r.person.name.trim(), colorIndex: byKey.size, perReceipt: {}, total: 0 }
        byKey.set(key, combined)
      }
      const amount = useCashBack ? r.costWithCashBack : r.costWithTaxTip
      combined.perReceipt[entry.id] = amount
      combined.total += amount
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.total - a.total)
}

interface CombineReceiptsModalProps {
  onClose: () => void
}

export default function CombineReceiptsModal({ onClose }: CombineReceiptsModalProps) {
  const [entries, setEntries] = useState<ReceiptEntry[]>([])
  const [useCashBack, setUseCashBack] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doneEntries = entries.filter((e) => e.status === 'done')
  const combined = buildCombined(entries, useCashBack)
  const grandTotal = combined.reduce((sum, p) => sum + p.total, 0)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const newEntries: ReceiptEntry[] = files.map((file) => ({ id: uid(), fileName: file.name, status: 'loading' }))
    setEntries((prev) => [...prev, ...newEntries])

    const { importBillFromPDF } = await import('../lib/pdfImport')
    // Decode one at a time — each PDF can take several render passes to lock onto its QR
    // code, so running a pile of them at once would spike memory on a phone.
    for (let i = 0; i < files.length; i++) {
      const entryId = newEntries[i].id
      try {
        const bill = await importBillFromPDF(files[i])
        const summary = computeSplit(bill)
        setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: 'done', bill, summary } : e)))
      } catch (err) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, status: 'error', error: err instanceof Error ? err.message : 'Could not read this PDF.' }
              : e,
          ),
        )
      }
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Combine receipts</h2>
            <p className="text-xs text-slate-400">
              Upload a bunch of exported bill PDFs to see each person&rsquo;s total across all of them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
          >
            + Add receipt PDFs
          </button>

          {entries.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                    entry.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {entry.status === 'done' && entry.bill ? entry.bill.title || entry.fileName : entry.fileName}
                    {entry.status === 'error' && ` — ${entry.error}`}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {entry.status === 'loading' && (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    )}
                    {entry.status === 'done' && entry.summary && (
                      <span className="font-medium text-slate-500">{formatCurrency(entry.summary.totalWithTaxTip)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="rounded-full px-1.5 text-slate-400 hover:text-red-500"
                      aria-label={`Remove ${entry.fileName}`}
                    >
                      &times;
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {combined.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Combined totals</h3>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={useCashBack}
                    onChange={(e) => setUseCashBack(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  With cash back applied
                </label>
              </div>

              <div className="mt-3 flex items-start">
                <table className="shrink-0 border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="border-r border-slate-200 py-2 pr-4 font-medium">Person</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combined.map((p) => (
                      <tr key={p.key} className="border-b border-slate-100 last:border-0">
                        <td className="border-r border-slate-200 py-2.5 pr-4">
                          <PersonTag name={p.name} colorIndex={p.colorIndex} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-max border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                        {doneEntries.map((entry) => (
                          <th
                            key={entry.id}
                            className="max-w-[7rem] truncate py-2 pl-3 pr-3 font-medium"
                            title={entry.bill?.title || entry.fileName}
                          >
                            {entry.bill?.title || entry.fileName}
                          </th>
                        ))}
                        <th className="py-2 pl-3 pr-3 font-semibold text-slate-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combined.map((p) => (
                        <tr key={p.key} className="border-b border-slate-100 last:border-0">
                          {doneEntries.map((entry) => (
                            <td key={entry.id} className="py-2.5 pl-3 pr-3 text-slate-700">
                              {entry.id in p.perReceipt ? (
                                formatCurrency(p.perReceipt[entry.id])
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          ))}
                          <td className="py-2.5 pl-3 pr-3 font-semibold text-slate-900">{formatCurrency(p.total)}</td>
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
            </div>
          )}

          {entries.length === 0 && (
            <p className="mt-4 text-center text-sm text-slate-400">
              No receipts yet — add a few PDFs exported from Split the Bill.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
