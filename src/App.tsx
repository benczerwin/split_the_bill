import { useEffect, useState } from 'react'
import type { BillState, Item } from './types'
import { computeSplit } from './lib/calculations'
import { loadApiKey, loadBillState, saveApiKey, saveBillState } from './lib/storage'
import { nowAsDateOnly, toDateOnly } from './lib/dateUtils'
import PeopleManager from './components/PeopleManager'
import ItemsList from './components/ItemsList'
import TaxTipPanel from './components/TaxTipPanel'
import ResultsPanel from './components/ResultsPanel'
import SettingsModal from './components/SettingsModal'
import ReceiptScanModal from './components/ReceiptScanModal'
import CombineReceiptsModal from './components/CombineReceiptsModal'
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

export default function App() {
  const [state, setState] = useState<BillState>(() => {
    const loaded = loadBillState()
    return { ...makeDefaultState(), ...loaded, date: toDateOnly(loaded?.date) }
  })
  const [apiKey, setApiKey] = useState(() => loadApiKey())
  const [showSettings, setShowSettings] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [showCombine, setShowCombine] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    saveBillState(state)
  }, [state])

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

  function handleClearAll() {
    const hasData = state.people.length > 0 || state.items.length > 0 || state.title.trim() !== ''
    if (hasData && !window.confirm('Clear the whole bill? This removes all people, items, and settings.')) return
    setState(makeDefaultState())
    setImportNotice(null)
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const { exportBillPDF } = await import('./lib/pdfExport')
      await exportBillPDF(state, summary)
    } catch (err) {
      setImportNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not generate the PDF.' })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImportFile(file: File) {
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
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Split the Bill</h1>
            <p className="text-xs text-slate-400">Fairly split a bill by item, including tax, tip &amp; cash back.</p>
          </div>
          <HeaderMenu
            isImporting={isImporting}
            isExporting={isExporting}
            onImportFile={handleImportFile}
            onExport={handleExport}
            onCombine={() => setShowCombine(true)}
            onClearAll={handleClearAll}
            onSettings={() => setShowSettings(true)}
          />
        </div>
      </header>

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

      {showCombine && <CombineReceiptsModal onClose={() => setShowCombine(false)} />}
    </div>
  )
}
