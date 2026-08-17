import { useEffect, useState } from 'react'
import { fetchUsdRates } from '../lib/currency'

/** Fetches (and caches) USD-based exchange rates only when `enabled` — most bills never need
 *  a currency conversion, so this avoids a network call on every visit to the app. */
export function useExchangeRates(enabled: boolean) {
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || rates) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUsdRates()
      .then((r) => {
        if (!cancelled) setRates(r)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not fetch exchange rates.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, rates])

  return { rates, loading, error }
}
