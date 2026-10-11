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

function fakeContext() {
  const nodes: FakeNode[] = []
  const make = (kind: string) => {
    const n = new FakeNode(kind)
    nodes.push(n)
    return n
  }
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: make('destination'),
    createGain: () => make('gain'),
    createOscillator: () => make('osc'),
    createBiquadFilter: () => make('filter'),
    createBufferSource: () => make('noise'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    resume: async () => {
      ctx.state = 'running'
    },
  }
  return { ctx, nodes, oscs: () => nodes.filter((n) => n.kind === 'osc') }
}

function setup(initial = {}) {
  const fake = fakeContext()
  const gestures = new EventTarget()
  const audio = createAudioManager({ initial, gestureTarget: gestures, createContext: () => fake.ctx as unknown as AudioContext })
  return { audio, fake, gestures }
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
})
