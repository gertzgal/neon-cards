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

function faceUp(el: HTMLElement): boolean {
  return !el.classList.contains('nc-card-back') && el.getAttribute('data-testid') !== 'card-inspect-face'
}

/** The face under the pointer, including the button chrome around a tilted card. */
function faceCard(root: HTMLElement, target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const direct = target.closest('.nc-card')
  if (direct instanceof HTMLElement && root.contains(direct) && faceUp(direct)) return direct
  const button = target.closest('button')
  if (!(button instanceof HTMLElement) || !root.contains(button)) return null
  const inner = button.querySelector('.nc-card')
  if (!(inner instanceof HTMLElement) || !faceUp(inner)) return null
  return inner
}

export function cardKey(el: HTMLElement): string | null {
  const id = el.getAttribute('data-testid')
  if (!id || !id.startsWith('card-') || id === 'card-inspect-face') return null
  return id
}

export function inHand(el: HTMLElement): boolean {
  return Boolean(el.closest('[data-testid="you-hand"]'))
}

/** A hand card you can play right now. The button carries `data-play`. */
export function canPlay(el: HTMLElement): boolean {
  const button = el.closest('button')
  return button instanceof HTMLButtonElement && button.dataset['play'] === 'true'
}

function picking(el: HTMLElement): boolean {
  return el.closest('[data-pick="true"]') !== null
}

/**
 * Hover and the first tap only read. A later tap plays, and only when this card was already open
 * and the hover that opened it has already been spent.
 */
export function readOrPlay(openId: string | null, hoverFresh: boolean, cardId: string, playable: boolean): 'read' | 'play' {
  if (openId === cardId && playable && !hoverFresh) return 'play'
  return 'read'
}

/**
 * Hover or the first tap on a hand card opens its rule. That contact does not play it.
 * A second tap on the same card plays it. A tap on a different card moves the popup.
 * A tap that is choosing a seat is left alone.
 */
export function useCardInspect(
  rootRef: RefObject<HTMLElement | null>,
  describe: (card: HTMLElement) => InspectCopy | null,
): { copy: InspectCopy | null; cardId: string | null; playable: boolean; confirm: () => void; close: () => void } {
  const [copy, setCopy] = useState<InspectCopy | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [playable, setPlayable] = useState(false)
  const describeRef = useRef(describe)
  const openIdRef = useRef<string | null>(null)
  const openElRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    describeRef.current = describe
  }, [describe])

  const close = useCallback(() => {
    openIdRef.current = null
    openElRef.current = null
    setCopy(null)
    setCardId(null)
    setPlayable(false)
  }, [])

  const confirm = useCallback(() => {
    const el = openElRef.current
    const button = el?.closest('button')
    if (!(button instanceof HTMLButtonElement) || button.dataset['play'] !== 'true') return
    close()
    button.click()
  }, [close])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let hoverFresh = false
    let suppress = false

    const show = (el: HTMLElement, fromHover: boolean) => {
      const next = describeRef.current(el)
      const id = cardKey(el)
      if (!next || !id) return
      openIdRef.current = id
      openElRef.current = el
      hoverFresh = fromHover
      setPlayable(canPlay(el))
      setCardId(id)
      setCopy(next)
    }

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const card = faceCard(root, event.target)
      if (!card || !inHand(card) || picking(card)) return
      const id = cardKey(card)
      if (!id || id === openIdRef.current) return
      show(card, true)
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const card = faceCard(root, event.target)
      if (!card || picking(card)) return
      const id = cardKey(card)
      if (!id) return
      const hand = inHand(card)
      const playableCard = canPlay(card)
      if (!hand && playableCard) return
      if (!hand) {
        show(card, false)
        suppress = true
        return
      }
      if (readOrPlay(openIdRef.current, hoverFresh, id, playableCard) === 'play') {
        hoverFresh = false
        suppress = false
        return
      }
      show(card, false)
      suppress = true
    }

    const onClick = (event: MouseEvent) => {
      if (suppress) {
        suppress = false
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const card = faceCard(root, event.target)
      if (card && cardKey(card) === openIdRef.current) {
        close()
        return
      }
      if (!card && openIdRef.current) close()
    }

    const onMenu = (event: MouseEvent) => {
      if (faceCard(root, event.target)) event.preventDefault()
    }

    root.addEventListener('pointerover', onOver)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('click', onClick, true)
    root.addEventListener('contextmenu', onMenu)
    return () => {
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('contextmenu', onMenu)
    }
  }, [rootRef, close])

  return { copy, cardId, playable, confirm, close }
}

/** One panel for every game. The hand stays tappable underneath it. */
export function CardInspect({
  copy,
  cardId,
  playable,
  onPlay,
  onClose,
}: {
  copy: InspectCopy | null
  cardId: string | null
  playable: boolean
  onPlay: () => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!copy) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copy, onClose])
  if (!copy || typeof document === 'undefined') return null
  const root = document.querySelector('.nc-root') ?? document.body
  return createPortal(
    <div className="nc-inspect-scrim" data-testid="card-inspect" data-card={cardId ?? ''} role="dialog" aria-modal="false" aria-label={copy.title}>
      <div className="nc-inspect">
        {copy.preview}
        <p className="nc-inspect-title">{copy.title}</p>
        <p className="nc-inspect-rule">{copy.rule}</p>
        {playable && (
          <button
            type="button"
            className="nc-inspect-play"
            data-testid="card-inspect-play"
            onClick={(event) => {
              event.stopPropagation()
              onPlay()
            }}
          >
            Play
          </button>
        )}
      </div>
    </div>,
    root,
  )
}
