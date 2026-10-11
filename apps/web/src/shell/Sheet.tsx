import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({
  testId,
  title,
  onClose,
  children,
}: {
  testId: string
  title: string
  onClose?: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Portaled so a table's transformed ancestors (screen shake) can't capture position: fixed.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
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
