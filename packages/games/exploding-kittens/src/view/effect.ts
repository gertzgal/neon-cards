import type { Effect, EkEvent } from '../rules'

const HOLD_MS = 1700

/** A few words for the moment a card resolves. Faces stay as drawn. */
export function lineForEk(event: EkEvent | { type: string }): string | null {
  switch (event.type) {
    case 'Played':
      return lineForPlayed((event as Extract<EkEvent, { type: 'Played' }>).effect)
    case 'Attacked':
      return 'Two draws'
    case 'Shuffled':
      return 'Shuffled'
    case 'Peeked':
      return 'Three ahead'
    case 'Stole':
      return 'Steal one'
    case 'Asked':
      return 'Ask'
    case 'Took':
      return 'Take one'
    case 'Noped':
    case 'Cancelled':
      return 'Nope'
    case 'Defused':
      return 'Defused'
    default:
      return null
  }
}

function lineForPlayed(effect: Effect): string | null {
  if (effect.type === 'skip') return 'Skip'
  if (effect.type === 'favor') return 'Give one'
  return null
}

/** Pops the line on the juice layer, outside the table, and lets it fade on its own. */
export function showEffect(text: string): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector('.nc-fx')
  if (!host) return
  for (const old of host.querySelectorAll('[data-testid="effect-line"]')) old.remove()
  const el = document.createElement('div')
  el.className = 'uxc-line'
  el.dataset['testid'] = 'effect-line'
  el.dataset['line'] = text
  const ring = document.createElement('i')
  const label = document.createElement('b')
  label.textContent = text
  el.append(ring, label)
  host.appendChild(el)
  window.setTimeout(() => el.remove(), HOLD_MS)
}
