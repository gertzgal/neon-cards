import type { AudioManager, AudioSettings, SfxName } from '../api'

export const defaultAudioSettings: AudioSettings = { muted: false, music: true, sfx: true, volume: 0.8 }

type Wave = OscillatorType

export interface AudioManagerOptions {
  initial?: Partial<AudioSettings>
  /** Builds the AudioContext on unlock. Tests pass a fake. */
  createContext?: () => AudioContext
  /** Where the first-gesture unlock listens. Defaults to `window` when there is one. */
  gestureTarget?: EventTarget | null
  /** Pauses the loop while hidden (`visibilitychange`). Defaults to `document` when there is one. */
  page?: (EventTarget & { readonly hidden: boolean }) | null
}

/** iOS Safari only resumes audio from touchend/click, Chrome from pointerdown or keydown. */
const gestureEvents = ['pointerdown', 'touchend', 'click', 'keydown'] as const

const bpm = 100
const step = 60 / bpm / 4
const lookAhead = 0.12
const tickMs = 25

const progression: { root: number; tones: [number, number, number] }[] = [
  { root: 45, tones: [0, 3, 7] },
  { root: 41, tones: [0, 4, 7] },
  { root: 48, tones: [0, 4, 7] },
  { root: 43, tones: [0, 4, 7] },
]

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function browserContext(): AudioContext {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctor()
}

