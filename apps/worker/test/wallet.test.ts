import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { client } from './client'

const ledger = (playerId: string) =>
  env.DB.prepare('SELECT delta, reason FROM wallet_ledger WHERE player_id = ? ORDER BY id')
    .bind(playerId)
    .all<{ delta: number; reason: string }>()
    .then((r) => r.results)

describe('anonymous player identity', () => {
  it('issues an httpOnly player cookie on first contact and keeps it after', async () => {
    const p = client()
    const first = await p.get('/api/wallet')
    const set = first.headers.get('set-cookie')
    expect(set).toMatch(/^nc_player=[0-9a-f-]{36}; Max-Age=31536000; Path=\/; HttpOnly; SameSite=Lax$/)
    const second = await p.get('/api/wallet')
    expect(second.headers.get('set-cookie')).toBeNull()
  })

  it('replaces a cookie that names no known player', async () => {
    const forged = await exports.default.fetch('http://neon.test/api/wallet', {
      headers: { cookie: 'nc_player=nobody' },
    })
    expect(forged.status).toBe(200)
    expect(forged.headers.get('set-cookie')).toMatch(/^nc_player=[0-9a-f-]{36};/)
  })
})

describe('GET /api/wallet', () => {
  it('starts a new player at the 1,250 bankroll and records it', async () => {
    const p = client()
    const res = await p.get('/api/wallet')
    expect(await res.json()).toEqual({ balance: 1250 })
    expect(await ledger(p.playerId())).toEqual([{ delta: 1250, reason: 'start' }])
  })

  it('refills a broke player to 1,250 and records the refill', async () => {
    const p = client()
    await p.get('/api/wallet')
    await env.DB.prepare('UPDATE wallets SET balance = 3 WHERE player_id = ?').bind(p.playerId()).run()
    expect(await (await p.get('/api/wallet')).json()).toEqual({ balance: 1250, refilled: 1247 })
    expect(await (await p.get('/api/wallet')).json()).toEqual({ balance: 1250 })
    expect(await ledger(p.playerId())).toEqual([
      { delta: 1250, reason: 'start' },
      { delta: 1247, reason: 'refill' },
    ])
  })

  it('leaves a balance of 5 alone', async () => {
    const p = client()
    await p.get('/api/wallet')
    await env.DB.prepare('UPDATE wallets SET balance = 5 WHERE player_id = ?').bind(p.playerId()).run()
    expect(await (await p.get('/api/wallet')).json()).toEqual({ balance: 5 })
  })
})
