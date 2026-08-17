import { useEffect, useRef } from 'react'
import { CURRENCIES, getCurrencySymbol } from '../lib/currency'

interface CurrencyPanelProps {
  currency: string
  chargedCurrency: string | null
  chargedTotal: number | null
  onCurrencyChange: (code: string) => void
  onChargedCurrencyChange: (code: string | null) => void
  onChargedTotalChange: (value: number | null) => void
  liveRate: number | null
  liveRateLoading: boolean
  liveRateError: string | null
}

export default function CurrencyPanel({
  currency,
  chargedCurrency,
  chargedTotal,
  onCurrencyChange,
  onChargedCurrencyChange,
  onChargedTotalChange,
  liveRate,
  liveRateLoading,
  liveRateError,
}: CurrencyPanelProps) {
  // Remembers the last charged currency picked so unchecking then rechecking the toggle
  // restores it instead of losing the selection, matching the tax/tip/cash-back pattern.
  const lastChargedCurrency = useRef(chargedCurrency ?? (currency === 'USD' ? 'EUR' : 'USD'))
  useEffect(() => {
    if (chargedCurrency) lastChargedCurrency.current = chargedCurrency
  }, [chargedCurrency])

  const chargedEnabled = chargedCurrency != null

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-800">Currency</h2>
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-500">Currency on the receipt</label>
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 sm:w-auto"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <label className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <input
          type="checkbox"
          checked={chargedEnabled}
          onChange={(e) => onChargedCurrencyChange(e.target.checked ? lastChargedCurrency.current : null)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
        />
        Charged in a different currency
      </label>

      {chargedEnabled && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-500">Charged currency</label>
            <select
              value={chargedCurrency}
              onChange={(e) => onChargedCurrencyChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Total charged (optional)</label>
            <div className="relative mt-1 rounded-lg border border-slate-300 focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                {getCurrencySymbol(chargedCurrency)}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={chargedTotal ?? ''}
                onChange={(e) => onChargedTotalChange(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null)}
                onFocus={(e) => e.target.select()}
                placeholder="From your bank/card statement"
                className="w-full rounded-lg bg-transparent py-2 pl-8 pr-3 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {chargedEnabled && (
        <p className="mt-2 text-xs text-slate-400">
          {chargedTotal != null
            ? `Each person's share is scaled proportionally to match your ${getCurrencySymbol(chargedCurrency)}${chargedTotal.toFixed(2)} charge.`
            : liveRateLoading
              ? "Leave blank to convert using today's exchange rate — fetching now…"
              : liveRateError
                ? `Couldn't fetch today's exchange rate: ${liveRateError}`
                : liveRate != null
                  ? `Leave blank to convert using today's rate: 1 ${currency} ≈ ${liveRate.toFixed(4)} ${chargedCurrency}.`
                  : "Leave blank to convert using today's exchange rate."}
        </p>
      )}
    </section>
  )
}
