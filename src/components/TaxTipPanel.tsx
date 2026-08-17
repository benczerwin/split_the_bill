import { useEffect, useRef } from 'react'
import type { TipMode } from '../types'

interface TaxTipPanelProps {
  tax: number
  tipMode: TipMode
  tipValue: number
  cashBackPercent: number
  currencySymbol: string
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
  currencySymbol,
  onTaxChange,
  onTipModeChange,
  onTipValueChange,
  onCashBackChange,
}: TaxTipPanelProps) {
  // Remembers the last nonzero value for each field so unchecking its "Add ___" box (e.g. a
  // carry-out order with no tax collected) and rechecking it later restores the value instead
  // of leaving it at 0.
  const lastTaxValue = useRef(tax > 0 ? tax : 5)
  useEffect(() => {
    if (tax > 0) lastTaxValue.current = tax
  }, [tax])

  const lastTipValue = useRef(tipValue > 0 ? tipValue : 20)
  useEffect(() => {
    if (tipValue > 0) lastTipValue.current = tipValue
  }, [tipValue])

  const lastCashBackValue = useRef(cashBackPercent > 0 ? cashBackPercent : 4)
  useEffect(() => {
    if (cashBackPercent > 0) lastCashBackValue.current = cashBackPercent
  }, [cashBackPercent])

  const taxEnabled = tax > 0
  const tipEnabled = tipValue > 0
  const cashBackEnabled = cashBackPercent > 0

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Tax, tip &amp; cash back</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tax</span>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Add tax
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => onTaxChange(e.target.checked ? lastTaxValue.current : 0)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600"
              />
            </label>
          </div>
          <div
            className={`relative mt-1 rounded-lg border focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 ${
              taxEnabled ? 'border-slate-300 dark:border-slate-600' : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700'
            }`}
          >
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400 dark:text-slate-500">
              {currencySymbol}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tax === 0 ? '' : tax}
              onChange={(e) => onTaxChange(e.target.valueAsNumber || 0)}
              onFocus={(e) => e.target.select()}
              disabled={!taxEnabled}
              className="w-full rounded-lg bg-transparent py-2 pl-6 pr-3 text-sm focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-100 dark:disabled:text-slate-500"
            />
          </div>
        </div>

        <div className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tip</span>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Add tip
              <input
                type="checkbox"
                checked={tipEnabled}
                onChange={(e) => onTipValueChange(e.target.checked ? lastTipValue.current : 0)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600"
              />
            </label>
          </div>
          <div
            className={`mt-1 flex rounded-lg border focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 ${
              tipEnabled ? 'border-slate-300 dark:border-slate-600' : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700'
            }`}
          >
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tipValue === 0 ? '' : tipValue}
              onChange={(e) => onTipValueChange(e.target.valueAsNumber || 0)}
              onFocus={(e) => e.target.select()}
              disabled={!tipEnabled}
              className="w-full rounded-l-lg bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-100 dark:disabled:text-slate-500"
            />
            <select
              value={tipMode}
              onChange={(e) => onTipModeChange(e.target.value as TipMode)}
              disabled={!tipEnabled}
              className="rounded-r-lg border-l border-slate-300 bg-slate-50 px-2 text-sm text-slate-600 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:disabled:text-slate-600"
            >
              <option value="amount">{currencySymbol}</option>
              <option value="percent">%</option>
            </select>
          </div>
        </div>

        <div className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cash back</span>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Add cash back
              <input
                type="checkbox"
                checked={cashBackEnabled}
                onChange={(e) => onCashBackChange(e.target.checked ? lastCashBackValue.current : 0)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600"
              />
            </label>
          </div>
          <div
            className={`relative mt-1 rounded-lg border focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 ${
              cashBackEnabled ? 'border-slate-300 dark:border-slate-600' : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700'
            }`}
          >
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={cashBackPercent === 0 ? '' : cashBackPercent}
              onChange={(e) => onCashBackChange(e.target.valueAsNumber || 0)}
              onFocus={(e) => e.target.select()}
              disabled={!cashBackEnabled}
              className="w-full rounded-lg bg-transparent py-2 pl-3 pr-7 text-sm focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-100 dark:disabled:text-slate-500"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400 dark:text-slate-500">%</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Cash back shows what each person owes if you knock a percentage off for paying with cash (e.g. 4% cash-back
        card benefit).
      </p>
    </section>
  )
}
