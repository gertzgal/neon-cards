import { describe, expect, it } from 'vitest'
import { mintCode, parseCode } from './code'
import { noteFailedJoin } from './joins'

describe('codes', () => {
  it('mints four characters from the alphabet and rejects lookalikes', () => {
    expect(mintCode(() => 0)).toBe('AAAA')
    expect(parseCode('ab2c')).toBe('AB2C')
    expect(parseCode('AIB2')).toBeNull()
    expect(parseCode('AB')).toBeNull()
  })
})

describe('failed joins', () => {
  it('allows ten failures in a minute and limits the eleventh', () => {
    let stamps: number[] = []
    for (let i = 0; i < 10; i++) {
      const next = noteFailedJoin(stamps, 1_000 + i)
      expect(next.limited).toBe(false)
      stamps = next.stamps
    }
    expect(noteFailedJoin(stamps, 1_010).limited).toBe(true)
    expect(noteFailedJoin(stamps, 61_000).limited).toBe(false)
  })
})
