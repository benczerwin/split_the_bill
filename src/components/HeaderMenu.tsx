import { useEffect, useRef, useState } from 'react'
import { DownloadIcon, GearIcon, LayersIcon, MenuDotsIcon, TrashIcon, UploadIcon } from './icons'

interface HeaderMenuProps {
  isImporting: boolean
  isExporting: boolean
  onImportFile: (file: File) => void
  onExport: () => void
  onCombine: () => void
  onClearAll: () => void
  onSettings: () => void
}

function Spinner() {
  return <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
}

export default function HeaderMenu({
  isImporting,
  isExporting,
  onImportFile,
  onExport,
  onCombine,
  onClearAll,
  onSettings,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleScroll() {
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [open])

  function runAndClose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={importInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onImportFile(file)
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="More options"
        aria-expanded={open}
      >
        <MenuDotsIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => runAndClose(() => importInputRef.current?.click())}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {isImporting ? <Spinner /> : <UploadIcon className="h-4 w-4 text-slate-400" />}
            <span>
              Import from PDF
              <span className="block text-xs text-slate-400">Replaces the current bill</span>
            </span>
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => runAndClose(onExport)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {isExporting ? <Spinner /> : <DownloadIcon className="h-4 w-4 text-slate-400" />}
            Export as PDF
          </button>
          <button
            type="button"
            onClick={() => runAndClose(onCombine)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <LayersIcon className="h-4 w-4 text-slate-400" />
            Combine receipts
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => runAndClose(onSettings)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <GearIcon className="h-4 w-4 text-slate-400" />
            Settings
          </button>
          <button
            type="button"
            onClick={() => runAndClose(onClearAll)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4 text-red-400" />
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
