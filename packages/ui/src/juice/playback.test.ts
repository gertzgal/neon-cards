import type { GameEvent } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import type { JuiceKit } from '../api'
import { runPlayback, type PlaybackDeps } from './playback'

function harness(skipAfter?: string) {
  const log: string[] = []
  let skipped = false
  const kit = {
    sfx: (name: string) => log.push(`sfx ${name}`),
    wait: async (ms: number) => {
      log.push(`wait ${ms}`)
    },
  } as unknown as JuiceKit
  const deps: PlaybackDeps = {
    kit,
    juice: {
      deal: (e) => {
        log.push(`juice deal ${String(e['card'])}`)
        if (skipAfter === e['card']) skipped = true
      },
      stand: async (e) => {
        log.push(`juice stand ${e.seat ?? ''}`)
      },
    },
    apply: (e) => log.push(`apply ${e.type}${e.seat ? ` ${e.seat}` : ''}`),
    isCpu: (seat) => seat.startsWith('cpu'),
    settle: async () => {},
    thinkingMs: 500,
    skipped: () => skipped,
    onTurn: (seat, thinking) => log.push(`turn ${seat} ${thinking ? 'thinking' : 'acting'}`),
  }
  return { log, deps }
}

const events: GameEvent[] = [
  { type: 'deal', seat: 'you', card: 'c1' },
  { type: 'turn', seat: 'cpu1' },
  { type: 'deal', seat: 'cpu1', card: 'c2' },
  { type: 'stand', seat: 'cpu1' },
  { type: 'turn', seat: 'you' },
]

describe('runPlayback', () => {
  it('applies each event, gives CPU turns a thinking beat, then runs that event juice in order', async () => {
    const { log, deps } = harness()
    await runPlayback(events, deps)
    expect(log).toEqual([
      'apply deal you',
      'juice deal c1',
      'apply turn cpu1',
      'turn cpu1 acting',
      'turn cpu1 thinking',
      'sfx turn',
      'wait 500',
      'turn cpu1 acting',
      'apply deal cpu1',
      'juice deal c2',
      'apply stand cpu1',
      'juice stand cpu1',
      'apply turn you',
      'turn you acting',
    ])
  })

  it('after a skip, applies every remaining event with no beats or juice', async () => {
    const { log, deps } = harness('c1')
    await runPlayback(events, deps)
    expect(log).toEqual([
      'apply deal you',
      'juice deal c1',
      'apply turn cpu1',
      'turn cpu1 acting',
      'apply deal cpu1',
      'apply stand cpu1',
      'apply turn you',
      'turn you acting',
    ])
  })
})
