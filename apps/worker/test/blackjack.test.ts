import type { BlackjackView } from '@neon-cards/game-blackjack/rules'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { client, json } from './client'

interface Res {
  sessionId: string
  view: BlackjackView
  seq: number
  status: string
  wallet?: number
}

const ledger = (playerId: string) =>
  env.DB.prepare('SELECT delta, reason FROM wallet_ledger WHERE player_id = ? ORDER BY id')
    .bind(playerId)
    .all<{ delta: number; reason: string }>()
    .then((r) => r.results.map((x) => `${x.reason}:${x.delta}`))

async function sit(p: ReturnType<typeof client>, rig: string) {
  const res = await p.post('/api/sessions', { gameId: 'blackjack', config: { rig } })
  expect(res.status).toBe(201)
  return json<Res>(res)
}

describe('blackjack through the API (chips economy)', () => {
  it('seats the wallet balance as the stack and settles a 3:2 blackjack into the wallet', async () => {
    const p = client()
    const s = await sit(p, 'blackjack')
    expect([s.wallet, s.view.stack, s.view.phase, s.seq]).toEqual([1250, 1250, 'betting', 0])
    const a = await json<Res>(p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'bet', amount: 100 }, seq: 0 }))
    expect([a.wallet, a.view.stack, a.view.phase, a.seq]).toEqual([1400, 1400, 'settling', 1])
    expect(await json(p.get('/api/wallet'))).toEqual({ balance: 1400 })
    expect(await ledger(p.playerId())).toEqual(['start:1250', 'round:150'])
    const { rounds } = await json<{ rounds: { roundNo: number; net: number; summary: { settlements: unknown } }[] }>(
      p.get('/api/history?gameId=blackjack'),
    )
    expect(rounds.map((r) => [r.roundNo, r.net, r.summary.settlements])).toEqual([[1, 150, [{ seat: 'player', delta: 150 }]]])
  })

  it('hides the hole card from the view until it is revealed', async () => {
    const p = client()
    const s = await sit(p, 'win')
    const a = await json<Res>(p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'bet', amount: 25 }, seq: 0 }))
    expect(a.view.phase).toBe('playing')
    expect(a.view.dealer.cards.map((c) => c.face)).toEqual([{ rank: '9', suit: 'C' }, null])
  })

  it('refills a broke wallet once through the game refill action', async () => {
    const p = client()
    const s = await sit(p, 'lose')
    const url = `/api/sessions/${s.sessionId}/actions`
    await p.post(url, { action: { type: 'bet', amount: 1250 }, seq: 0 })
    const lost = await json<Res>(p.post(url, { action: { type: 'stand' }, seq: 1 }))
    expect([lost.wallet, lost.view.stack, lost.view.legal]).toEqual([0, 0, ['refill']])
    const refilled = await json<Res>(p.post(url, { action: { type: 'refill' }, seq: 2 }))
    expect([refilled.wallet, refilled.view.stack]).toEqual([1250, 1250])
    expect(await ledger(p.playerId())).toEqual(['start:1250', 'round:-1250', 'refill:1250'])
  })

  it('does not double-refill when GET /api/wallet already refilled the player', async () => {
    const p = client()
    const s = await sit(p, 'lose')
    const url = `/api/sessions/${s.sessionId}/actions`
    await p.post(url, { action: { type: 'bet', amount: 1250 }, seq: 0 })
    await p.post(url, { action: { type: 'stand' }, seq: 1 })
    expect(await json(p.get('/api/wallet'))).toEqual({ balance: 1250, refilled: 1250 })
    const refilled = await json<Res>(p.post(url, { action: { type: 'refill' }, seq: 2 }))
    expect([refilled.wallet, refilled.view.stack]).toEqual([1250, 1250])
    expect(await ledger(p.playerId())).toEqual(['start:1250', 'round:-1250', 'refill:1250'])
  })

  it('closes the previous chips session when a new one starts, so stacks never fork the wallet', async () => {
    const p = client()
    const old = await sit(p, 'win')
    const fresh = await sit(p, 'win')
    const res = await p.post(`/api/sessions/${old.sessionId}/actions`, { action: { type: 'bet', amount: 25 }, seq: 0 })
    expect(res.status).toBe(409)
    expect((await json<Res>(p.get(`/api/sessions/${old.sessionId}`))).status).toBe('over')
    expect((await p.post(`/api/sessions/${fresh.sessionId}/actions`, { action: { type: 'bet', amount: 25 }, seq: 0 })).status).toBe(200)
    // A rejected config must not close the live session.
    expect((await p.post('/api/sessions', { gameId: 'blackjack', config: { rig: 'nope' } })).status).toBe(400)
    expect((await json<Res>(p.get(`/api/sessions/${fresh.sessionId}`))).status).toBe('active')
  })

  it('forfeits the bet of a hand left mid-play when a new session starts, and records the lost round', async () => {
    const p = client()
    const old = await sit(p, 'bust')
    const dealt = await json<Res>(p.post(`/api/sessions/${old.sessionId}/actions`, { action: { type: 'bet', amount: 500 }, seq: 0 }))
    expect([dealt.view.phase, dealt.view.stack]).toEqual(['playing', 750])
    const fresh = await sit(p, 'win')
    expect([fresh.wallet, fresh.view.stack]).toEqual([750, 750])
    expect(await json(p.get('/api/wallet'))).toEqual({ balance: 750 })
    expect(await ledger(p.playerId())).toEqual(['start:1250', 'forfeit:-500'])
    const { rounds } = await json<{ rounds: { sessionId: string; roundNo: number; net: number; summary: Record<string, unknown> }[] }>(
      p.get('/api/history?gameId=blackjack'),
    )
    expect(rounds.map((r) => [r.sessionId, r.roundNo, r.net, r.summary.settlements, r.summary.forfeit])).toEqual([
      [old.sessionId, 1, -500, [{ seat: 'player', delta: -500 }], true],
    ])
    expect((rounds[0]?.summary.view as BlackjackView).hands[0]?.total).toBe(16)
  })

  it('forfeits doubled and split stakes, and closes a settled session for free', async () => {
    const p = client()
    const split = await sit(p, 'split')
    const url = `/api/sessions/${split.sessionId}/actions`
    await p.post(url, { action: { type: 'bet', amount: 100 }, seq: 0 })
    await p.post(url, { action: { type: 'split' }, seq: 1 })
    const doubled = await json<Res>(p.post(url, { action: { type: 'double' }, seq: 2 }))
    expect([doubled.view.phase, doubled.view.stack]).toEqual(['playing', 950])
    const settled = await sit(p, 'win')
    expect(settled.wallet).toBe(950)
    const won = await json<Res>(p.post(`/api/sessions/${settled.sessionId}/actions`, { action: { type: 'bet', amount: 25 }, seq: 0 }))
    await p.post(`/api/sessions/${settled.sessionId}/actions`, { action: { type: 'stand' }, seq: won.seq })
    expect((await sit(p, 'win')).wallet).toBe(975)
    expect(await ledger(p.playerId())).toEqual(['start:1250', 'forfeit:-300', 'round:25'])
  })

  it('refills once when the forfeited hand was all-in', async () => {
    const p = client()
    const old = await sit(p, 'bust')
    await p.post(`/api/sessions/${old.sessionId}/actions`, { action: { type: 'bet', amount: 1250 }, seq: 0 })
    const fresh = await sit(p, 'win')
    expect([fresh.wallet, fresh.view.stack]).toEqual([1250, 1250])
    expect(await ledger(p.playerId())).toEqual(['start:1250', 'forfeit:-1250', 'refill:1250'])
  })

  it('rejects an illegal bet with 400 and logs nothing', async () => {
    const p = client()
    const s = await sit(p, 'win')
    const res = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'bet', amount: 7 }, seq: 0 })
    expect(res.status).toBe(400)
    expect(await json(p.get(`/api/sessions/${s.sessionId}`))).toMatchObject({ seq: 0, wallet: 1250 })
  })
})
