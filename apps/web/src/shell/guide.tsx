import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CrtOverlay, type GameGuide, type GuideBlock, type GuideClose, type GuideText } from '@neon-cards/ui'
import './guide.css'

// Installed at evaluation, before any table effect, so this capture listener is
// first on window. A listener added when the page opens loses to blackjack's hurry.
let bound: { close: () => void; root: HTMLElement } | null = null
let swallowEscape = false

function onGuideKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && swallowEscape) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  const page = bound
  if (!page) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.key === 'Escape' && !event.repeat) {
    swallowEscape = true
    page.close()
  }
}

function onGuideKeyUp(event: KeyboardEvent) {
  if (event.key === 'Escape') swallowEscape = false
}

function onGuidePointerDown(event: PointerEvent) {
  const root = bound?.root
  if (!root) return
  const target = event.target
  if (target instanceof Node && root.contains(target)) event.stopImmediatePropagation()
}

function bindGuideEscape(close: () => void, root: HTMLElement): () => void {
  if (bound) throw new Error('a guide page is already bound')
  const binder = { close, root }
  bound = binder
  return () => {
    if (bound === binder) bound = null
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onGuideKeyDown, true)
  window.addEventListener('keyup', onGuideKeyUp, true)
  window.addEventListener('pointerdown', onGuidePointerDown, true)
}

function useGuideCardPx(): number {
  const query = '(min-width: 900px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setWide(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return wide ? 76 : 68
}

function Runs({ text }: { text: GuideText }) {
  return text.map((run, index) =>
    run.gold ? (
      <span key={index} className="guide-gold">
        {run.text}
      </span>
    ) : (
      <span key={index}>{run.text}</span>
    ),
  )
}

function Blocks({ blocks }: { blocks: readonly GuideBlock[] }) {
  return blocks.map((block, index) =>
    block.kind === 'paragraph' ? (
      <p key={index}>
        <Runs text={block.text} />
      </p>
    ) : (
      <ul key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <Runs text={item} />
          </li>
        ))}
      </ul>
    ),
  )
}

/** Full-viewport Direction A page, portaled so the table shake and the app CRT cannot cover it. */
export function GuidePage({ guide, onClose }: { guide: GameGuide; onClose: GuideClose }): ReactNode {
  const page = useRef<HTMLDivElement>(null)
  const widthPx = useGuideCardPx()
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.nc-root')
    shell?.setAttribute('inert', '')
    const root = page.current
    if (!root) return () => shell?.removeAttribute('inert')
    const release = bindGuideEscape(onClose, root)
    return () => {
      shell?.removeAttribute('inert')
      release()
    }
  }, [onClose])

  return createPortal(
    <div
      ref={page}
      className="guide"
      role="dialog"
      aria-modal="true"
      aria-label={`How to play ${guide.title}`}
      data-testid="guide"
    >
      <CrtOverlay />
      <div className="guide-bar">
        <div>
          <div className="guide-kick">HOW TO PLAY</div>
          <h1>{guide.title}</h1>
        </div>
        <button type="button" className="guide-x guide-pix" data-testid="guide-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <main>
        {guide.sections.map((section, index) => (
          <section key={section.id} data-testid={`guide-section-${section.id}`}>
            <h2>
              <i>{index + 1}</i>
              {section.title}
            </h2>
            {section.kind === 'prose' ? (
              <Blocks blocks={section.blocks} />
            ) : (
              <div className="guide-cards">
                {section.rows.map((row) => (
                  <div key={row.id} className="guide-row" data-testid={`guide-row-${row.id}`}>
                    <div className="guide-row-card">{row.paint(widthPx)}</div>
                    <div className="guide-row-copy">
                      <div className="guide-row-name">{row.name}</div>
                      <div className="guide-row-rule">{row.sentence}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
      <div className="guide-foot">
        <button type="button" className="guide-go guide-pix" data-testid="guide-done" onClick={onClose}>
          GOT IT ▶ PLAY
        </button>
      </div>
    </div>,
    document.body,
  )
}
