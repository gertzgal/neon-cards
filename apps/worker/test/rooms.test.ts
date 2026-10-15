import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { client, json, testApp } from './client'

interface Created {
  code: string
  frame: RoomFrame
}

interface RoomFrame {
  type: string
  host?: boolean
  you?: string | null
  seats?: { id: string; name: string }[]
  eyes?: number
  canOpen?: boolean
  canAct?: boolean
  snap?: boolean
  seq?: number
  deadline?: number | null
  reason?: string
  view?: { me?: string; pending?: { kind?: string; seat?: string } | null }
}

function nextFrame(ws: WebSocket): Promise<RoomFrame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for a room frame')), 3000)
    ws.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer)
        resolve(JSON.parse(String(event.data)) as RoomFrame)
      },
      { once: true },
    )
  })
}

async function connect(cookie: string, code: string): Promise<WebSocket> {
  const res = await testApp.fetch(new Request(`http://neon.test/api/rooms/${code}`, { headers: { Upgrade: 'websocket', cookie } }), env)
  expect(res.status).toBe(101)
  const ws = res.webSocket
  if (!ws) throw new Error('upgrade did not return a socket')
  ws.accept()
  return ws
}

async function dealtHost(): Promise<{ cookie: string; code: string; socket: WebSocket; seq: number }> {
  const host = client()
  const created = await host.post('/api/rooms', { gameId: 'flip7' })
  const body = await json<Created>(created)
  const socket = await connect(`nc_player=${host.playerId()}`, body.code)
  await nextFrame(socket)
  const set = nextFrame(socket)
  socket.send(JSON.stringify({ type: 'settings', commandId: 'set1', config: { rig: 'bust', difficulty: 'easy' } }))
  await set
  const dealt = nextFrame(socket)
  socket.send(JSON.stringify({ type: 'deal', commandId: 'd1' }))
  const frame = await dealt
  return { cookie: `nc_player=${host.playerId()}`, code: body.code, socket, seq: frame.seq ?? 0 }
}

function stubFor(code: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(code))
}

async function rewriteDeadlines(code: string, deadlines: { turn: boolean; grace: boolean }): Promise<void> {
  await runInDurableObject(stubFor(code), (_instance: unknown, state) => {
    const rows = state.storage.sql.exec<{ body: string }>('SELECT body FROM room WHERE id = 1').toArray()
    const body = rows[0]?.body
    if (!body) throw new Error('missing room')
    const room = JSON.parse(body) as { deadlines: { turn: { seatId: string; dueAt: number } | null; hostGrace: { dueAt: number } | null } }
    if (deadlines.turn && room.deadlines.turn) room.deadlines.turn.dueAt = 1
    if (deadlines.grace) room.deadlines.hostGrace = { dueAt: 1 }
    state.storage.sql.exec('INSERT OR REPLACE INTO room (id, body) VALUES (1, ?)', JSON.stringify(room))
  })
}

