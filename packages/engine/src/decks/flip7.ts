import type { DeckSpec } from '../types'

export type Flip7Number = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
export type Flip7Action = 'freeze' | 'flipThree' | 'secondChance'

export type Flip7Face =
  | { kind: 'number'; value: Flip7Number }
  | { kind: 'modifier'; op: 'add'; value: 2 | 4 | 6 | 8 | 10 }
  | { kind: 'modifier'; op: 'times'; value: 2 }
  | { kind: 'action'; action: Flip7Action }

const NUMBERS: Flip7Number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const ADDS = [2, 4, 6, 8, 10] as const
const ACTIONS: Flip7Action[] = ['freeze', 'flipThree', 'secondChance']

/** 94 cards: one 0, then n copies of each number n from 1 to 12, one of each modifier, three of each action. */
export const flip7Deck: DeckSpec<Flip7Face> = {
  id: 'flip7',
  build: () => [
    ...NUMBERS.flatMap((value) => Array.from({ length: Math.max(value, 1) }, (): Flip7Face => ({ kind: 'number', value }))),
    ...ADDS.map((value): Flip7Face => ({ kind: 'modifier', op: 'add', value })),
    { kind: 'modifier', op: 'times', value: 2 },
    ...ACTIONS.flatMap((action) => Array.from({ length: 3 }, (): Flip7Face => ({ kind: 'action', action }))),
  ],
}
