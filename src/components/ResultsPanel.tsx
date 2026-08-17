import type { SplitSummary } from '../types'
import { formatCurrency } from '../lib/calculations'
import PersonTag from './PersonTag'

interface ResultsPanelProps {
  summary: SplitSummary
  tax: number
  currency: string
  paid: Record<string, boolean>
  onTogglePaid: (personId: string) => void
}

export default function ResultsPanel({ summary, tax, currency, paid, onTogglePaid }: ResultsPanelProps) {
  const { subtotal, tipAmount, totalWithTaxTip, results, isBalanced } = summary
  const collected = results.reduce((sum, r) => (paid[r.person.id] ? sum + r.costWithTaxTip : sum), 0)

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-800">Who owes what</h2>

      <div className="mt-4 flex items-start">
        {/* Frozen name column — a separate table outside the scroll area, so it can never move or grow a scrollbar of its own. */}
        <table className="shrink-0 border-collapse text-sm">
          <thead>
            <tr className="h-9 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="border-r border-slate-200 pr-6 font-medium">Person</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.person.id} className="h-11 border-b border-slate-100 last:border-0">
                <td className="border-r border-slate-200 pr-6">
                  <PersonTag name={r.person.name} colorIndex={r.person.colorIndex} size="sm" />
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td className="py-6" />
              </tr>
            )}
          </tbody>
        </table>

        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="h-9 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pl-3 pr-3 font-medium">% of meal</th>
                <th className="pr-3 font-medium">Items</th>
                <th className="pr-3 font-medium">+ Tax &amp; tip</th>
                <th className="pr-3 font-medium">With cash back</th>
                <th className="pr-3 text-center font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.person.id} className="h-11 border-b border-slate-100 last:border-0">
                  <td className="pl-3 pr-3 text-slate-500">{Math.round(r.shareFraction * 100)}%</td>
                  <td className="pr-3 text-slate-700">{formatCurrency(r.itemCost, currency)}</td>
                  <td className="pr-3 font-medium text-slate-900">{formatCurrency(r.costWithTaxTip, currency)}</td>
                  <td className="pr-3 font-medium text-emerald-600">{formatCurrency(r.costWithCashBack, currency)}</td>
                  <td className="pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!paid[r.person.id]}
                      onChange={() => onTogglePaid(r.person.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                    Add people and items to see the split.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-400">Subtotal</p>
          <p className="font-semibold text-slate-800">{formatCurrency(subtotal, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Tax</p>
          <p className="font-semibold text-slate-800">{formatCurrency(tax, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Tip</p>
          <p className="font-semibold text-slate-800">{formatCurrency(tipAmount, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Total</p>
          <p className="font-semibold text-slate-800">{formatCurrency(totalWithTaxTip, currency)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className={isBalanced ? 'text-slate-400' : 'text-amber-600'}>
          {isBalanced ? 'Splits reconcile with the bill total.' : "Splits don't add up to the total — check your entries."}
        </p>
        <p className="text-slate-500">
          Collected so far: <span className="font-semibold text-slate-800">{formatCurrency(collected, currency)}</span> /{' '}
          {formatCurrency(totalWithTaxTip, currency)}
        </p>
      </div>
    </section>
  )
}
