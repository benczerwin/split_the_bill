import { useRef, useState } from 'react'
import { computeSplit, formatCurrency } from '../lib/calculations'
import PersonTag from './PersonTag'
import ReceiptSection, { type ReceiptEntry } from './ReceiptSection'

interface CombinedPerson {
  key: string
  name: string
  colorIndex: number
  perReceipt: Record<string, number>
  total: number
}

interface Balance {
  key: string
  name: string
  colorIndex: number
  paid: number
  owed: number
  net: number
}

interface Settlement {
  fromName: string
  toName: string
  amount: number
}

const EPSILON = 0.005

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

// Balances always use the full bill total for what a payer fronted — cash back is a discount the
// payer chooses to offer people paying them back in cash, it doesn't change what was actually
// handed to the restaurant.
function buildBalances(entries: ReceiptEntry[], combined: CombinedPerson[]): Balance[] {
  const byKey = new Map<string, Balance>()
  for (const c of combined) {
    byKey.set(c.key, { key: c.key, name: c.name, colorIndex: c.colorIndex, paid: 0, owed: c.total, net: 0 })
  }
  for (const entry of entries) {
    if (entry.status !== 'done' || !entry.bill || !entry.summary || !entry.payerId) continue
    const payer = entry.bill.people.find((p) => p.id === entry.payerId)
    if (!payer) continue
    const key = payer.name.trim().toLowerCase()
    let balance = byKey.get(key)
    if (!balance) {
      balance = { key, name: payer.name.trim(), colorIndex: byKey.size, paid: 0, owed: 0, net: 0 }
      byKey.set(key, balance)
    }
    balance.paid += entry.summary.totalWithTaxTip
  }
  for (const balance of byKey.values()) balance.net = balance.paid - balance.owed
  return Array.from(byKey.values()).sort((a, b) => b.net - a.net)
}

// Greedily matches the biggest creditor against the biggest debtor until every balance is
// settled — a standard debt-simplification approach that keeps the payment list short.
function simplifySettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net > EPSILON)
    .map((b) => ({ name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = balances
    .filter((b) => b.net < -EPSILON)
    .map((b) => ({ name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor = debtors[j]
    const amount = Math.min(creditor.amount, debtor.amount)
    if (amount > EPSILON) settlements.push({ fromName: debtor.name, toName: creditor.name, amount })
    creditor.amount -= amount
    debtor.amount -= amount
    if (creditor.amount <= EPSILON) i++
    if (debtor.amount <= EPSILON) j++
  }
  return settlements
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
  const balances = buildBalances(entries, combined)
  const settlements = simplifySettlements(balances)
  const missingPayerCount = doneEntries.filter((e) => !e.payerId).length

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const newEntries: ReceiptEntry[] = files.map((file) => ({
      id: uid(),
      fileName: file.name,
      status: 'loading',
      payerId: null,
      expanded: true,
    }))
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

  function toggleExpanded(id: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e)))
  }

  function setPayer(id: string, payerId: string | null) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, payerId } : e)))
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
              Upload exported bill PDFs, mark who paid each one, and see who owes who what overall.
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
            <div className="mt-4 space-y-2">
              {entries.map((entry) => (
                <ReceiptSection
                  key={entry.id}
                  entry={entry}
                  onRemove={() => removeEntry(entry.id)}
                  onToggleExpanded={() => toggleExpanded(entry.id)}
                  onSetPayer={(payerId) => setPayer(entry.id, payerId)}
                />
              ))}
            </div>
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

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-800">Balances</h3>
                {missingPayerCount > 0 && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {missingPayerCount} of {doneEntries.length} receipt{missingPayerCount === 1 ? '' : 's'} don&rsquo;t
                    have a payer set — mark who paid each one for accurate balances.
                  </p>
                )}
                <div className="mt-3 space-y-1.5">
                  {balances.map((b) => (
                    <div key={b.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <PersonTag name={b.name} colorIndex={b.colorIndex} size="sm" />
                      <span className="text-xs text-slate-400">
                        paid {formatCurrency(b.paid)} · owes {formatCurrency(b.owed)}
                      </span>
                      <span className={`font-semibold ${b.net > EPSILON ? 'text-emerald-600' : b.net < -EPSILON ? 'text-red-600' : 'text-slate-400'}`}>
                        {b.net > EPSILON ? `is owed ${formatCurrency(b.net)}` : b.net < -EPSILON ? `owes ${formatCurrency(-b.net)}` : 'settled up'}
                      </span>
                    </div>
                  ))}
                </div>

                <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Suggested settlements
                </h4>
                {settlements.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {settlements.map((s, idx) => (
                      <li key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <span className="text-slate-700">
                          <span className="font-medium">{s.fromName}</span> pays{' '}
                          <span className="font-medium">{s.toName}</span>
                        </span>
                        <span className="font-semibold text-slate-900">{formatCurrency(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">Everyone&rsquo;s settled up.</p>
                )}
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
