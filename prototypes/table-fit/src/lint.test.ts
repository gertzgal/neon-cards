import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { lintSource } from '../../../tools/eslint-plugin-table-fit/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function messages(path: string): string[] {
  const code = readFileSync(resolve(root, path), 'utf8')
  return lintSource(code, path).map((message) => message.message)
}

describe('no-hand-tuned-card-size', () => {
  it('flags the six placers on main and does not flag the engine', () => {
    const hand = messages('packages/ui/src/primitives/hand.tsx').join('\n')
    expect(hand).toContain('handLayout')
    expect(hand).toContain('straightRow')
    expect(hand).toContain('fittedRow')
    expect(hand).toContain('minVisible')
    expect(hand).toContain('minScale')
    expect(hand).toContain('startScale')
    expect(hand).toContain('scrolls')

    const blackjack = messages('packages/games/blackjack/src/view/layout.ts').join('\n')
    expect(blackjack).toContain('layoutHand')
    expect(blackjack).toContain('MIN_SHOWN')
    expect(blackjack).toContain('MIN_SHRINK')

    const flip7 = messages('packages/games/flip7/src/view/hand-room.ts').join('\n')
    expect(flip7).toContain('FLIP7_PHONE_SCALE')
    expect(flip7).toContain('FLIP7_DESKTOP_SCALE')

    const kittens = messages('packages/games/exploding-kittens/src/view/Table.tsx').join('\n')
    expect(kittens).toContain('fittedRow')
    expect(kittens).toContain('scrollToCard')

    const scroll = messages('packages/games/exploding-kittens/src/view/defuse-scroll.ts').join('\n')
    expect(scroll).toContain('scrollToCard')

    expect(messages('prototypes/table-fit/src/place.ts')).toEqual([])
    expect(messages('prototypes/table-fit/src/audit.ts')).toEqual([])
  })
})
