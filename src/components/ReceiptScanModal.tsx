import { useRef, useState } from 'react'
import { fileToBase64, scanReceipt, type ScannedReceipt } from '../lib/receiptScan'
import { scanReceiptOCR, parseReceiptText } from '../lib/ocrScan'
import { PASTE_PROMPT, parsePastedReceiptText } from '../lib/pasteParse'
import { formatCurrency } from '../lib/calculations'
import { CameraIcon } from './icons'

interface ReceiptScanModalProps {
  apiKey: string
  onClose: () => void
  onOpenSettings: () => void
  onApply: (result: { items: { name: string; price: number }[]; tax: number | null; tip: number | null }) => void
}

interface DraftItem {
  name: string
  price: number
  include: boolean
}

type Status = 'idle' | 'loading' | 'error' | 'ready'
type Engine = 'claude' | 'ocr' | 'paste' | 'livetext'

export default function ReceiptScanModal({ apiKey, onClose, onOpenSettings, onApply }: ReceiptScanModalProps) {
  const [engine, setEngine] = useState<Engine>(apiKey ? 'claude' : 'ocr')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [pasteText, setPasteText] = useState('')
  const [liveText, setLiveText] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [taxValue, setTaxValue] = useState<number | null>(null)
  const [tipValue, setTipValue] = useState<number | null>(null)
  const [applyTax, setApplyTax] = useState(true)
  const [applyTip, setApplyTip] = useState(true)
  const [receipt, setReceipt] = useState<ScannedReceipt | null>(null)
  const [usedEngine, setUsedEngine] = useState<Engine>(engine)
  const inputRef = useRef<HTMLInputElement>(null)

  function applyResult(result: ScannedReceipt) {
    setUsedEngine(engine)
    setReceipt(result)
    setDraftItems(result.items.map((item) => ({ ...item, include: true })))
    setTaxValue(result.tax)
    setTipValue(result.tip)
    setStatus('ready')
  }

  async function handleFile(file: File) {
    setStatus('loading')
    setError('')
    setOcrProgress(0)
    try {
      const result =
        engine === 'claude'
          ? await (async () => {
              if (!apiKey) throw new Error('Add your Anthropic API key in Settings first.')
              const { base64, mediaType } = await fileToBase64(file)
              return scanReceipt(apiKey, base64, mediaType)
            })()
          : await scanReceiptOCR(file, setOcrProgress)
      applyResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong scanning that receipt.')
      setStatus('error')
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(PASTE_PROMPT).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 1500)
    })
  }

  function handleParsePaste() {
    setError('')
    try {
      applyResult(parsePastedReceiptText(pasteText))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that text.')
      setStatus('error')
    }
  }

  function handleParseLiveText() {
    setError('')
    try {
      const result = parseReceiptText(liveText)
      if (result.items.length === 0) {
        throw new Error('No item lines found in that text — make sure you copied the whole receipt.')
      }
      applyResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that text.')
      setStatus('error')
    }
  }

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setDraftItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function handleApply() {
    onApply({
      items: draftItems.filter((item) => item.include).map(({ name, price }) => ({ name, price })),
      tax: applyTax ? taxValue : null,
      tip: applyTip ? tipValue : null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Scan a receipt</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            &times;
          </button>
        </div>

        {status !== 'ready' && (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => apiKey && setEngine('claude')}
                disabled={!apiKey}
                className={`rounded-md py-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  engine === 'claude' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Claude
              </button>
              <button
                type="button"
                onClick={() => setEngine('ocr')}
                className={`rounded-md py-1.5 font-medium transition ${
                  engine === 'ocr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Free OCR
              </button>
              <button
                type="button"
                onClick={() => setEngine('paste')}
                className={`rounded-md py-1.5 font-medium transition ${
                  engine === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Paste from AI
              </button>
              <button
                type="button"
                onClick={() => setEngine('livetext')}
                className={`rounded-md py-1.5 font-medium transition ${
                  engine === 'livetext' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Paste scanned text
              </button>
            </div>

            {engine === 'claude' && !apiKey && (
              <p className="mt-2 text-xs text-amber-700">
                Needs an Anthropic API key.{' '}
                <button type="button" onClick={onOpenSettings} className="font-medium underline">
                  Add one in Settings
                </button>
                , or use a free option instead.
              </p>
            )}
            {engine === 'ocr' && (
              <p className="mt-2 text-xs text-slate-400">
                Runs entirely in your browser, no key needed — but it's plain text recognition, so it's less reliable
                at telling items apart from tax/tip/totals. Review carefully before applying.
              </p>
            )}
            {engine === 'paste' && (
              <p className="mt-2 text-xs text-slate-400">
                Copy this prompt into ChatGPT, Claude, or any AI with vision, along with a photo of your receipt,
                then paste its reply below.
              </p>
            )}
            {engine === 'livetext' && (
              <p className="mt-2 text-xs text-slate-400">
                Your phone's own text scanner reads photos much better than the free OCR above. Open the receipt
                photo, use it to select and copy all the text (iPhone: Live Text — tap the text-select icon in
                Photos; Android: Google Lens), then paste the raw result below. We'll pick out the items ourselves.
              </p>
            )}

            {engine === 'paste' ? (
              <div className="mt-3">
                <div className="relative">
                  <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 pr-16 font-mono text-[11px] leading-snug text-slate-600">
                    {PASTE_PROMPT}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-700 shadow ring-1 ring-slate-200 hover:bg-indigo-50"
                  >
                    {promptCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste the AI's reply here…"
                  rows={6}
                  className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <button
                  type="button"
                  onClick={handleParsePaste}
                  disabled={!pasteText.trim()}
                  className="mt-2 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Parse pasted text
                </button>
                {status === 'error' && <p className="mt-3 text-sm text-red-600">{error}</p>}
              </div>
            ) : engine === 'livetext' ? (
              <div className="mt-3">
                <textarea
                  value={liveText}
                  onChange={(e) => setLiveText(e.target.value)}
                  placeholder="Paste the scanned receipt text here…"
                  rows={8}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <button
                  type="button"
                  onClick={handleParseLiveText}
                  disabled={!liveText.trim()}
                  className="mt-2 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Parse pasted text
                </button>
                {status === 'error' && <p className="mt-3 text-sm text-red-600">{error}</p>}
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={status === 'loading'}
                  className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-500 hover:border-slate-400 disabled:opacity-60"
                >
                  {status === 'loading' ? (
                    <>
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                      <span className="text-sm">
                        {engine === 'ocr'
                          ? `Reading your receipt on-device… ${Math.round(ocrProgress * 100)}%`
                          : 'Reading your receipt…'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CameraIcon className="h-7 w-7" />
                      <span className="text-sm font-medium">Take a photo or choose a file</span>
                    </>
                  )}
                </button>
                {status === 'error' && <p className="mt-3 text-sm text-red-600">{error}</p>}
              </>
            )}
          </div>
        )}

        {status === 'ready' && (
          <div className="mt-4">
            <p className="text-sm text-slate-500">
              Review what we found, then apply it to your bill. Uncheck anything that isn&rsquo;t right.
            </p>
            {usedEngine === 'ocr' && (
              <p className="mt-1 text-xs text-amber-700">
                Scanned with free on-device OCR — double-check names and prices, especially anything that isn&rsquo;t
                a plain item line.
              </p>
            )}
            {usedEngine === 'livetext' && (
              <p className="mt-1 text-xs text-amber-700">
                Character recognition should be solid, but double-check we picked out the right lines as items vs.
                tax/tip.
              </p>
            )}
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {draftItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.include}
                    onChange={(e) => updateDraft(index, { include: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateDraft(index, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <div className="relative w-24 shrink-0">
                    <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price === 0 ? '' : item.price}
                      onChange={(e) => updateDraft(index, { price: e.target.valueAsNumber || 0 })}
                      onFocus={(e) => e.target.select()}
                      className="w-full rounded-lg border border-slate-300 py-1 pl-5 pr-2 text-sm"
                    />
                  </div>
                </div>
              ))}
              {draftItems.length === 0 && <p className="text-sm text-slate-400">No line items were found.</p>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyTax}
                  disabled={taxValue === null}
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Tax: {taxValue !== null ? formatCurrency(taxValue) : 'not found'}
              </label>
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyTip}
                  disabled={tipValue === null}
                  onChange={(e) => setApplyTip(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Tip: {tipValue !== null ? formatCurrency(tipValue) : 'not found'}
              </label>
            </div>
            {receipt?.total !== null && receipt?.total !== undefined && (
              <p className="mt-2 text-xs text-slate-400">Receipt total (for reference): {formatCurrency(receipt.total)}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Rescan
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Add to bill
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
