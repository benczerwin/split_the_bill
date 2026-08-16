import { useEffect, useRef } from 'react'
import type { TipMode } from '../types'

interface TaxTipPanelProps {
  tax: number
  tipMode: TipMode
  tipValue: number
  cashBackPercent: number
  onTaxChange: (value: number) => void
  onTipModeChange: (mode: TipMode) => void
  onTipValueChange: (value: number) => void
  onCashBackChange: (value: number) => void
}

export default function TaxTipPanel({
  tax,
  tipMode,
  tipValue,
  cashBackPercent,
  onTaxChange,
  onTipModeChange,
  onTipValueChange,
  onCashBackChange,
}: TaxTipPanelProps) {
  // Remembers the last nonzero tip so "No tip" (e.g. for a carry-out order) can be undone
  // with one tap instead of retyping the value.
  const lastTipValue = useRef(tipValue > 0 ? tipValue : 20)
  useEffect(() => {
    if (tipValue > 0) lastTipValue.current = tipValue
  }, [tipValue])

  function toggleTip() {
    onTipValueChange(tipValue > 0 ? 0 : lastTipValue.current)
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-800">Tax, tip &amp; cash back</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Tax ($)</span>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tax === 0 ? '' : tax}
              onChange={(e) => onTaxChange(e.target.valueAsNumber || 0)}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-slate-300 py-2 pl-6 pr-3 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </label>

        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tip</span>
            <button
              type="button"
              onClick={toggleTip}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              {tipValue > 0 ? 'No tip' : 'Add tip'}
            </button>
          </div>
          <div
            className={`mt-1 flex rounded-lg border focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 ${
              tipValue > 0 ? 'border-slate-300' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tipValue === 0 ? '' : tipValue}
              onChange={(e) => onTipValueChange(e.target.valueAsNumber || 0)}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-l-lg px-3 py-2 text-sm focus:outline-none"
            />
            <select
              value={tipMode}
              onChange={(e) => onTipModeChange(e.target.value as TipMode)}
              className="rounded-r-lg border-l border-slate-300 bg-slate-50 px-2 text-sm text-slate-600 focus:outline-none"
            >
              <option value="amount">$</option>
              <option value="percent">%</option>
            </select>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-500">Cash back (%)</span>
          <div className="relative mt-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={cashBackPercent === 0 ? '' : cashBackPercent}
              onChange={(e) => onCashBackChange(e.target.valueAsNumber || 0)}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-7 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">%</span>
          </div>
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Cash back shows what each person owes if you knock a percentage off for paying with cash (e.g. 4% cash-back
        card benefit).
      </p>
    </section>
  )
}
