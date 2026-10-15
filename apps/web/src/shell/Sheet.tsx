import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({
  testId,
  title,
  onClose,
  cover = 'modal',
  children,
}: {
  testId: string
  title: string
  onClose?: () => void
  /** `modal` dims the whole screen. `table` leaves the top bar bright and clickable. */
  cover?: 'modal' | 'table'
  children: ReactNode
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Portaled so a table's transformed ancestors (screen shake) can't capture position: fixed.
  return createPortal(
    <div className="sheet-backdrop" data-cover={cover} onClick={cover === 'modal' ? onClose : undefined}>
      <section
        className="sheet"
        role="dialog"
        aria-modal={cover === 'modal'}
        aria-label={title}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="sheet-close" data-testid={`${testId}-close`} aria-label="Close" onClick={onClose}>
              ×
            </button>
          )}
        </header>
        {children}
      </section>
    </div>,
    document.body,
  )
}
