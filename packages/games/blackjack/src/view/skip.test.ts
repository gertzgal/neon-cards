import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSkip, finishAnimations } from './skip'

describe('createSkip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits out the full time while nobody skips', async () => {
    const skip = createSkip()
    let done = false
    void skip.wait(300).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(299)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('a skip resolves every pending wait at once', async () => {
    const skip = createSkip()
    const order: string[] = []
    void skip.wait(500).then(() => order.push('a'))
    void skip.wait(900).then(() => order.push('b'))
    skip.skip()
    await Promise.resolve()
    expect(order).toEqual(['a', 'b'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('later waits are instant until reset, then pace again', async () => {
    const skip = createSkip()
    skip.skip()
    expect(skip.skipped).toBe(true)
    let instant = false
    void skip.wait(1000).then(() => (instant = true))
    await Promise.resolve()
    expect(instant).toBe(true)

    skip.reset()
    expect(skip.skipped).toBe(false)
    let paced = false
    void skip.wait(1000).then(() => (paced = true))
    await vi.advanceTimersByTimeAsync(999)
    expect(paced).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(paced).toBe(true)
  })

  it('a skipped round of table pacing ends in one tick instead of seconds', async () => {
    const skip = createSkip()
    const beats = [140, 290, 290, 290, 290, 160, 120, 650, 900]
    let finished = false
    const round = (async () => {
      for (const ms of beats) await skip.wait(ms)
      finished = true
    })()
    await vi.advanceTimersByTimeAsync(400)
    expect(finished).toBe(false)
    skip.skip()
    await round
    expect(finished).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('finishAnimations', () => {
  const scripted = () => ({ finish: vi.fn(), cancel: vi.fn() })

  it('finishes scripted animations and leaves CSS animations and transitions running', () => {
    const fly = scripted()
    const sway = { ...scripted(), animationName: 'bj-sway' }
    const fade = { ...scripted(), transitionProperty: 'opacity' }
    finishAnimations([fly, sway, fade])
    expect(fly.finish).toHaveBeenCalledOnce()
    expect(sway.finish).not.toHaveBeenCalled()
    expect(fade.finish).not.toHaveBeenCalled()
  })

  it('cancels an animation that cannot finish', () => {
    const endless = {
      finish: vi.fn(() => {
        throw new DOMException('infinite', 'InvalidStateError')
      }),
      cancel: vi.fn(),
    }
    finishAnimations([endless])
    expect(endless.cancel).toHaveBeenCalledOnce()
  })
})
