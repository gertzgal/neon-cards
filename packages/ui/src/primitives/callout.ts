const HOLD_MS = 1100

/** A few words on the juice layer for the card that just landed. It does not sit inside the table. */
export function showPlayCallout(text: string, anchorTestId: string, seat: string): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector('.nc-fx')
  if (!host) return
  const anchor = document.querySelector(`[data-testid="${CSS.escape(anchorTestId)}"]`)
  const rect = anchor?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + Math.min(rect.height * 0.42, 120) : window.innerHeight * 0.42
  for (const old of host.querySelectorAll('[data-testid="play-callout"]')) old.remove()
  const el = document.createElement('div')
  el.className = 'nc-callout'
  el.dataset['testid'] = 'play-callout'
  el.dataset['line'] = text
  el.dataset['seat'] = seat
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  const ring = document.createElement('i')
  ring.setAttribute('aria-hidden', 'true')
  const label = document.createElement('b')
  label.textContent = text
  el.append(ring, label)
  host.appendChild(el)
  window.setTimeout(() => {
    el.remove()
  }, HOLD_MS)
}
