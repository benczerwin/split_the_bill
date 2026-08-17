import { useEffect, useRef, useState } from 'react'
import type { AppMode } from '../types'
import { DownloadIcon, GearIcon, MenuDotsIcon, SparkleIcon, UploadIcon } from './icons'

interface HeaderMenuProps {
  mode: AppMode
  isImporting: boolean
  isExporting: boolean
  onImportFile: (file: File) => void
  onExport: () => void
  onLoadExample: () => void
  onSettings: () => void
}

function Spinner() {
  return (
    <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300" />
  )
}

export default function HeaderMenu({
  mode,
  isImporting,
  isExporting,
  onImportFile,
  onExport,
  onLoadExample,
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

  const importSubtitle = mode === 'single' ? 'Replaces the current bill' : 'Replaces the current combine session'

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
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label="More options"
        aria-expanded={open}
      >
        <MenuDotsIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => runAndClose(() => importInputRef.current?.click())}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isImporting ? <Spinner /> : <UploadIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
            <span>
              Import from PDF
              <span className="block text-xs text-slate-400 dark:text-slate-500">{importSubtitle}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => runAndClose(onExport)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isExporting ? <Spinner /> : <DownloadIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
            Export as PDF
          </button>
          {mode === 'single' && (
            <button
              type="button"
              onClick={() => runAndClose(onLoadExample)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <SparkleIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <span>
                Load example
                <span className="block text-xs text-slate-400 dark:text-slate-500">See how a filled-in bill looks</span>
              </span>
            </button>
          )}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            type="button"
            onClick={() => runAndClose(onSettings)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <GearIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            Settings
          </button>
        </div>
      )}
    </div>
  )
}