/** WebAudio synthwave loop plus chiptune effects, all synthesized. Silent until the first user gesture. */
export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  let settings: AudioSettings = { ...defaultAudioSettings, ...options.initial }
  const listeners = new Set<(s: AudioSettings) => void>()
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let musicBus: GainNode | null = null
  let sfxBus: GainNode | null = null
  let noise: AudioBuffer | null = null
  let wantMusic = false
  let timer: ReturnType<typeof setInterval> | null = null
  let nextAt = 0
  let stepNo = 0

  const levels = () => ({
    master: settings.muted ? 0 : clamp01(settings.volume),
    music: settings.music ? 0.55 : 0,
    sfx: settings.sfx ? 1 : 0,
  })

  const applyLevels = () => {
    if (!ctx || !master || !musicBus || !sfxBus) return
    const l = levels()
    const t = ctx.currentTime
    master.gain.setTargetAtTime(l.master, t, 0.02)
    musicBus.gain.setTargetAtTime(l.music, t, 0.05)
    sfxBus.gain.setTargetAtTime(l.sfx, t, 0.02)
  }

  const tone = (bus: AudioNode, f: number, d: number, wave: Wave, v: number, at: number, f2?: number) => {
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = wave
    o.frequency.setValueAtTime(f, at)
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + d)
    g.gain.setValueAtTime(v, at)
    g.gain.exponentialRampToValueAtTime(0.0005, at + d)
    o.connect(g).connect(bus)
    o.start(at)
    o.stop(at + d + 0.02)
  }

  const hiss = (bus: AudioNode, d: number, v: number, cutoff: number, at: number) => {
    if (!ctx || !noise) return
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(v, at)
    g.gain.exponentialRampToValueAtTime(0.0005, at + d)
    src.connect(filter).connect(g).connect(bus)
    src.start(at)
    src.stop(at + d + 0.02)
  }

  const pad = (bus: AudioNode, f: number, d: number, at: number) => {
    if (!ctx) return
    const o = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, at)
    filter.type = 'lowpass'
    filter.frequency.value = 900
    g.gain.setValueAtTime(0.0005, at)
    g.gain.linearRampToValueAtTime(0.014, at + 0.3)
    g.gain.setValueAtTime(0.014, at + d - 0.2)
    g.gain.linearRampToValueAtTime(0.0005, at + d)
    o.connect(filter).connect(g).connect(bus)
    o.start(at)
    o.stop(at + d + 0.02)
  }

  const scheduleStep = (s: number, at: number) => {
    if (!musicBus) return
    const bar = progression[Math.floor(s / 16) % progression.length]
    if (!bar) return
    const beat = s % 16
    if (beat === 0) for (const t of bar.tones) pad(musicBus, hz(bar.root + 12 + t), step * 16, at)
    if (s % 2 === 0) tone(musicBus, hz(bar.root + (s % 4 === 0 ? 0 : 12)), step * 1.6, 'triangle', 0.09, at)
    const arp = [0, 7, 12, bar.tones[1] + 12][s % 4] ?? 0
    tone(musicBus, hz(bar.root + 24 + arp), step * 0.8, 'square', 0.016, at)
    if (s % 4 === 0) tone(musicBus, 120, 0.16, 'sine', 0.22, at, 45)
    if (s % 8 === 4) hiss(musicBus, 0.12, 0.06, 1500, at)
    if (s % 2 === 1) hiss(musicBus, 0.03, 0.02, 7000, at)
  }

  const tick = () => {
    if (!ctx) return
    while (nextAt < ctx.currentTime + lookAhead) {
      scheduleStep(stepNo, nextAt)
      stepNo = (stepNo + 1) % (16 * progression.length)
      nextAt += step
    }
  }

  const page = options.page === undefined ? (typeof document === 'undefined' ? null : document) : options.page

  /** The loop is only scheduled while it can be heard, so mute and the music switch cost nothing. */
  const syncMusic = () => {
    const audible = !settings.muted && settings.music && settings.volume > 0 && !page?.hidden
    const on = wantMusic && audible && ctx !== null && ctx.state === 'running'
    if (on && timer === null && ctx) {
      nextAt = ctx.currentTime + 0.05
      stepNo = 0
      tick()
      timer = setInterval(tick, tickMs)
    } else if (!on && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const gestureTarget = options.gestureTarget === undefined ? (typeof window === 'undefined' ? null : window) : options.gestureTarget
  const onGesture = () => {
    void manager.unlock()
  }
  const listenForGesture = (on: boolean) => {
    for (const type of gestureEvents) {
      if (on) gestureTarget?.addEventListener(type, onGesture, true)
      else gestureTarget?.removeEventListener(type, onGesture, true)
    }
  }
  const onStateChange = () => {
    // A suspended or interrupted context (iOS after a call, a lock screen) needs a fresh gesture to resume.
    listenForGesture(ctx?.state !== 'running')
    syncMusic()
  }

  const manager: AudioManager = {
    get settings() {
      return settings
    },
    get unlocked() {
      return ctx !== null && ctx.state === 'running'
    },
    update(patch) {
      settings = { ...settings, ...patch }
      applyLevels()
      syncMusic()
      for (const l of listeners) l(settings)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async unlock() {
      if (!ctx) {
        try {
          ctx = (options.createContext ?? browserContext)()
        } catch {
          return
        }
        master = ctx.createGain()
        musicBus = ctx.createGain()
        sfxBus = ctx.createGain()
        master.gain.value = 0
        musicBus.connect(master)
        sfxBus.connect(master)
        master.connect(ctx.destination)
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
        const data = noise.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        applyLevels()
        ctx.addEventListener('statechange', onStateChange)
      }
      if (ctx.state !== 'running') {
        try {
          await ctx.resume()
        } catch {
          // Not a qualifying gesture; the listeners stay for the next one.
        }
      }
      onStateChange()
      for (const l of listeners) l(settings)
    },
    play(name: SfxName) {
      if (!ctx || !sfxBus || ctx.state !== 'running' || settings.muted || !settings.sfx) return
      const bus = sfxBus
      const t = ctx.currentTime
      const sq = (f: number, d: number, v: number, at = 0, f2?: number) => tone(bus, f, d, 'square', v, t + at, f2)
      const tri = (f: number, d: number, v: number, at = 0, f2?: number) => tone(bus, f, d, 'triangle', v, t + at, f2)
      switch (name) {
        case 'card':
          sq(1600, 0.035, 0.025)
          tri(500, 0.05, 0.05, 0.005, 200)
          break
        case 'chip':
          sq(2600, 0.04, 0.02)
          sq(3400, 0.05, 0.015, 0.035)
          break
        case 'flip':
          sq(900, 0.05, 0.025, 0, 1800)
          break
        case 'bust':
          tone(bus, 140, 0.3, 'sawtooth', 0.07, t, 50)
          break
        case 'win':
          sq(660, 0.08, 0.035)
          sq(990, 0.12, 0.035, 0.07)
          break
        case 'lose':
          tri(300, 0.12, 0.06)
          tri(200, 0.2, 0.06, 0.1)
          break
        case 'push':
          tri(520, 0.1, 0.05)
          break
        case 'blackjack':
          ;[523, 659, 784, 1046, 1318, 1568].forEach((f, i) => sq(f, 0.14, 0.035, i * 0.055))
          break
        case 'click':
          sq(1200, 0.025, 0.02)
          break
        case 'turn':
          tri(780, 0.06, 0.03)
          tri(1040, 0.08, 0.03, 0.06)
          break
      }
    },
    startMusic() {
      wantMusic = true
      syncMusic()
    },
    stopMusic() {
      wantMusic = false
      syncMusic()
    },
  }

  listenForGesture(true)
  page?.addEventListener('visibilitychange', syncMusic)
  return manager
}

let shared: AudioManager | null = null
/** The app-wide manager. The shell feeds it settings with `update()`; NeonRoot routes juice sfx to it. */
export function getAudio(): AudioManager {
  shared ??= createAudioManager()
  return shared
}
