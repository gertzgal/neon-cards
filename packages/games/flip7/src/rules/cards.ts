import { flip7Deck, type Flip7Face } from '@neon-cards/engine'
import type { Line, SeatRound } from './types'

export const FLIP7_BONUS = 15
export const TARGET_SCORE = 200
export const UNIQUE_TO_FLIP7 = 7

/**
 * Short notation for a face, used by rigs and card counting: "0".."12", "+2".."+10", "x2",
 * "F" (Freeze), "T" (Flip Three), "S" (Second Chance).
 */
export function faceKey(face: Flip7Face): string {
  if (face.kind === 'number') return String(face.value)
  if (face.kind === 'modifier') return face.op === 'add' ? `+${face.value}` : 'x2'
  return face.action === 'freeze' ? 'F' : face.action === 'flipThree' ? 'T' : 'S'
}

/** Every distinct face key with its count in one 94-card deck. */
export const DECK_COUNTS: Readonly<Record<string, number>> = flip7Deck
  .build()
  .reduce<Record<string, number>>((acc, face) => {
    const key = faceKey(face)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

export const FACE_KEYS: readonly string[] = Object.keys(DECK_COUNTS)

export const isFaceKey = (key: string): boolean => key in DECK_COUNTS

export const emptyLine = (): Line => ({ numbers: [], modifiers: [], secondChance: null, freeze: null })

export const numberValues = (line: Line): number[] =>
  line.numbers.flatMap((c) => (c.face.kind === 'number' ? [c.face.value] : []))

export const hasNumber = (line: Line, value: number): boolean => numberValues(line).includes(value)

export const uniqueCount = (line: Line): number => new Set(numberValues(line)).size

export const hasTimes2 = (line: Line): boolean =>
  line.modifiers.some((c) => c.face.kind === 'modifier' && c.face.op === 'times')

export const plusSum = (line: Line): number =>
  line.modifiers.reduce((sum, c) => sum + (c.face.kind === 'modifier' && c.face.op === 'add' ? c.face.value : 0), 0)

/** A seat may Stay only with a card in front of it: a number, a modifier, or a held Second Chance. */
export const hasAnyCard = (line: Line): boolean =>
  line.numbers.length > 0 || line.modifiers.length > 0 || line.secondChance !== null

/** Sum numbers, double them for x2, add the + modifiers, add 15 for Flip 7. A bust scores 0. */
export function scoreParts(seat: SeatRound): { numbers: number; x2: boolean; plus: number; flip7Bonus: number; value: number } {
  const numbers = numberValues(seat.line).reduce((a, b) => a + b, 0)
  const x2 = hasTimes2(seat.line)
  const plus = plusSum(seat.line)
  const flip7Bonus = seat.flip7 ? FLIP7_BONUS : 0
  if (seat.status === 'busted') return { numbers, x2, plus, flip7Bonus: 0, value: 0 }
  return { numbers, x2, plus, flip7Bonus, value: numbers * (x2 ? 2 : 1) + plus + flip7Bonus }
}

export const roundValue = (seat: SeatRound): number => scoreParts(seat).value
