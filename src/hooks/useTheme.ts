import { useEffect, useState } from 'react'
import type { Theme } from '../types'
import { loadTheme, saveTheme } from '../lib/storage'

/** Manages the light/dark/system theme choice and keeps the `dark` class on <html> in sync —
 *  including live-following the OS setting while 'system' is selected. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    function apply() {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', isDark)
    }

    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  function setTheme(next: Theme) {
    setThemeState(next)
    saveTheme(next)
  }

  return { theme, setTheme }
}
