import { useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

interface SwipeToDeleteProps {
  onDelete: () => void
  children: ReactNode
  className?: string
}

const DELETE_THRESHOLD = 72
const START_THRESHOLD = 10

export default function SwipeToDelete({ onDelete, children, className }: SwipeToDeleteProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const committed = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
    setDragX(Math.min(0, dx))
  }

  function endDrag() {
    if (!start.current && !committed.current) return
    start.current = null
    setDragging(false)
    if (committed.current && dragX < -DELETE_THRESHOLD) {
      const width = containerRef.current?.offsetWidth ?? 320
      setRemoving(true)
      setDragX(-(width + 40))
      window.setTimeout(onDelete, 160)
    } else {
      setDragX(0)
    }
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-xl ${className ?? ''}`}>
      <div className="absolute inset-0 flex items-center justify-end bg-red-500 pr-5 text-sm font-medium text-white">
        Delete
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : removing ? 'transform 0.16s ease-in' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  )
}
