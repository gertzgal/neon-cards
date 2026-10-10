import type { Card, DeckSpec, Rng } from './types'

/** Fisher-Yates. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const swap = out[i] as T
    out[i] = out[j] as T
    out[j] = swap
  }
  return out
}

/** Ids are shoe positions, so they never reveal a face. Pass a fresh `idPrefix` when reshuffling mid-session. */
export function buildShoe<Face>(spec: DeckSpec<Face>, copies: number, rng: Rng, idPrefix = spec.id): Card<Face>[] {
  if (!Number.isInteger(copies) || copies < 1) throw new RangeError(`copies must be a positive integer, got ${copies}`)
  const faces: Face[] = []
  for (let i = 0; i < copies; i++) faces.push(...spec.build())
  return shuffle(faces, rng).map((face, i) => ({ id: `${idPrefix}-${i}`, deck: spec.id, face }))
}

export function faceDown<Face>(card: Card<Face>): Card<null> {
  return { id: card.id, deck: card.deck, face: null }
}
