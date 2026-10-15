import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { client, json, testApp } from './client'

interface Created {
  code: string
  frame: { type: string; host: boolean; you: string | null; seats: { id: string; name: string }[]; eyes: number; canOpen: boolean }
}

function nextFrame(ws: WebSocket): Promise<Created['frame'] & { reason?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for a room frame')), 3000)
    ws.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer)
        resolve(JSON.parse(String(event.data)) as Created['frame'])
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
  it('seats two players over hibernating sockets and does not deal', async () => {
    const host = client()
    const created = await host.post('/api/rooms', { gameId: 'flip7' })
    expect(created.status).toBe(201)
    const body = await json<Created>(created)
    expect(body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)
    expect(body.frame).toMatchObject({ type: 'lobby', host: true, you: 's0', eyes: 0, canOpen: true })

    const hostSocket = await connect(`nc_player=${host.playerId()}`, body.code)
    const hostFrame = await nextFrame(hostSocket)
    expect(hostFrame.seats.map((seat) => seat.id)).toEqual(['s0'])

    const guest = client()
    await guest.post('/api/sessions', { gameId: 'blackjack', config: {} })
    const guestJoined = nextFrame(hostSocket)
    const guestSocket = await connect(`nc_player=${guest.playerId()}`, body.code)
    const guestFrame = await nextFrame(guestSocket)
    expect(guestFrame).toMatchObject({ type: 'lobby', host: false, you: 's1', canOpen: false, eyes: 0 })
    expect((await guestJoined).seats.map((seat) => seat.id)).toEqual(['s0', 's1'])

    const rejected = nextFrame(hostSocket)
    hostSocket.send(JSON.stringify({ type: 'deal', commandId: 'd1' }))
    expect(await rejected).toMatchObject({ type: 'rejected', reason: 'illegal' })

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

    guestSocket.close()
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