describe('room lobby', () => {
  it('seats two players, deals a rigged hand, and retries a command without dealing twice', async () => {
    const host = client()
    const created = await host.post('/api/rooms', { gameId: 'flip7' })
    expect(created.status).toBe(201)
    const body = await json<Created>(created)
    expect(body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    expect(body.frame).toMatchObject({ type: 'lobby', host: true, you: 's0', eyes: 0, canOpen: true })

    const hostSocket = await connect(`nc_player=${host.playerId()}`, body.code)
    const hostFrame = await nextFrame(hostSocket)
    expect(hostFrame.seats?.map((seat) => seat.id)).toEqual(['s0'])

    const guest = client()
    await guest.post('/api/sessions', { gameId: 'blackjack', config: {} })
    const guestJoined = nextFrame(hostSocket)
    const guestSocket = await connect(`nc_player=${guest.playerId()}`, body.code)
    const guestFrame = await nextFrame(guestSocket)
    expect(guestFrame).toMatchObject({ type: 'lobby', host: false, you: 's1', canOpen: false, eyes: 0 })
    expect((await guestJoined).seats?.map((seat) => seat.id)).toEqual(['s0', 's1'])

    const hostSet = nextFrame(hostSocket)
    const guestSet = nextFrame(guestSocket)
    hostSocket.send(JSON.stringify({ type: 'settings', commandId: 'set1', config: { rig: 'bust', difficulty: 'easy' } }))
    expect(await hostSet).toMatchObject({ type: 'lobby', canOpen: true })
    expect(await guestSet).toMatchObject({ type: 'lobby', host: false })

    const hostDeal = nextFrame(hostSocket)
    const guestDeal = nextFrame(guestSocket)
    hostSocket.send(JSON.stringify({ type: 'deal', commandId: 'd1' }))
    const hostLive = await hostDeal
    const guestLive = await guestDeal
    expect(hostLive).toMatchObject({ type: 'live', you: 's0', canAct: true, canOpen: false, snap: false, host: true })
    expect(guestLive).toMatchObject({ type: 'live', you: 's1', canAct: false, canOpen: false, host: false })
    expect(hostLive.view).toMatchObject({ me: 's0', pending: { kind: 'hitOrStay', seat: 's0' } })
    expect(guestLive.view).toMatchObject({ me: 's1' })
    expect(JSON.stringify(hostLive)).not.toContain('"draw":[')
    expect(JSON.stringify(guestLive)).not.toContain('"rng"')
    const dealtSeq = hostLive.seq ?? 0
    expect(dealtSeq).toBeGreaterThan(0)
    expect(hostLive.deadline).toBeGreaterThan(Date.now())
    expect(guestLive.seq).toBe(dealtSeq)

    const replay = nextFrame(hostSocket)
    hostSocket.send(JSON.stringify({ type: 'deal', commandId: 'd1' }))
    expect((await replay).seq).toBe(dealtSeq)

    const guestDealRejected = nextFrame(guestSocket)
    guestSocket.send(JSON.stringify({ type: 'deal', commandId: 'guest-deal' }))
    expect(await guestDealRejected).toMatchObject({ type: 'rejected', reason: 'not-host' })

    const early = nextFrame(guestSocket)
    guestSocket.send(JSON.stringify({ type: 'act', commandId: 'early', seq: dealtSeq, action: { type: 'hit' } }))
    expect(await early).toMatchObject({ type: 'rejected', reason: 'not-your-turn' })

    const hostAct = nextFrame(hostSocket)
    const guestAct = nextFrame(guestSocket)
    hostSocket.send(JSON.stringify({ type: 'act', commandId: 'a1', seq: dealtSeq, action: { type: 'hit' } }))
    const acted = await hostAct
    const guestSaw = await guestAct
    expect(acted.seq).toBeGreaterThan(dealtSeq)
    expect(guestSaw.seq).toBe(acted.seq)
    expect(guestSaw.view).toMatchObject({ me: 's1' })

    const actReplay = nextFrame(hostSocket)
    hostSocket.send(JSON.stringify({ type: 'act', commandId: 'a1', seq: dealtSeq, action: { type: 'hit' } }))
    expect((await actReplay).seq).toBe(acted.seq)

    const ahead = nextFrame(guestSocket)
    guestSocket.send(JSON.stringify({ type: 'act', commandId: 'a2', seq: (acted.seq ?? 0) + 5, action: { type: 'stay' } }))
    expect(await ahead).toMatchObject({ type: 'rejected', reason: 'seq' })

    const hostSawStay = nextFrame(hostSocket)
    const guestStay = nextFrame(guestSocket)
    guestSocket.send(JSON.stringify({ type: 'act', commandId: 'a2', seq: acted.seq, action: { type: 'stay' } }))
    expect((await guestStay).type).toBe('live')
    expect((await hostSawStay).seq).toBe((await guestStay).seq)

    const hostSawDrop = nextFrame(hostSocket)
    guestSocket.close()
    expect((await hostSawDrop).type).toBe('live')
    const hostSawJoin = nextFrame(hostSocket)
    const rejoined = await connect(`nc_player=${guest.playerId()}`, body.code)
    const snap = await nextFrame(rejoined)
    expect(snap).toMatchObject({ type: 'live', you: 's1', snap: true })
    expect(snap.view).toMatchObject({ me: 's1' })
    expect((await hostSawJoin).type).toBe('live')

    const closed = nextFrame(hostSocket)
    hostSocket.send(JSON.stringify({ type: 'leave', commandId: 'leave-host' }))
    expect(await closed).toMatchObject({ type: 'closed' })
    const again = await testApp.fetch(
      new Request(`http://neon.test/api/rooms/${body.code}`, {
        headers: { Upgrade: 'websocket', cookie: `nc_player=${guest.playerId()}` },
      }),
      env,
    )
    expect(again.status).toBe(404)

    rejoined.close()
    hostSocket.close()
  })

  it('a due host grace closes the room and does not play the due turn', async () => {
    const dealt = await dealtHost()
    const seq = dealt.seq
    await rewriteDeadlines(dealt.code, { turn: true, grace: true })
    const closed = nextFrame(dealt.socket)
    expect(await runDurableObjectAlarm(stubFor(dealt.code))).toBe(true)
    expect(await closed).toMatchObject({ type: 'closed' })
    const again = await testApp.fetch(
      new Request(`http://neon.test/api/rooms/${dealt.code}`, { headers: { Upgrade: 'websocket', cookie: dealt.cookie } }),
      env,
    )
    expect(again.status).toBe(404)
    const stored = await runInDurableObject(stubFor(dealt.code), (_instance: unknown, state) => {
      return state.storage.sql.exec('SELECT body FROM room WHERE id = 1').toArray().length
    })
    expect(stored).toBe(0)
    expect(seq).toBeGreaterThan(0)
    dealt.socket.close()
  })

  it('the first missed turn plays for the human and leaves them seated', async () => {
    const dealt = await dealtHost()
    await rewriteDeadlines(dealt.code, { turn: true, grace: false })
    const played = nextFrame(dealt.socket)
    expect(await runDurableObjectAlarm(stubFor(dealt.code))).toBe(true)
    const frame = await played
    expect(frame.type).toBe('live')
    expect(frame.seq).toBeGreaterThan(dealt.seq)
    expect(frame.you).toBe('s0')
    const chair = await runInDurableObject(stubFor(dealt.code), (_instance: unknown, state) => {
      const rows = state.storage.sql.exec<{ body: string }>('SELECT body FROM room WHERE id = 1').toArray()
      const room = JSON.parse(rows[0]?.body ?? '{}') as { chairs: { seatId: string; kind: string; misses?: number }[] }
      return room.chairs.find((item) => item.seatId === 's0')
    })
    expect(chair).toMatchObject({ kind: 'human', misses: 1 })
    dealt.socket.close()
  })

  it('a watcher counts as an eye, holds a CPU seat, and rematch rotates the host', async () => {
    const dealt = await dealtHost()
    const watcher = client()
    await watcher.post('/api/sessions', { gameId: 'blackjack', config: {} })
    const hostSawJoin = nextFrame(dealt.socket)
    const watcherSocket = await connect(`nc_player=${watcher.playerId()}`, dealt.code)
    const watcherFrame = await nextFrame(watcherSocket)
    expect(watcherFrame).toMatchObject({ type: 'live', you: null, eyes: 1, canAct: false })
    expect(await hostSawJoin).toMatchObject({ eyes: 1 })

    const hostSawSit = nextFrame(dealt.socket)
    const watcherSawSit = nextFrame(watcherSocket)
    watcherSocket.send(JSON.stringify({ type: 'sit', commandId: 'sit-1', seatId: 's1' }))
    expect(await watcherSawSit).toMatchObject({ you: null, eyes: 1 })
    await hostSawSit
    const held = await runInDurableObject(stubFor(dealt.code), (_instance: unknown, state) => {
      const rows = state.storage.sql.exec<{ body: string }>('SELECT body FROM room WHERE id = 1').toArray()
      return JSON.parse(rows[0]?.body ?? '{}') as { holds: { seatId: string }[]; chairs: { seatId: string; kind: string }[] }
    })
    expect(held.holds.map((hold) => hold.seatId)).toEqual(['s1'])
    expect(held.chairs.find((chair) => chair.seatId === 's1')?.kind).toBe('cpu')

    await runInDurableObject(stubFor(dealt.code), (_instance: unknown, state) => {
      const rows = state.storage.sql.exec<{ body: string }>('SELECT body FROM room WHERE id = 1').toArray()
      const room = JSON.parse(rows[0]?.body ?? '{}') as { phase: string }
      room.phase = 'over'
      state.storage.sql.exec('INSERT OR REPLACE INTO room (id, body) VALUES (1, ?)', JSON.stringify(room))
    })
    const hostNext = nextFrame(dealt.socket)
    const watcherNext = nextFrame(watcherSocket)
    dealt.socket.send(JSON.stringify({ type: 'rematch', commandId: 'again' }))
    const hostAfter = await hostNext
    const watcherAfter = await watcherNext
    expect(hostAfter).toMatchObject({ type: 'live', you: 's3', eyes: 0, canOpen: true, seq: 0 })
    expect(watcherAfter).toMatchObject({ type: 'live', you: 's0', eyes: 0, canOpen: false })
    dealt.socket.close()
    watcherSocket.close()
  })

  it('answers 404 for a bad code and 400 for a game with no rooms', async () => {
    const p = client()
    await p.post('/api/sessions', { gameId: 'flip7', config: { opponents: 1 } })
    expect((await p.get('/api/rooms/IIII')).status).toBe(400)
    const missing = await testApp.fetch(
      new Request('http://neon.test/api/rooms/ZZZZ', {
        headers: { Upgrade: 'websocket', cookie: `nc_player=${p.playerId()}` },
      }),
      env,
    )
    expect(missing.status).toBe(404)
    expect((await p.post('/api/rooms', { gameId: 'blackjack' })).status).toBe(400)
  })
})
