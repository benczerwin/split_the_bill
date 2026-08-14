import { useState } from 'react'

interface SettingsModalProps {
  apiKey: string
  onSave: (key: string) => void
  onClose: () => void
}

export default function SettingsModal({ apiKey, onSave, onClose }: SettingsModalProps) {
  const [value, setValue] = useState(apiKey)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
        <p className="mt-2 text-sm text-slate-500">
          Receipt scanning uses Claude&rsquo;s vision API directly from your browser. Your key is stored only in this
          browser&rsquo;s local storage and is sent straight to Anthropic&rsquo;s API — never to any other server.
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-500">Anthropic API key</span>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Get a key at{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">
            console.anthropic.com
          </a>
          . Don&rsquo;t share this device/browser profile if you'd rather keep the key private.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(value.trim())
              onClose()
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
