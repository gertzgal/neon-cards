import { replay, type ActionRecord, type GameEvent, type Match, type Seat } from '@neon-cards/engine'
import { highCard, type HighCardConfig, type HighCardView } from '@neon-cards/engine/testing'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { client, json } from './client'

interface Created {
  sessionId: string
  gameId: string
  seats: Seat[]
  events: GameEvent[]
  view: HighCardView
  seq: number
  status: string
  wallet?: number
}
interface Acted {
  events: GameEvent[]
  view: HighCardView
  seq: number
  status: string
  wallet?: number
}

const loggedActions = (sessionId: string) =>
  env.DB.prepare('SELECT seq, seat, action_json, response_json IS NOT NULL AS stored FROM actions WHERE session_id = ? ORDER BY seq')
    .bind(sessionId)
    .all<{ seq: number; seat: string; action_json: string; stored: number }>()
    .then((r) => r.results)

const storedMatch = (sessionId: string) =>
  env.DB.prepare('SELECT state_json, status FROM sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ state_json: string; status: string }>()
    .then((r) => ({ match: JSON.parse(r?.state_json ?? 'null') as Match, status: r?.status }))

const types = (events: GameEvent[]) => events.map((e) => (e.seat ? `${e.type}:${e.seat}` : e.type))

const cfg = (c: Partial<HighCardConfig>) => ({ opponents: 3, difficulty: 'hard', position: 'last', ...c })

async function start(p: ReturnType<typeof client>, config: unknown, seed = 'worker-seed') {
  const res = await p.post('/api/sessions', { gameId: 'high-card', config, seed })
  expect(res.status).toBe(201)
  return json<Created>(res)
}

describe('POST /api/sessions (multi-seat, CPU before the human)', () => {
  it('builds seats from config and resolves the leading CPU turns server-side', async () => {
    const p = client()
    const s = await start(p, cfg({}))
    expect(s.seats).toEqual([
      { id: 'cpu-1', kind: 'cpu', name: 'CPU 1', difficulty: 'hard' },
      { id: 'cpu-2', kind: 'cpu', name: 'CPU 2', difficulty: 'hard' },
      { id: 'cpu-3', kind: 'cpu', name: 'CPU 3', difficulty: 'hard' },
      { id: 'you', kind: 'human', name: 'You' },
    ])
    expect(s.seq).toBe(3)
    expect(s.status).toBe('active')
    expect(s.wallet).toBeUndefined()
    expect(s.view.toAct).toBe('you')
    // Every CPU action is a turn event followed by that action's normal events.
    const turns = s.events.flatMap((e, i) => (e.type === 'turn' ? [`${e.seat}>${String(s.events[i + 1]?.type)}:${String(s.events[i + 1]?.seat)}`] : []))
    expect(turns.map((t) => t.split('>')[0])).toEqual(['cpu-1', 'cpu-2', 'cpu-3'])
    for (const t of turns) expect(t).toMatch(/^(cpu-\d)>(keep|swap):\1$/)
    // CPU actions land in the action log with their seat, and carry no stored response.
    const log = await loggedActions(s.sessionId)
    expect(log.map((r) => [r.seq, r.seat, r.stored])).toEqual([
      [0, 'cpu-1', 0],
      [1, 'cpu-2', 0],
      [2, 'cpu-3', 0],
    ])
  })

  it('redacts the view per seat: only the human sees its own card while playing', async () => {
    const s = await start(client(), cfg({}))
    expect(s.view.seat).toBe('you')
    expect(s.view.hands.you?.face).not.toBeNull()
    for (const id of ['cpu-1', 'cpu-2', 'cpu-3']) expect(s.view.hands[id]?.face).toBeNull()
    // Events are public: CPU swaps never carry the new card's face.
    for (const e of s.events) if (e.type === 'swap' || e.type === 'deal') expect((e.card as { face: unknown }).face).toBeNull()
  })

  it('passes settings through parseConfig into the roster', async () => {
    const s = await start(client(), { opponents: 1, difficulty: 'easy', position: 'first' })
    expect(s.seats.map((x) => [x.id, x.kind, x.difficulty])).toEqual([
      ['you', 'human', undefined],
      ['cpu-1', 'cpu', 'easy'],
    ])
    expect(s.seq).toBe(0)
    expect(s.events).toEqual([])
  })

  it('answers 400 for config parseConfig rejects, and 404 for an unknown game', async () => {
    const p = client()
    const bad = await p.post('/api/sessions', { gameId: 'high-card', config: { opponents: 5 } })
    expect(bad.status).toBe(400)
    expect((await json<{ error: string }>(bad)).error).toMatch(/^invalid config: /)
    expect((await p.post('/api/sessions', { gameId: 'high-card', config: [] })).status).toBe(400)
    expect((await p.post('/api/sessions', { gameId: 'nope' })).status).toBe(404)
    expect((await p.post('/api/sessions', { config: {} })).status).toBe(400)
  })

  it('keeps seeds and rigs dev-only', async () => {
    const prod = client({ DEV_RIG: '0' })
    expect((await prod.post('/api/sessions', { gameId: 'high-card', seed: 'x' })).status).toBe(400)
    expect((await prod.post('/api/sessions', { gameId: 'blackjack', config: { rig: 'blackjack' } })).status).toBe(400)
    expect((await prod.post('/api/sessions', { gameId: 'high-card', config: cfg({}) })).status).toBe(201)
  })
})

describe('POST /api/sessions/:id/actions', () => {
  it('applies the human action, runs the CPU loop, and logs every action in seq order', async () => {
    const p = client()
    const s = await start(p, cfg({ position: 'first' }))
    expect(s.seq).toBe(0)
    const res = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'keep' }, seq: 0 })
    expect(res.status).toBe(200)
    const a = await json<Acted>(res)
    expect(types(a.events).slice(0, 2)).toEqual(['keep:you', 'turn:cpu-1'])
    expect(types(a.events).filter((t) => t.startsWith('turn:'))).toEqual(['turn:cpu-1', 'turn:cpu-2', 'turn:cpu-3'])
    expect(types(a.events).slice(-5)).toEqual(['reveal:you', 'reveal:cpu-1', 'reveal:cpu-2', 'reveal:cpu-3', 'roundEnd'])
    expect(a.seq).toBe(4)
    expect(a.view.phase).toBe('settling')
    // Revealed at the end of the round, so every hand is face up.
    for (const id of ['you', 'cpu-1', 'cpu-2', 'cpu-3']) expect(a.view.hands[id]?.face).not.toBeNull()
    const log = await loggedActions(s.sessionId)
    expect(log.map((r) => [r.seq, r.seat, r.stored])).toEqual([
      [0, 'you', 1],
      [1, 'cpu-1', 0],
      [2, 'cpu-2', 0],
      [3, 'cpu-3', 0],
    ])
  })

  it('returns the stored response for a retried seq without re-running anything', async () => {
    const p = client()
    const s = await start(p, cfg({}))
    const first = await (await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'swap' }, seq: 3 })).text()
    const before = await storedMatch(s.sessionId)
    const retry = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'keep' }, seq: 3 })
    expect(retry.status).toBe(200)
    expect(await retry.text()).toBe(first)
    expect(await storedMatch(s.sessionId)).toEqual(before)
    expect((await loggedActions(s.sessionId)).length).toBe(4)
  })

  it('answers 409 for a seq that is ahead, or that belonged to a CPU', async () => {
    const p = client()
    const s = await start(p, cfg({}))
    expect((await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'keep' }, seq: 4 })).status).toBe(409)
    expect((await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'keep' }, seq: 1 })).status).toBe(409)
  })

  it('answers 400 for an action apply() rejects or a malformed body', async () => {
    const p = client()
    const s = await start(p, cfg({}))
    const url = `/api/sessions/${s.sessionId}/actions`
    const res = await p.post(url, { action: { type: 'next' }, seq: 3 })
    expect(res.status).toBe(400)
    expect(await json(res)).toEqual({ error: 'next is not legal while playing' })
    expect((await p.post(url, { action: { type: 'keep' } })).status).toBe(400)
    expect((await p.post(url, { seq: 3 })).status).toBe(400)
    expect((await loggedActions(s.sessionId)).length).toBe(3)
  })

  it("hides a session from other players", async () => {
    const s = await start(client(), cfg({}))
    const other = client()
    expect((await other.get(`/api/sessions/${s.sessionId}`)).status).toBe(404)
    expect((await other.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'keep' }, seq: 3 })).status).toBe(404)
  })

  it('plays a full game to over, replays from seed + log alone, and records each round in history', async () => {
    const p = client()
    const s = await start(p, cfg({ difficulty: 'medium' }))
    let seq = s.seq
    let last: Acted | undefined
    for (const action of ['keep', 'next', 'swap', 'next', 'keep']) {
      const res = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: action }, seq })
      expect(res.status).toBe(200)
      last = await json<Acted>(res)
      seq = last.seq
    }
    expect(last?.status).toBe('over')
    expect(last?.view.round).toBe(3)
    const after = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'next' }, seq })
    expect(after.status).toBe(409)

    const { match, status } = await storedMatch(s.sessionId)
    expect(status).toBe('over')
    const log: ActionRecord[] = (await loggedActions(s.sessionId)).map((r) => ({
      seq: r.seq,
      seat: r.seat,
      action: JSON.parse(r.action_json) as unknown,
    }))
    expect(log.length).toBe(seq)
    const replayed = replay(highCard as never, { seed: 'worker-seed', config: match.config, seats: match.seats, log })
    expect(replayed.match).toEqual(match)

    const resumed = await json<Created>(p.get(`/api/sessions/${s.sessionId}`))
    expect(resumed).toEqual({
      sessionId: s.sessionId,
      gameId: 'high-card',
      seats: s.seats,
      view: last?.view,
      seq,
      status: 'over',
    })

    const { rounds } = await json<{ rounds: { roundNo: number; net: number; gameId: string; summary: { settlements: unknown[]; view?: HighCardView } }[] }>(
      p.get('/api/history?gameId=high-card'),
    )
    expect(rounds.map((r) => [r.roundNo, r.net, r.gameId])).toEqual([
      [3, 0, 'high-card'],
      [2, 0, 'high-card'],
      [1, 0, 'high-card'],
    ])
    const scores: Record<string, number> = { you: 0, 'cpu-1': 0, 'cpu-2': 0, 'cpu-3': 0 }
    for (const r of rounds) for (const st of r.summary.settlements as { seat: string; delta: number }[]) scores[st.seat] = (scores[st.seat] ?? 0) + st.delta
    expect(scores).toEqual(last?.view.scores)
    expect((await json<{ rounds: unknown[] }>(p.get('/api/history?gameId=blackjack'))).rounds).toEqual([])
    expect((await json<{ rounds: unknown[] }>(client().get('/api/history'))).rounds).toEqual([])
  })
})

describe('Flip 7 opening on solo HTTP', () => {
  it('deals when the posted action is the opening, and rejects a different action', async () => {
    const p = client()
    const created = await p.post('/api/sessions', {
      gameId: 'flip7',
      config: { opponents: 1, difficulty: 'easy' },
      seed: 'open-1',
    })
    expect(created.status).toBe(201)
    const s = await json<{ sessionId: string; seq: number; view: { stage: string } }>(created)
    expect(s.view.stage).toBe('ready')
    expect(s.seq).toBe(0)
    const wrong = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'hit' }, seq: 0 })
    expect(wrong.status).toBe(400)
    const dealt = await p.post(`/api/sessions/${s.sessionId}/actions`, { action: { type: 'nextRound' }, seq: 0 })
    expect(dealt.status).toBe(200)
    const body = await json<{ seq: number; view: { stage: string } }>(dealt)
    expect(body.view.stage).toBe('playing')
    expect(body.seq).toBeGreaterThan(0)
  })
})
