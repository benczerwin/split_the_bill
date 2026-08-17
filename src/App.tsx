import { useEffect, useState } from 'react'
import type { AppMode, BillState, CombineReceiptEntry, CombineState, Item, SettleGroupBy } from './types'
import { computeSplit } from './lib/calculations'
import { computeBillDisplay, convertAmount, getCurrencySymbol } from './lib/currency'
import { useExchangeRates } from './hooks/useExchangeRates'
import {
  addToReceiptLibrary,
  LIBRARY_LIMIT,
  loadApiKey,
  loadBillState,
  loadCombineState,
  loadMode,
  loadReceiptLibrary,
  saveApiKey,
  saveBillState,
  saveCombineState,
  saveMode,
  saveReceiptLibrary,
} from './lib/storage'
import { nowAsDateOnly, toDateOnly } from './lib/dateUtils'
import PeopleManager from './components/PeopleManager'
import ItemsList from './components/ItemsList'
import TaxTipPanel from './components/TaxTipPanel'
import ResultsPanel from './components/ResultsPanel'
import SettingsModal from './components/SettingsModal'
import ReceiptScanModal from './components/ReceiptScanModal'
import CombinePage from './components/CombinePage'
import HeaderMenu from './components/HeaderMenu'
import PayerPicker from './components/PayerPicker'
import CurrencyPanel from './components/CurrencyPanel'
import { TrashIcon } from './components/icons'
import { APP_VERSION } from './version'

type EditTarget = { kind: 'library'; libraryId: string } | { kind: 'receipt'; receiptId: string }

function uid(): string {
  return crypto.randomUUID()
}

function makeDefaultState(): BillState {
  return {
    title: '',
    date: nowAsDateOnly(),
    people: [],
    items: [],
    tax: 0,
    tipMode: 'percent',
    tipValue: 20,
    cashBackPercent: 4,
    paid: {},
    payerId: null,
    currency: 'USD',
    chargedCurrency: null,
    chargedTotal: null,
  }
}

function makeDefaultCombineState(): CombineState {
  return { receipts: [], cashBackPercent: 0, settleGroupBy: 'payer', currencyOverride: null }
}

