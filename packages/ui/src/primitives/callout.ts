const HOLD_MS = 1100

/** A few words on the juice layer for the card that just landed. It does not sit inside the table. */
export function showPlayCallout(text: string, anchorTestId: string, seat: string): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector('.nc-fx')
  if (!host) return
  const anchor = document.querySelector(`[data-testid="${CSS.escape(anchorTestId)}"]`)
  const rect = anchor?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  // The fade starts with most of the line below this point. Park that point above the anchor
  // so a Second Chance toast does not draw on the pile.
  const y = rect ? rect.top - 36 : window.innerHeight * 0.28
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
  // The intro scale can still dip onto the anchor. Lift until the line clears it, and keep the words on screen.
  const clearAnchor = () => {
    const box = el.getBoundingClientRect()
    let left = Number.parseFloat(el.style.left)
    let top = Number.parseFloat(el.style.top)
    if (rect) {
      const overlapX = Math.min(box.right, rect.right) - Math.max(box.left, rect.left)
      const overlapY = Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top)
      if (overlapX > 1 && overlapY > 1) top -= box.bottom - rect.top + 10
    }
    if (box.left < 8) left += 8 - box.left
    if (box.right > window.innerWidth - 8) left -= box.right - (window.innerWidth - 8)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }
  clearAnchor()
  window.requestAnimationFrame(clearAnchor)
  window.setTimeout(() => {
    el.remove()
  }, HOLD_MS)
}
