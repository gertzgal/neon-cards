import type { Card, DeckSpec, Rng } from '@neon-cards/engine'

// Local until packages/engine ships its runtime helpers; same signatures as the contract.
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}

export function buildShoe<Face>(spec: DeckSpec<Face>, copies: number, rng: Rng): Card<Face>[] {
  const faces: Face[] = []
  for (let i = 0; i < copies; i++) faces.push(...spec.build())
  return shuffle(faces, rng).map((face, i) => ({ id: `${spec.id}-${i}`, deck: spec.id, face }))
}