function makeExampleState(): BillState {
  const alex = uid()
  const sam = uid()
  const jordan = uid()
  return {
    title: 'Taco Tuesday',
    date: nowAsDateOnly(),
    people: [
      { id: alex, name: 'Alex', colorIndex: 0 },
      { id: sam, name: 'Sam', colorIndex: 1 },
      { id: jordan, name: 'Jordan', colorIndex: 2 },
    ],
    items: [
      { id: uid(), name: 'Chips & Guac', price: 8.5, assignedTo: [] },
      { id: uid(), name: 'Fish Tacos (3)', price: 16.5, assignedTo: [alex] },
      { id: uid(), name: 'Carne Asada Burrito', price: 13, assignedTo: [sam] },
      { id: uid(), name: 'Veggie Bowl', price: 12, assignedTo: [jordan] },
      { id: uid(), name: 'Margaritas (2)', price: 19, assignedTo: [alex, sam] },
    ],
    tax: 5.6,
    tipMode: 'percent',
    tipValue: 20,
    cashBackPercent: 4,
    paid: {},
    payerId: alex,
    currency: 'USD',
    chargedCurrency: null,
    chargedTotal: null,
  }
}

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => loadMode())
  const [state, setState] = useState<BillState>(() => {
    const loaded = loadBillState()
    return { ...makeDefaultState(), ...loaded, date: toDateOnly(loaded?.date) }
  })
  const [combineState, setCombineState] = useState<CombineState>(() => loadCombineState() ?? makeDefaultCombineState())
  const [library, setLibrary] = useState(() => loadReceiptLibrary())
  const [apiKey, setApiKey] = useState(() => loadApiKey())
  const [showSettings, setShowSettings] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  // Set when editing a saved library bill or a combine-session receipt directly (both reached
  // from Combine Receipts), so "Save to library" updates that entry in place instead of
  // creating a new one.
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  // Set when building a fresh bill specifically to add into the combine session, so saving it
  // both records it and drops it straight into the combine list instead of just the library.
  const [addingForCombine, setAddingForCombine] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  // Briefly highlights the receipt just added/updated when landing back on Combine Receipts.
  const [highlightReceiptId, setHighlightReceiptId] = useState<string | null>(null)

  useEffect(() => saveMode(mode), [mode])
  useEffect(() => saveBillState(state), [state])
  useEffect(() => saveCombineState(combineState), [combineState])
  useEffect(() => saveReceiptLibrary(library), [library])

  useEffect(() => {
    if (!highlightReceiptId) return
    const timer = setTimeout(() => setHighlightReceiptId(null), 2500)
    return () => clearTimeout(timer)
  }, [highlightReceiptId])

  const summary = computeSplit(state)
  const needsLiveRate = !!state.chargedCurrency && state.chargedCurrency !== state.currency && state.chargedTotal == null
  const { rates, loading: rateLoading, error: rateError } = useExchangeRates(needsLiveRate)
  const liveRate = state.chargedCurrency && rates ? convertAmount(1, state.currency, state.chargedCurrency, rates) : null
  const display = computeBillDisplay(state, summary, rates)

  function addPerson(name: string) {
    setState((prev) => ({
      ...prev,
      people: [...prev.people, { id: uid(), name, colorIndex: prev.people.length }],
    }))
  }

  function removePerson(id: string) {
    setState((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== id),
      items: prev.items.map((item) => ({ ...item, assignedTo: item.assignedTo.filter((pid) => pid !== id) })),
      paid: Object.fromEntries(Object.entries(prev.paid).filter(([pid]) => pid !== id)),
    }))
  }

  function addItem() {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), name: '', price: 0, assignedTo: [] }],
    }))
  }

  function changeItem(id: string, patch: Partial<Item>) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  function deleteItem(id: string) {
    setState((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }))
  }

  function togglePaid(personId: string) {
    setState((prev) => ({ ...prev, paid: { ...prev.paid, [personId]: !prev.paid[personId] } }))
  }

  function applyScan(result: {
    items: { name: string; price: number }[]
    tax: number | null
    tip: number | null
    date: string | null
  }) {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, ...result.items.map((item) => ({ id: uid(), name: item.name, price: item.price, assignedTo: [] }))],
      tax: result.tax !== null ? result.tax : prev.tax,
      tipMode: result.tip !== null ? 'amount' : prev.tipMode,
      tipValue: result.tip !== null ? result.tip : prev.tipValue,
      date: result.date ?? prev.date,
    }))
  }

  function switchMode(next: AppMode) {
    setMode(next)
    setImportNotice(null)
    setEditTarget(null)
    setAddingForCombine(false)
  }

  function handleSaveToLibrary() {
    if (state.people.length === 0 && state.items.length === 0) return

    if (editTarget?.kind === 'receipt') {
      const updatedSummary = computeSplit(state)
      const linkedLibraryId = combineState.receipts.find((r) => r.id === editTarget.receiptId)?.libraryId
      setCombineState((prev) => ({
        ...prev,
        receipts: prev.receipts.map((r) =>
          r.id === editTarget.receiptId
            ? { ...r, bill: state, summary: updatedSummary, fileName: state.title || r.fileName }
            : r,
        ),
      }))
      if (linkedLibraryId) {
        setLibrary((prev) => prev.map((item) => (item.id === linkedLibraryId ? { ...item, bill: state } : item)))
      }
      setHighlightReceiptId(editTarget.receiptId)
      switchMode('combine')
      setImportNotice({ kind: 'success', message: 'Updated the receipt in your combine session.' })
      return
    }

    if (editTarget?.kind === 'library') {
      const libraryId = editTarget.libraryId
      setLibrary((prev) => prev.map((item) => (item.id === libraryId ? { ...item, bill: state } : item)))
      setCombineState((prev) => ({
        ...prev,
        receipts: prev.receipts.map((r) =>
          r.libraryId === libraryId
            ? { ...r, bill: state, summary: computeSplit(state), fileName: state.title || r.fileName }
            : r,
        ),
      }))
      setEditTarget(null)
      setImportNotice({ kind: 'success', message: 'Updated the saved bill in your library.' })
      return
    }

    const nextLibrary = addToReceiptLibrary(library, state)
    setLibrary(nextLibrary)

    if (addingForCombine) {
      const savedItem = nextLibrary[0]
      const newEntry: CombineReceiptEntry = {
        id: uid(),
        fileName: state.title || 'Untitled bill',
        status: 'done',
        bill: state,
        summary: computeSplit(state),
        payerId: state.payerId ?? null,
        expanded: false,
        libraryId: savedItem.id,
      }
      setCombineState((prev) => ({ ...prev, receipts: [...prev.receipts, newEntry] }))
      setAddingForCombine(false)
      setHighlightReceiptId(newEntry.id)
      switchMode('combine')
      setImportNotice({ kind: 'success', message: 'Added to your combine session.' })
    } else {
      setImportNotice({
        kind: 'success',
        message: `Saved on this device. Find it under Combine Receipts → From your device (kept until you delete it or the ${LIBRARY_LIMIT} most recent bills fill up).`,
      })
    }
  }

  function handleSaveAsNewFromEdit() {
    if (state.people.length === 0 && state.items.length === 0) return
    setLibrary((prev) => addToReceiptLibrary(prev, state))
    setEditTarget(null)
    setImportNotice({ kind: 'success', message: 'Saved as a new bill in your library.' })
  }

  function handleEditLibraryItem(id: string) {
    const item = library.find((l) => l.id === id)
    if (!item) return
    if (state.people.length > 0 || state.items.length > 0) {
      const confirmed = window.confirm('Editing this saved bill replaces your current single-bill draft. Continue?')
      if (!confirmed) return
    }
    switchMode('single')
    setState({ ...item.bill, date: toDateOnly(item.bill.date) })
    setEditTarget({ kind: 'library', libraryId: id })
  }

  function handleEditReceipt(id: string) {
    const entry = combineState.receipts.find((r) => r.id === id)
    if (!entry || !entry.bill) return
    if (state.people.length > 0 || state.items.length > 0) {
      const confirmed = window.confirm('Editing this receipt replaces your current single-bill draft. Continue?')
      if (!confirmed) return
    }
    switchMode('single')
    setState({ ...entry.bill, date: toDateOnly(entry.bill.date) })
    setEditTarget({ kind: 'receipt', receiptId: id })
  }

  function handleStartNewBillForCombine() {
    if (state.people.length > 0 || state.items.length > 0) {
      const confirmed = window.confirm('Start a new bill for this combine session? This replaces your current single-bill draft.')
      if (!confirmed) return
    }
    switchMode('single')
    setState(makeDefaultState())
    setAddingForCombine(true)
  }

  function handleLoadExample() {
    if (state.people.length > 0 || state.items.length > 0) {
      const confirmed = window.confirm('Load the example bill? This replaces your current bill.')
      if (!confirmed) return
    }
    setState(makeExampleState())
    setImportNotice(null)
  }

  function handleClearAll() {
    if (mode === 'single') {
      const hasData = state.people.length > 0 || state.items.length > 0 || state.title.trim() !== ''
      if (hasData && !window.confirm('Clear the whole bill? This removes all people, items, and settings.')) return
      if (state.people.length > 0 || state.items.length > 0) {
        setLibrary((prev) => addToReceiptLibrary(prev, state))
      }
      setState(makeDefaultState())
      setEditTarget(null)
      setAddingForCombine(false)
    } else {
      if (combineState.receipts.length > 0 && !window.confirm('Clear all receipts from this combine session?')) return
      setCombineState(makeDefaultCombineState())
    }
    setImportNotice(null)
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      if (mode === 'single') {
        const { exportBillPDF } = await import('./lib/pdfExport')
        await exportBillPDF(state, summary)
      } else {
        const { exportCombinedPDF } = await import('./lib/pdfExport')
        await exportCombinedPDF(
          combineState.receipts,
          combineState.cashBackPercent,
          combineState.settleGroupBy,
          combineState.currencyOverride,
        )
      }
    } catch (err) {
      setImportNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not generate the PDF.' })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImportFile(file: File) {
    if (mode === 'single') {
      if (state.people.length > 0 || state.items.length > 0) {
        const confirmed = window.confirm(
          'Importing replaces everything in your current bill — title, date, people, items, tax, tip, and cash back. Continue?',
        )
        if (!confirmed) return
      }
      setIsImporting(true)
      setImportNotice(null)
      try {
        const { importBillFromPDF } = await import('./lib/pdfImport')
        const imported = await importBillFromPDF(file)
        setState(imported)
        setImportNotice({ kind: 'success', message: imported.title ? `Imported "${imported.title}".` : 'Bill imported.' })
      } catch (err) {
        setImportNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not import that PDF.' })
      } finally {
        setIsImporting(false)
      }
    } else {
      if (combineState.receipts.length > 0) {
        const confirmed = window.confirm('Importing replaces your current combine session — all receipts and settings. Continue?')
        if (!confirmed) return
      }
      setIsImporting(true)
      setImportNotice(null)
      try {
        const { importCombinedFromPDF } = await import('./lib/pdfImport')
        const imported = await importCombinedFromPDF(file)
        const receipts: CombineReceiptEntry[] = imported.bills.map((bill, i) => ({
          id: uid(),
          fileName: bill.title || `Receipt ${i + 1}`,
          status: 'done',
          bill,
          summary: computeSplit(bill),
          payerId:
            imported.payerIndices[i] != null && imported.payerIndices[i]! >= 0
              ? bill.people[imported.payerIndices[i]!]?.id ?? null
              : null,
          expanded: false,
        }))
        setCombineState({
          receipts,
          cashBackPercent: imported.cashBackPercent,
          settleGroupBy: imported.settleGroupBy,
          currencyOverride: imported.currencyOverride,
        })
        setImportNotice({ kind: 'success', message: `Imported ${receipts.length} receipt${receipts.length === 1 ? '' : 's'}.` })
      } catch (err) {
        setImportNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not import that PDF.' })
      } finally {
        setIsImporting(false)
      }
    }
  }

  async function handleAddReceiptFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const newEntries: CombineReceiptEntry[] = files.map((file) => ({
      id: uid(),
      fileName: file.name,
      status: 'loading',
      payerId: null,
      expanded: false,
    }))
    setCombineState((prev) => ({ ...prev, receipts: [...prev.receipts, ...newEntries] }))

    const { importBillFromPDF } = await import('./lib/pdfImport')
    // Decode one at a time — each PDF can take several render passes to lock onto its QR
    // code, so running a pile of them at once would spike memory on a phone.
    for (let i = 0; i < files.length; i++) {
      const entryId = newEntries[i].id
      try {
        const bill = await importBillFromPDF(files[i])
        const receiptSummary = computeSplit(bill)
        setCombineState((prev) => ({
          ...prev,
          receipts: prev.receipts.map((e) =>
            e.id === entryId ? { ...e, status: 'done', bill, summary: receiptSummary, payerId: bill.payerId ?? null } : e,
          ),
        }))
      } catch (err) {
        setCombineState((prev) => ({
          ...prev,
          receipts: prev.receipts.map((e) =>
            e.id === entryId
              ? { ...e, status: 'error', error: err instanceof Error ? err.message : 'Could not read this PDF.' }
              : e,
          ),
        }))
      }
    }
  }

  function handleAddFromLibrary(ids: string[]) {
    if (ids.length === 0) return
    const newEntries: CombineReceiptEntry[] = ids
      .map((id) => library.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => !!item)
      .map((item) => ({
        id: uid(),
        fileName: item.bill.title || 'Untitled bill',
        status: 'done',
        bill: item.bill,
        summary: computeSplit(item.bill),
        payerId: item.bill.payerId ?? null,
        expanded: false,
        libraryId: item.id,
      }))
    setCombineState((prev) => ({ ...prev, receipts: [...prev.receipts, ...newEntries] }))
  }

  function handleRemoveReceipt(id: string) {
    setCombineState((prev) => ({ ...prev, receipts: prev.receipts.filter((e) => e.id !== id) }))
  }

  function handleToggleReceiptExpanded(id: string) {
    setCombineState((prev) => ({
      ...prev,
      receipts: prev.receipts.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e)),
    }))
  }

  function handleSetReceiptPayer(id: string, payerId: string | null) {
    setCombineState((prev) => ({ ...prev, receipts: prev.receipts.map((e) => (e.id === id ? { ...e, payerId } : e)) }))
  }

  function handleCashBackPercentChange(value: number) {
    setCombineState((prev) => ({ ...prev, cashBackPercent: value }))
  }

  function handleSettleGroupByChange(value: SettleGroupBy) {
    setCombineState((prev) => ({ ...prev, settleGroupBy: value }))
  }

  function handleCurrencyOverrideChange(value: string | null) {
    setCombineState((prev) => ({ ...prev, currencyOverride: value }))
  }

  function handleRemoveLibraryItem(id: string) {
    setLibrary((prev) => prev.filter((item) => item.id !== id))
  }

  function handleClearLibrary() {
    setLibrary([])
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Split the Bill</h1>
            <p className="text-xs text-slate-400">Split a bill fairly, alone or combined across receipts.</p>
          </div>
          <HeaderMenu
            mode={mode}
            isImporting={isImporting}
            isExporting={isExporting}
            onImportFile={handleImportFile}
            onExport={handleExport}
            onLoadExample={handleLoadExample}
            onSettings={() => setShowSettings(true)}
          />
        </div>
      </header>

      <div className="mx-auto mt-4 flex max-w-3xl items-stretch gap-2 px-4">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => switchMode('single')}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              mode === 'single' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Single bill
          </button>
          <button
            type="button"
            onClick={() => switchMode('combine')}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              mode === 'combine' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Combine receipts
          </button>
        </div>
        <button
          type="button"
          onClick={handleClearAll}
          aria-label={mode === 'single' ? 'Clear bill' : 'Clear combine session'}
          title={mode === 'single' ? 'Clear bill' : 'Clear combine session'}
          className="shrink-0 rounded-2xl bg-white px-3 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-red-500"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>

      {importNotice && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div
            className={`flex max-w-lg items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg ring-1 ${
              importNotice.kind === 'success'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                : 'bg-red-50 text-red-700 ring-red-100'
            }`}
          >
            <span>{importNotice.message}</span>
            <button type="button" onClick={() => setImportNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">
              &times;
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto mt-6 flex max-w-3xl flex-col gap-6 px-4">
        {mode === 'single' ? (
          <>
            {(addingForCombine || editTarget) && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700">
                <span>
                  {addingForCombine
                    ? 'Building a new bill for your combine session — saving it below will add it there automatically.'
                    : editTarget?.kind === 'receipt'
                      ? 'Editing a receipt from your combine session — saving it below updates it there directly.'
                      : 'Editing a saved bill — saving it below updates that entry instead of creating a new one.'}
                </span>
                <button
                  type="button"
                  onClick={() => switchMode('combine')}
                  className="shrink-0 font-medium underline hover:no-underline"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[10rem] flex-1">
                <input
                  type="text"
                  value={state.title}
                  onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
                  onFocus={() => setTitleFocused(true)}
                  onBlur={() => setTitleFocused(false)}
                  placeholder="Untitled bill"
                  className="w-full rounded-xl border border-transparent bg-transparent py-1 pl-1 pr-7 text-xl font-semibold text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:py-2 focus:pl-3 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
                {titleFocused && state.title && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setState((prev) => ({ ...prev, title: '' }))}
                    aria-label="Clear title"
                    className="absolute inset-y-0 right-1 flex items-center px-1 text-slate-300 hover:text-slate-500"
                  >
                    &times;
                  </button>
                )}
              </div>
              <input
                type="date"
                value={state.date}
                onChange={(e) => setState((prev) => ({ ...prev, date: e.target.value }))}
                className="shrink-0 rounded-xl border border-transparent bg-transparent px-1 py-1 text-sm text-slate-500 focus:border-slate-300 focus:bg-white focus:px-3 focus:py-2 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <PeopleManager people={state.people} onAdd={addPerson} onRemove={removePerson} />
            <ItemsList
              items={state.items}
              people={state.people}
              subtotal={summary.subtotal}
              currency={state.currency}
              onAdd={addItem}
              onChange={changeItem}
              onDelete={deleteItem}
              onScanReceipt={() => setShowScan(true)}
            />
            <TaxTipPanel
              tax={state.tax}
              tipMode={state.tipMode}
              tipValue={state.tipValue}
              cashBackPercent={state.cashBackPercent}
              currencySymbol={getCurrencySymbol(state.currency)}
              onTaxChange={(tax) => setState((prev) => ({ ...prev, tax }))}
              onTipModeChange={(tipMode) => setState((prev) => ({ ...prev, tipMode }))}
              onTipValueChange={(tipValue) => setState((prev) => ({ ...prev, tipValue }))}
              onCashBackChange={(cashBackPercent) => setState((prev) => ({ ...prev, cashBackPercent }))}
            />
            <CurrencyPanel
              currency={state.currency}
              chargedCurrency={state.chargedCurrency}
              chargedTotal={state.chargedTotal}
              onCurrencyChange={(currency) => setState((prev) => ({ ...prev, currency }))}
              onChargedCurrencyChange={(chargedCurrency) => setState((prev) => ({ ...prev, chargedCurrency }))}
              onChargedTotalChange={(chargedTotal) => setState((prev) => ({ ...prev, chargedTotal }))}
              liveRate={liveRate}
              liveRateLoading={rateLoading}
              liveRateError={rateError}
            />
            <PayerPicker
              people={state.people}
              payerId={state.payerId}
              onChange={(payerId) => setState((prev) => ({ ...prev, payerId }))}
            />
            <ResultsPanel
              summary={display.summary}
              tax={state.tax * display.scale}
              currency={display.currency}
              paid={state.paid}
              onTogglePaid={togglePaid}
            />
            <section className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={state.people.length === 0 && state.items.length === 0}
                className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                {editTarget?.kind === 'receipt'
                  ? 'Update receipt'
                  : editTarget?.kind === 'library'
                    ? 'Update saved bill'
                    : addingForCombine
                      ? 'Add to combine session'
                      : 'Save to library'}
              </button>
              {editTarget ? (
                <button
                  type="button"
                  onClick={handleSaveAsNewFromEdit}
                  className="mt-2 text-xs text-slate-400 underline hover:text-slate-600"
                >
                  Save as a new bill instead
                </button>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Saved only in this browser on this device — not synced anywhere. Kept until you delete it or the{' '}
                  {LIBRARY_LIMIT} most recent bills fill up, whichever comes first. Add it into a Combine Receipts
                  session anytime from &ldquo;From your device.&rdquo;
                </p>
              )}
            </section>
          </>
        ) : (
          <CombinePage
            combineState={combineState}
            library={library}
            highlightReceiptId={highlightReceiptId}
            onAddFiles={handleAddReceiptFiles}
            onStartNewBillForCombine={handleStartNewBillForCombine}
            onRemoveReceipt={handleRemoveReceipt}
            onEditReceipt={handleEditReceipt}
            onToggleExpanded={handleToggleReceiptExpanded}
            onSetPayer={handleSetReceiptPayer}
            onCashBackPercentChange={handleCashBackPercentChange}
            onSettleGroupByChange={handleSettleGroupByChange}
            onCurrencyOverrideChange={handleCurrencyOverrideChange}
            onAddFromLibrary={handleAddFromLibrary}
            onEditLibraryItem={handleEditLibraryItem}
            onRemoveLibraryItem={handleRemoveLibraryItem}
            onClearLibrary={handleClearLibrary}
          />
        )}
      </main>

      <p className="mt-8 text-center text-xs text-slate-300">v{APP_VERSION}</p>

      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          onSave={(key) => {
            setApiKey(key)
            saveApiKey(key)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showScan && (
        <ReceiptScanModal
          apiKey={apiKey}
          currency={state.currency}
          onClose={() => setShowScan(false)}
          onOpenSettings={() => {
            setShowScan(false)
            setShowSettings(true)
          }}
          onApply={applyScan}
        />
      )}
    </div>
  )
}
