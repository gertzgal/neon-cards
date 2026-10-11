import { ConfigError, type SeatId } from '@neon-cards/engine'
import { isFaceKey } from './cards'

/**
 * Dev-only rigs (DEV_RIG=1). A rig lists the faces a seat draws next, in order, as face keys
 * (see faceKey). The cards are pulled out of the shoe, so ids stay unique; once a seat's list runs
 * out it draws from the shuffled pile again. `cpu` applies to every CPU seat. Rigged games put the
 * dealer last, so the human is dealt first.
 *
 * A literal rig is `seat=keys;seat=keys`, e.g. `you=5,5;cpu=1,2`. `total:you=190` starts a seat's score.
 */
export const RIGS = {
  // You flip 7 unique numbers. Every rig gives the CPUs 12, 11, 10, where a Medium CPU stays.
  flip7: 'you=1,2,3,4,5,6,7;cpu=12,11,10',
  // Your second card repeats the first.
  bust: 'you=5,5;cpu=12,11,10',
  // Dealt a Freeze: you pick who freezes.
  freeze: 'you=F,6;cpu=12,11,10',
  // Dealt a Flip Three: you pick who flips three.
  flip3: 'you=T,9;cpu=12,11,10',
  // A Second Chance saves your repeat.
  second: 'you=S,4,4;cpu=12,11,10',
  // x2 doubles the numbers, +4 adds after: (8 + 3) x 2 + 4 = 26.
  mods: 'you=8,x2,3,+4;cpu=12,11,10',
  // One good round wins the game.
  win: 'you=10,11;cpu=12,11,10;total:you=190',
} as const

export type RigName = keyof typeof RIGS

export interface ParsedRig {
  draws: Record<string, string[]>
  totals: Record<string, number>
}

export function parseRig(rig: string): ParsedRig {
  const literal = (RIGS as Record<string, string>)[rig] ?? rig
  const draws: Record<string, string[]> = {}
  const totals: Record<string, number> = {}
  for (const part of literal.split(';').map((p) => p.trim()).filter(Boolean)) {
    const total = /^total:([\w-]+)=(\d+)$/.exec(part)
    if (total) {
      totals[total[1] as string] = Number(total[2])
      continue
    }
    const m = /^([\w-]+)=(.*)$/.exec(part)
    if (!m) throw new ConfigError(`bad rig part "${part}"`)
    const keys = (m[2] as string).split(',').map((k) => k.trim()).filter(Boolean)
    for (const k of keys) if (!isFaceKey(k)) throw new ConfigError(`unknown rig face "${k}"`)
    draws[m[1] as string] = keys
  }
  return { draws, totals }
}

/** Expands `cpu` to every CPU seat id. */
export function rigForSeats(parsed: ParsedRig, seats: { id: SeatId; kind: string }[]): Record<SeatId, string[]> {
  const out: Record<SeatId, string[]> = {}
  for (const seat of seats) {
    const keys = parsed.draws[seat.id] ?? (seat.kind === 'cpu' ? parsed.draws['cpu'] : undefined)
    if (keys) out[seat.id] = [...keys]
  }
  return out
}
