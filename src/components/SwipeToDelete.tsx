import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

interface SwipeToDeleteProps {
  onDelete: () => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

const ACTION_WIDTH = 84
const OPEN_THRESHOLD = ACTION_WIDTH / 2
const START_THRESHOLD = 10

export default function SwipeToDelete({ onDelete, isOpen, onOpenChange, children, className }: SwipeToDeleteProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const committed = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // A mousedown+mousemove+mouseup sequence still fires a trailing "click" afterward no
  // matter how far the pointer moved — this flags that click so we can ignore it instead
  // of treating it as a tap that should close the row we just dragged open.
  const suppressNextClick = useRef(false)
  // A ref mirror of dragX: pointerup can fire before React has re-rendered (and thus
  // re-bound the handler) after the last pointermove, which would make the `dragX`
  // closure in endDrag stale. Refs update synchronously, so this is always current.
  const dragXRef = useRef(0)

  // Reflect external changes (e.g. another row opened, closing this one) when we're not
  // mid-gesture ourselves.
  useEffect(() => {
    if (!dragging) {
      const next = isOpen ? -ACTION_WIDTH : 0
      dragXRef.current = next
      setDragX(next)
    }
  }, [isOpen, dragging])

  function fullDeleteThreshold() {
    const width = containerRef.current?.offsetWidth ?? 320
    return -(width * 0.55)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY }
    committed.current = false
    setDragging(true)
  }

  function onPointerMove(e: PointerEvent) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y

    if (!committed.current) {
      if (Math.abs(dx) < START_THRESHOLD && Math.abs(dy) < START_THRESHOLD) return
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical intent — let the page scroll instead of hijacking the gesture.
        start.current = null
        setDragging(false)
        return
      }
      committed.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    // Start from wherever the row currently sits (open or closed) so re-dragging an
    // already-open row feels continuous instead of jumping back to 0 first.
    const base = isOpen ? -ACTION_WIDTH : 0
    const next = Math.min(0, base + dx)
    dragXRef.current = next
    setDragX(next)
  }

  function endDrag() {
    const wasCommitted = committed.current
    start.current = null
    committed.current = false
    setDragging(false)
    if (!wasCommitted) return
    suppressNextClick.current = true

    const finalX = dragXRef.current
    if (finalX < fullDeleteThreshold()) {
      const width = containerRef.current?.offsetWidth ?? 320
      setRemoving(true)
      dragXRef.current = -(width + 40)
      setDragX(dragXRef.current)
      window.setTimeout(onDelete, 160)
    } else if (finalX < -OPEN_THRESHOLD) {
      dragXRef.current = -ACTION_WIDTH
      setDragX(dragXRef.current)
      onOpenChange(true)
    } else {
      dragXRef.current = 0
      setDragX(0)
      onOpenChange(false)
    }
  }

  function handleContentClick() {
    if (suppressNextClick.current) {
      suppressNextClick.current = false
      return
    }
    // A plain tap while the delete action is revealed just closes it again,
    // matching the usual "swipe actions" pattern.
    if (isOpen) onOpenChange(false)
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-xl ${className ?? ''}`}>
      <button
        type="button"
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center bg-red-500 text-sm font-medium text-white hover:bg-red-600"
      >
        Delete
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleContentClick}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : removing ? 'transform 0.16s ease-in' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
        className="relative bg-white dark:bg-slate-900"
      >
        {children}
      </div>
    </div>
  )
}
