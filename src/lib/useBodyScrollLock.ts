import { useEffect } from 'react'

// Without this, a touch-scroll that starts on a modal's backdrop (rather than its scrollable
// content) can fall through and scroll the page behind it on mobile Safari — the "stuck
// scrolling behind the window" bug. Locking body scroll while any modal is mounted prevents
// that scroll-chaining.
export function useBodyScrollLock(): void {
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])
}
