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
