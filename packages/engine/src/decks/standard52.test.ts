import { describe, expect, it } from 'vitest'
import { standard52 } from './standard52'

describe('standard52', () => {
  it('builds 52 distinct rank and suit pairs in suit-major order', () => {
    const faces = standard52.build()
    expect(faces.length).toBe(52)
    expect(new Set(faces.map((f) => f.rank + f.suit)).size).toBe(52)
    expect(faces.slice(0, 2)).toEqual([
      { rank: 'A', suit: 'H' },
      { rank: '2', suit: 'H' },
    ])
    expect(faces[51]).toEqual({ rank: 'K', suit: 'C' })
  })
})
