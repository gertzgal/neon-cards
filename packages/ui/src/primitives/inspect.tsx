import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cardFrameStyle } from './playing-card'
import type { Size } from './metrics'

export interface InspectCopy {
  title: string
  rule: string
  preview: ReactNode
}

/** The card in the inspect panel. It does not reuse a table card's test id. */
export function InspectFace({ accent, box, children }: { accent: string; box: Size; children: ReactNode }) {
  return (
    <div
      className="nc-card"
      data-testid="card-inspect-face"
      style={{ ...cardFrameStyle(box), '--nc-c': accent } as CSSProperties}
    >
      <div className="nc-card-in">{children}</div>
    </div>
  )
}

const HOLD_MS = 420
const MOVE_PX = 12

function faceCard(root: HTMLElement, target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const el = target.closest('.nc-card')
  if (!(el instanceof HTMLElement) || !root.contains(el)) return null
  if (el.classList.contains('nc-card-back')) return null
  if (el.getAttribute('data-testid') === 'card-inspect-face') return null
  return el
}

/**
 * Tap or long-press a face-up card to read it. `readOnTap` says whether this short tap
 * is a question. A tap that plays or picks a target returns false and is left alone.
 * A long-press always reads, and the click that follows it does not also play.
 */
export function useCardInspect(
  rootRef: RefObject<HTMLElement | null>,
  describe: (card: HTMLElement) => InspectCopy | null,
  readOnTap: (card: HTMLElement, target: EventTarget | null) => boolean,
): { copy: InspectCopy | null; close: () => void } {
  const [copy, setCopy] = useState<InspectCopy | null>(null)
  const describeRef = useRef(describe)
  const readRef = useRef(readOnTap)
  useEffect(() => {
    describeRef.current = describe
    readRef.current = readOnTap
  }, [describe, readOnTap])
  const close = useCallback(() => setCopy(null), [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let timer = 0
    let card: HTMLElement | null = null
    let sx = 0
    let sy = 0
    let suppress = false
    let held = false

    const show = (el: HTMLElement) => {
      const next = describeRef.current(el)
      if (!next) return
      suppress = true
      setCopy(next)
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      window.clearTimeout(timer)
      held = false
      card = faceCard(root, event.target)
      if (!card) return
      sx = event.clientX
      sy = event.clientY
      const heldCard = card
      timer = window.setTimeout(() => {
        held = true
        show(heldCard)
      }, HOLD_MS)
    }
    const onUp = (event: PointerEvent) => {
      window.clearTimeout(timer)
      const el = card
      card = null
      if (!el || held) return
      if (Math.hypot(event.clientX - sx, event.clientY - sy) > MOVE_PX) return
      if (!readRef.current(el, event.target)) return
      show(el)
    }
    const onCancel = () => {
      window.clearTimeout(timer)
      card = null
    }
    const onClick = (event: MouseEvent) => {
      if (!suppress) return
      suppress = false
      event.preventDefault()
      event.stopPropagation()
    }
    const onMenu = (event: MouseEvent) => {
      if (faceCard(root, event.target)) event.preventDefault()
    }
    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    root.addEventListener('click', onClick, true)
    root.addEventListener('contextmenu', onMenu)
    return () => {
      window.clearTimeout(timer)
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('contextmenu', onMenu)
    }
  }, [rootRef])

  return { copy, close }
}

/** One panel for every game. The tap that opened it does not also close it. The next tap, or Escape, does. */
export function CardInspect({ copy, onClose }: { copy: InspectCopy | null; onClose: () => void }) {
  const ready = useRef(false)
  useEffect(() => {
    if (!copy) {
      ready.current = false
      return
    }
    ready.current = false
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onDown = () => {
      ready.current = true
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [copy, onClose])
  if (!copy || typeof document === 'undefined') return null
  const root = document.querySelector('.nc-root') ?? document.body
  return createPortal(
    <div
      className="nc-inspect-scrim"
      data-testid="card-inspect"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={() => {
        if (ready.current) onClose()
      }}
    >
      <div className="nc-inspect">
        {copy.preview}
        <p className="nc-inspect-title">{copy.title}</p>
        <p className="nc-inspect-rule">{copy.rule}</p>
      </div>
    </div>,
    root,
  )
}
