import { useEffect, useState } from 'react'
import type { AppMode, BillState, CombineReceiptEntry, CombineState, Item, SettleGroupBy } from './types'
import { computeSplit } from './lib/calculations'
import {
  addToReceiptLibrary,
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
import { APP_VERSION } from './version'

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
  }
}

function makeDefaultCombineState(): CombineState {
  return { receipts: [], cashBackPercent: 0, settleGroupBy: 'payer' }
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

  useEffect(() => saveMode(mode), [mode])
  useEffect(() => saveBillState(state), [state])
  useEffect(() => saveCombineState(combineState), [combineState])
  useEffect(() => saveReceiptLibrary(library), [library])

  const summary = computeSplit(state)

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

  function handleSaveToLibrary() {
    if (state.people.length === 0 && state.items.length === 0) return
    setLibrary((prev) => addToReceiptLibrary(prev, state))
    setImportNotice({ kind: 'success', message: 'Saved to your receipt library — find it in Combine Receipts.' })
  }

  function handleClearAll() {
    if (mode === 'single') {
      const hasData = state.people.length > 0 || state.items.length > 0 || state.title.trim() !== ''
      if (hasData && !window.confirm('Clear the whole bill? This removes all people, items, and settings.')) return
      if (state.people.length > 0 || state.items.length > 0) {
        setLibrary((prev) => addToReceiptLibrary(prev, state))
      }
      setState(makeDefaultState())
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
        await exportCombinedPDF(combineState.receipts, combineState.cashBackPercent, combineState.settleGroupBy)
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
        setCombineState({ receipts, cashBackPercent: imported.cashBackPercent, settleGroupBy: imported.settleGroupBy })
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
      expanded: true,
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
          receipts: prev.receipts.map((e) => (e.id === entryId ? { ...e, status: 'done', bill, summary: receiptSummary } : e)),
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
        payerId: null,
        expanded: true,
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
            onClearAll={handleClearAll}
            onSettings={() => setShowSettings(true)}
          />
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-3xl px-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              mode === 'single' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Single bill
          </button>
          <button
            type="button"
            onClick={() => setMode('combine')}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              mode === 'combine' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Combine receipts
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="mx-auto mt-4 max-w-3xl px-4">
          <div
            className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm ${
              importNotice.kind === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <span>{importNotice.message}</span>
            <button type="button" onClick={() => setImportNotice(null)} className="ml-3 opacity-60 hover:opacity-100">
              &times;
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto mt-6 flex max-w-3xl flex-col gap-6 px-4">
        {mode === 'single' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={state.title}
                onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Untitled bill"
                className="min-w-[10rem] flex-1 rounded-xl border border-transparent bg-transparent px-1 py-1 text-xl font-semibold text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:px-3 focus:py-2 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
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
              onTaxChange={(tax) => setState((prev) => ({ ...prev, tax }))}
              onTipModeChange={(tipMode) => setState((prev) => ({ ...prev, tipMode }))}
              onTipValueChange={(tipValue) => setState((prev) => ({ ...prev, tipValue }))}
              onCashBackChange={(cashBackPercent) => setState((prev) => ({ ...prev, cashBackPercent }))}
            />
            <ResultsPanel summary={summary} tax={state.tax} paid={state.paid} onTogglePaid={togglePaid} />
            <section className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={state.people.length === 0 && state.items.length === 0}
                className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Save to library
              </button>
              <p className="mt-2 text-xs text-slate-400">
                Keeps this bill on this device so you can add it into a Combine Receipts session later.
              </p>
            </section>
          </>
        ) : (
          <CombinePage
            combineState={combineState}
            library={library}
            onAddFiles={handleAddReceiptFiles}
            onRemoveReceipt={handleRemoveReceipt}
            onToggleExpanded={handleToggleReceiptExpanded}
            onSetPayer={handleSetReceiptPayer}
            onCashBackPercentChange={handleCashBackPercentChange}
            onSettleGroupByChange={handleSettleGroupByChange}
            onAddFromLibrary={handleAddFromLibrary}
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
