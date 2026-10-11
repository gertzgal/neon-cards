import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import worker from '../src/index'

const start = (devRig: string) =>
  worker.fetch(
    new Request('http://neon.test/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: 'high-card', config: { opponents: 3, difficulty: 'hard' } }),
    }),
    { ...env, DEV_RIG: devRig },
  )

describe('the production Worker registry', () => {
  it('serves the test-only High Card game only with DEV_RIG=1', async () => {
    expect((await start('0')).status).toBe(404)
    const dev = await start('1')
    expect(dev.status).toBe(201)
    const body = (await dev.json()) as { seats: { id: string; kind: string; difficulty?: string }[] }
    expect(body.seats.map((s) => `${s.id}:${s.kind}:${s.difficulty ?? ''}`)).toEqual([
      'you:human:',
      'cpu-1:cpu:hard',
      'cpu-2:cpu:hard',
      'cpu-3:cpu:hard',
    ])
  })
})
