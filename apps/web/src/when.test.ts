import { describe, expect, it } from 'vitest'
import { ago } from './when'

const now = Date.UTC(2026, 9, 11, 12, 0, 0)

describe('ago', () => {
  it('rounds down to the largest whole unit', () => {
    expect(ago(now - 59_000, now)).toBe('now')
    expect(ago(now - 60_000, now)).toBe('1m')
    expect(ago(now - 59 * 60_000, now)).toBe('59m')
    expect(ago(now - 3 * 3_600_000 - 1, now)).toBe('3h')
    expect(ago(now - 2 * 86_400_000, now)).toBe('2d')
  })

  it('shows a short date after a week', () => {
    expect(ago(Date.UTC(2026, 9, 2, 12), now)).toBe('Oct 2')
  })

  it('treats a clock that runs ahead as now', () => {
    expect(ago(now + 5_000, now)).toBe('now')
  })
})
