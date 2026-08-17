import { useState } from 'react'
import type { Theme } from '../types'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'

interface SettingsModalProps {
  apiKey: string
  theme: Theme
  onSave: (key: string) => void
  onThemeChange: (theme: Theme) => void
  onClose: () => void
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export default function SettingsModal({ apiKey, theme, onSave, onThemeChange, onClose }: SettingsModalProps) {
  const [value, setValue] = useState(apiKey)
  useBodyScrollLock()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Settings</h2>

        <div className="mt-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Appearance</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onThemeChange(opt.value)}
                className={`rounded-md py-1.5 text-sm font-medium transition ${
                  theme === opt.value
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Receipt scanning uses Claude&rsquo;s vision API directly from your browser. Your key is stored only in this
            browser&rsquo;s local storage and is sent straight to Anthropic&rsquo;s API — never to any other server.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Anthropic API key</span>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Get a key at{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">
              console.anthropic.com
            </a>
            . Don&rsquo;t share this device/browser profile if you'd rather keep the key private.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(value.trim())
              onClose()
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
