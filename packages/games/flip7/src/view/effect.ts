import type { Flip7Face } from '@neon-cards/engine'

const HOLD_MS = 1700

/** A few words for the moment a Flip 7 card resolves. Number faces stay quiet. */
export function lineForFlip7(event: { type: string; card?: unknown }): string | null {
  switch (event.type) {
    case 'Frozen':
      return 'Freeze'
    case 'FlipThreeStarted':
      return 'Three flips'
    case 'SecondChanceGained':
    case 'SecondChancePassed':
      return 'Second chance'
    case 'SecondChanceUsed':
      return 'Saved'
    case 'CardDealt':
      return modifierLine(faceOf(event.card))
    default:
      return null
  }
}

function faceOf(card: unknown): Flip7Face | undefined {
  if (!card || typeof card !== 'object' || !('face' in card)) return undefined
  return (card as { face?: Flip7Face }).face
}

function modifierLine(face: Flip7Face | undefined): string | null {
  if (!face || face.kind !== 'modifier') return null
  return face.op === 'times' ? 'Times two' : `Plus ${face.value}`
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
