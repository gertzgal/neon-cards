export type SfxName = 'card' | 'chip' | 'flip' | 'bust' | 'win' | 'lose' | 'push' | 'blackjack' | 'peek' | 'refill' | 'tap'

export interface Sfx {
  play(name: SfxName): void
}

type Tone = [freq: number, dur: number, wave: OscillatorType, vol: number, at?: number, slideTo?: number]

const TONES: Record<SfxName, Tone[]> = {
  card: [
    [1600, 0.035, 'square', 0.025],
    [500, 0.05, 'triangle', 0.05, 0.005, 200],
  ],
  chip: [
    [2600, 0.04, 'square', 0.02],
    [3400, 0.05, 'square', 0.015, 0.035],
  ],
  flip: [[900, 0.05, 'square', 0.025, 0, 1800]],
  peek: [[700, 0.04, 'square', 0.015, 0, 900]],
  tap: [[1200, 0.03, 'square', 0.015]],
  bust: [
    [140, 0.3, 'sawtooth', 0.07, 0, 50],
    [90, 0.25, 'square', 0.04, 0.02, 40],
  ],
  win: [
    [660, 0.08, 'square', 0.035],
    [990, 0.12, 'square', 0.035, 0.07],
  ],
  lose: [
    [300, 0.12, 'triangle', 0.06],
    [200, 0.2, 'triangle', 0.06, 0.1],
  ],
  push: [[520, 0.1, 'triangle', 0.05]],
  blackjack: [523, 659, 784, 1046, 1318, 1568].map((f, i) => [f, 0.14, 'square', 0.035, i * 0.055] as Tone),
  refill: [392, 523, 659, 784].map((f, i) => [f, 0.1, 'triangle', 0.05, i * 0.06] as Tone),
}

/** Crunchy chiptune blips synthesized on the fly; no audio files to load. */
export function createSfx(isMuted: () => boolean): Sfx {
  let ctx: AudioContext | null = null
  return {
    play(name) {
      if (isMuted() || typeof window === 'undefined') return
      try {
        ctx ??= new AudioContext()
      } catch {
        return
      }
      const t = ctx.currentTime
      for (const [freq, dur, wave, vol, at = 0, slideTo] of TONES[name]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = wave
        osc.frequency.setValueAtTime(freq, t + at)
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + at + dur)
        gain.gain.setValueAtTime(vol, t + at)
        gain.gain.exponentialRampToValueAtTime(0.0005, t + at + dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t + at)
        osc.stop(t + at + dur + 0.02)
      }
    },
  }
}
