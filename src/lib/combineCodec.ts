import type { SettleGroupBy } from '../types'

/** Compact QR payload for a combine session's summary page — the receipts themselves are each
 *  encoded on their own page using the normal single-bill QR format (STB1:), in the same order
 *  as this payload's `p` array, so re-importing can match a payer index back to the right bill. */
export const COMBINE_QR_PREFIX = 'STBX1:'

export interface CompactCombineMeta {
  v: 1
  /** Payer index into that receipt's own people array, one entry per receipt in page order. */
  p: (number | null)[]
  cb: number // cash back percent
  gb: 0 | 1 // 0 = group settlements by payer, 1 = by payee
  cc?: string | null // forced combined-currency override, null/absent means auto-infer
}

export function encodeCombineMetaForQR(
  payerIndices: (number | null)[],
  cashBackPercent: number,
  settleGroupBy: SettleGroupBy,
  currencyOverride: string | null,
): string {
  const meta: CompactCombineMeta = {
    v: 1,
    p: payerIndices,
    cb: cashBackPercent,
    gb: settleGroupBy === 'payee' ? 1 : 0,
    cc: currencyOverride,
  }
  return COMBINE_QR_PREFIX + JSON.stringify(meta)
}

export function decodeCombineMetaFromQR(payload: string): CompactCombineMeta {
  if (!payload.startsWith(COMBINE_QR_PREFIX)) {
    throw new Error('That QR code is not a Split the Bill combine summary.')
  }
  const meta = JSON.parse(payload.slice(COMBINE_QR_PREFIX.length)) as CompactCombineMeta
  if (meta.v !== 1 || !Array.isArray(meta.p)) {
    throw new Error('Unrecognized combine summary format.')
  }
  return meta
}
