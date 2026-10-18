import type { Chrome, FitRow, Viewport } from './place'

/** The four sizes `pnpm verify layout` drives. This gate does not launch that skill. */
export const VIEWPORTS = {
  phone360: { width: 360, height: 640 },
  phone390: { width: 390, height: 844 },
  desktop1280: { width: 1280, height: 800 },
  desktop1440: { width: 1440, height: 900 },
} as const satisfies Record<string, Viewport>

/**
 * Shell chrome read from `.nc-hud` on main `c86bbbd`: 58px, and 70px inside
 * `@media (min-width: 700px)`. A caller passes the band. The engine does not
 * turn it into a card scale.
 */
export function shellChrome(viewport: Viewport): Chrome {
  return { top: viewport.width < 700 ? 58 : 70, bottom: 0 }
}

export function longRows(cards: number): FitRow[] {
  return [
    { id: 'score', count: 1, role: 'score' },
    { id: 'hand', count: cards, role: 'hand' },
    { id: 'slots', count: 23, role: 'slots' },
    { id: 'buttons', count: 2, role: 'buttons' },
  ]
}

export function roomRows(): FitRow[] {
  return [
    { id: 'opponent-a', count: 5, role: 'opponents' },
    { id: 'opponent-b', count: 5, role: 'opponents' },
    { id: 'opponent-c', count: 4, role: 'opponents' },
    { id: 'score', count: 1, role: 'score' },
    { id: 'hand', count: 8, role: 'hand' },
    { id: 'buttons', count: 4, role: 'buttons' },
  ]
}
