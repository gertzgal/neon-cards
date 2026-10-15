import type { Difficulty, Seat } from './types'

interface SoloDefinition {
  house: readonly { id: string; name: string }[]
}

/**
 * The only solo seat list. Rooms will pass their own chairs later.
 * Score games keep today's ids (`you`, `cpu-1`...) so seeded rigs stay put.
 * A house list means blackjack: human `player`, then those house seats.
 */
export function soloSeats(definition: SoloDefinition, config: unknown): Seat[] {
  if (definition.house.length > 0) {
    return [
      { id: 'player', kind: 'human', name: 'You' },
      ...definition.house.map((seat) => ({ id: seat.id, kind: 'house' as const, name: seat.name })),
    ]
  }
  const raw = config && typeof config === 'object' ? (config as { opponents?: unknown; difficulty?: unknown; position?: unknown }) : {}
  const opponents = typeof raw.opponents === 'number' ? raw.opponents : 0
  const difficulty: Difficulty = raw.difficulty === 'medium' || raw.difficulty === 'hard' || raw.difficulty === 'easy' ? raw.difficulty : 'easy'
  const cpus: Seat[] = Array.from({ length: opponents }, (_, i) => ({
    id: `cpu-${i + 1}`,
    kind: 'cpu',
    name: `CPU ${i + 1}`,
    difficulty,
  }))
  const human: Seat = { id: 'you', kind: 'human', name: 'You' }
  return raw.position === 'last' ? [...cpus, human] : [human, ...cpus]
}
