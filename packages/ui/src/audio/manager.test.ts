import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudioManager } from './manager'

class FakeParam {
  value = 0
  events: [string, number][] = []
  setValueAtTime(v: number) {
    this.events.push(['set', v])
  }
  setTargetAtTime(v: number) {
    this.value = v
    this.events.push(['target', v])
  }
  exponentialRampToValueAtTime(v: number) {
    this.events.push(['exp', v])
  }
  linearRampToValueAtTime(v: number) {
    this.events.push(['lin', v])
  }
}

class FakeNode {
  constructor(readonly kind: string) {}
  gain = new FakeParam()
  frequency = new FakeParam()
  type = ''
  buffer: unknown = null
  connect<T>(next: T): T {
    return next
  }
  start() {}
  stop() {}
}

function fakeContext({ refuseResumes = 0 } = {}) {
  const nodes: FakeNode[] = []
  const make = (kind: string) => {
    const n = new FakeNode(kind)
    nodes.push(n)
    return n
  }
  let refusals = refuseResumes
  const events = new EventTarget()
  const ctx = {
    state: 'suspended',
    addEventListener: events.addEventListener.bind(events),
    setState(state: string) {
      ctx.state = state
      events.dispatchEvent(new Event('statechange'))
    },
    currentTime: 0,
    sampleRate: 8000,
    destination: make('destination'),
    createGain: () => make('gain'),
    createOscillator: () => make('osc'),
    createBiquadFilter: () => make('filter'),
    createBufferSource: () => make('noise'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    resume: async () => {
      if (refusals-- > 0) throw new Error('not allowed to start')
      ctx.setState('running')
    },
  }
  return { ctx, nodes, oscs: () => nodes.filter((n) => n.kind === 'osc') }
}

class FakePage extends EventTarget {
  hidden = false
  setHidden(hidden: boolean) {
    this.hidden = hidden
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

function setup(initial = {}, contextOptions = {}) {
  const fake = fakeContext(contextOptions)
  const gestures = new EventTarget()
  const page = new FakePage()
  const audio = createAudioManager({
    initial,
    gestureTarget: gestures,
    page,
    createContext: () => fake.ctx as unknown as AudioContext,
  })
  return { audio, fake, gestures, page }
}

/** Oscillators the loop schedules over the next second of audio time. */
function loopNotes(fake: ReturnType<typeof fakeContext>) {
  const before = fake.oscs().length
  fake.ctx.currentTime += 1
  vi.advanceTimersByTime(30)
  return fake.oscs().length - before
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createAudioManager', () => {
  it('stays silent until the first gesture unlocks it', async () => {
    const { audio, fake, gestures } = setup()
    audio.play('win')
    expect(fake.oscs()).toHaveLength(0)
    expect(audio.unlocked).toBe(false)

    gestures.dispatchEvent(new Event('pointerdown'))
    await vi.waitFor(() => expect(audio.unlocked).toBe(true))
    audio.play('win')
    expect(fake.oscs().map((o) => o.frequency.events[0])).toEqual([
      ['set', 660],
      ['set', 990],
    ])
  })

  it('mute and the sfx switch drop effects; volume drives the master gain', async () => {
    const { audio, fake } = setup({ volume: 0.5 })
    await audio.unlock()
    const master = fake.nodes.filter((n) => n.kind === 'gain')[0]
    expect(master?.gain.value).toBe(0.5)

    audio.update({ muted: true })
    expect(master?.gain.value).toBe(0)
    audio.play('chip')
    audio.update({ muted: false, sfx: false })
    audio.play('chip')
    expect(fake.oscs()).toHaveLength(0)
    expect(master?.gain.value).toBe(0.5)
  })

  it('notifies subscribers with the new settings', () => {
    const { audio } = setup()
    const seen: boolean[] = []
    const off = audio.subscribe((s) => seen.push(s.muted))
    audio.update({ muted: true })
    off()
    audio.update({ muted: false })
    expect(seen).toEqual([true])
  })

  it('schedules the loop ahead while music is on and stops on stopMusic', async () => {
    vi.useFakeTimers()
    const { audio, fake } = setup()
    await audio.unlock()
    audio.startMusic()
    const first = fake.oscs().length
    expect(first).toBeGreaterThan(0)

    fake.ctx.currentTime = 1
    vi.advanceTimersByTime(30)
    const later = fake.oscs().length
    expect(later).toBeGreaterThan(first)

    audio.stopMusic()
    fake.ctx.currentTime = 2
    vi.advanceTimersByTime(100)
    expect(fake.oscs()).toHaveLength(later)
  })

  it('a startMusic before the first gesture starts the loop on that gesture', async () => {
    vi.useFakeTimers()
    const { audio, fake, gestures } = setup()
    audio.startMusic()
    expect(fake.oscs()).toHaveLength(0)
    gestures.dispatchEvent(new Event('touchend'))
    await vi.waitFor(() => expect(audio.unlocked).toBe(true))
    expect(loopNotes(fake)).toBeGreaterThan(0)
  })

  it('schedules nothing while muted or with music off, and picks the loop back up when heard again', async () => {
    vi.useFakeTimers()
    const { audio, fake } = setup({ muted: true })
    audio.startMusic()
    await audio.unlock()
    expect(loopNotes(fake)).toBe(0)

    audio.update({ muted: false })
    expect(loopNotes(fake)).toBeGreaterThan(0)

    audio.update({ music: false })
    expect(loopNotes(fake)).toBe(0)
    audio.update({ music: true })
    expect(loopNotes(fake)).toBeGreaterThan(0)
  })

  it('pauses the loop while the page is hidden', async () => {
    vi.useFakeTimers()
    const { audio, fake, page } = setup()
    audio.startMusic()
    await audio.unlock()
    page.setHidden(true)
    expect(loopNotes(fake)).toBe(0)
    page.setHidden(false)
    expect(loopNotes(fake)).toBeGreaterThan(0)
  })

  it('keeps listening when a gesture fails to start audio, and after the context is interrupted', async () => {
    vi.useFakeTimers()
    const { audio, fake, gestures } = setup({}, { refuseResumes: 1 })
    audio.startMusic()
    gestures.dispatchEvent(new Event('pointerdown'))
    await vi.waitFor(() => expect(fake.ctx.state).toBe('suspended'))
    expect(audio.unlocked).toBe(false)

    gestures.dispatchEvent(new Event('click'))
    await vi.waitFor(() => expect(audio.unlocked).toBe(true))
    expect(loopNotes(fake)).toBeGreaterThan(0)

    fake.ctx.setState('interrupted')
    expect(loopNotes(fake)).toBe(0)
    gestures.dispatchEvent(new Event('keydown'))
    await vi.waitFor(() => expect(audio.unlocked).toBe(true))
    expect(loopNotes(fake)).toBeGreaterThan(0)
  })
})
