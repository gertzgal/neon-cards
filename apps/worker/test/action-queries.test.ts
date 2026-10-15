import type { BlackjackView } from '@neon-cards/game-blackjack/rules'
import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { client, json } from './client'

/**
 * Counts D1 round trips for one request. Each prepare().run/all/raw/first is one trip.
 * `db.batch` is one trip however many statements it carries.
 */
function instrument(db: D1Database) {
  const sqls: string[] = []
  const rawOf = new WeakMap<object, D1PreparedStatement>()
  const note = (sql: string) => {
    sqls.push(sql.replace(/\s+/g, ' ').trim())
  }
  const wrap = (stmt: D1PreparedStatement, text: string): D1PreparedStatement => {
    const wrapped = {
      bind(...values: unknown[]) {
        return wrap(stmt.bind(...values), text)
      },
      raw() {
        note(text)
        return stmt.raw()
      },
      all() {
        note(text)
        return stmt.all()
      },
      run() {
        note(text)
        return stmt.run()
      },
      first<T = unknown>(colName?: string) {
        note(text)
        return colName === undefined ? stmt.first<T>() : stmt.first<T>(colName)
      },
    }
    rawOf.set(wrapped, stmt)
    return wrapped as D1PreparedStatement
  }
  const wrapped: D1Database = {
    prepare(sql: string) {
      return wrap(db.prepare(sql), sql)
    },
    batch<T = unknown>(statements: D1PreparedStatement[]) {
      note(`batch(${statements.length})`)
      return db.batch<T>(statements.map((stmt) => rawOf.get(stmt) ?? stmt))
    },
    exec(sql: string) {
      note(sql)
      return db.exec(sql)
    },
    dump: () => db.dump(),
    withSession(constraint) {
      return db.withSession(constraint)
    },
  }
  return {
    db: wrapped,
    take: () => sqls.splice(0),
  }
}

interface Acted {
  view: BlackjackView
  seq: number
  wallet?: number
}

/** A play action is one read (session, wallet, round count) and one write batch. Nothing else. */
function expectActionQueries(sqls: string[], batch: string) {
  expect(sqls, sqls.join('\n')).toHaveLength(2)
  expect(sqls.some((sql) => sql.includes('players'))).toBe(false)
  expect(sqls[0]).toMatch(/wallets/i)
  expect(sqls[0]).toMatch(/rounds/i)
  expect(sqls[1]).toBe(batch)
}

async function sit(p: ReturnType<typeof client>, rig: string) {
  const res = await p.post('/api/sessions', { gameId: 'blackjack', config: { rig } })
  expect(res.status).toBe(201)
  return json<{ sessionId: string; seq: number; view: BlackjackView }>(res)
}

async function bet(p: ReturnType<typeof client>, sessionId: string, seq: number, amount: number) {
  const res = await p.post(`/api/sessions/${sessionId}/actions`, { action: { type: 'bet', amount }, seq })
  expect(res.status).toBe(200)
  return json<Acted>(res)
}

describe('D1 round trips per blackjack action', () => {
  it('hits, stands, doubles, and splits in two round trips', async () => {
    const probe = instrument(env.DB)
    const p = client({ DB: probe.db })
    await p.get('/api/wallet')

    const hitSeat = await sit(p, '8H,9C,5S,7D,2C')
    const dealt = await bet(p, hitSeat.sessionId, hitSeat.seq, 25)
    probe.take()
    const hitRes = await p.post(`/api/sessions/${hitSeat.sessionId}/actions`, { action: { type: 'hit' }, seq: dealt.seq })
    const hitSql = probe.take()
    const hit = await json<Acted>(hitRes)
    expect(hitRes.status).toBe(200)
    expect(hit.view.phase).toBe('playing')
    expect(hit.view.hands[0]?.cards).toHaveLength(3)
    expectActionQueries(hitSql, 'batch(2)')

    const stood = await p.post(`/api/sessions/${hitSeat.sessionId}/actions`, { action: { type: 'stand' }, seq: hit.seq })
    const standSql = probe.take()
    const stand = await json<Acted>(stood)
    expect(stand.view.phase).toBe('settling')
    expect(typeof stand.wallet).toBe('number')
    expectActionQueries(standSql, 'batch(5)')

    // The round count comes back in the same read. A second settled round must be round 2, not a colliding 1.
    const again = await bet(p, hitSeat.sessionId, stand.seq, 25)
    expect(again.view.phase).toBe('playing')
    const againStood = await p.post(`/api/sessions/${hitSeat.sessionId}/actions`, {
      action: { type: 'stand' },
      seq: again.seq,
    })
    expect(againStood.status).toBe(200)
    const { rounds } = await json<{ rounds: { roundNo: number }[] }>(p.get('/api/history?gameId=blackjack'))
    expect(rounds.map((r) => r.roundNo)).toEqual([2, 1])

    const doubleSeat = await sit(p, 'double')
    const doubleDealt = await bet(p, doubleSeat.sessionId, 0, 50)
    probe.take()
    const doubleRes = await p.post(`/api/sessions/${doubleSeat.sessionId}/actions`, {
      action: { type: 'double' },
      seq: doubleDealt.seq,
    })
    const doubleSql = probe.take()
    expect((await json<Acted>(doubleRes)).view.phase).toBe('settling')
    expectActionQueries(doubleSql, 'batch(5)')

    const splitSeat = await sit(p, 'split')
    const splitDealt = await bet(p, splitSeat.sessionId, 0, 50)
    probe.take()
    const splitRes = await p.post(`/api/sessions/${splitSeat.sessionId}/actions`, {
      action: { type: 'split' },
      seq: splitDealt.seq,
    })
    const splitSql = probe.take()
    expect((await json<Acted>(splitRes)).view.hands).toHaveLength(2)
    expectActionQueries(splitSql, 'batch(2)')
  })

  it('rejects an illegal action after the read, and replays a seq without writing', async () => {
    const probe = instrument(env.DB)
    const p = client({ DB: probe.db })
    const seat = await sit(p, 'win')
    probe.take()
    const bad = await p.post(`/api/sessions/${seat.sessionId}/actions`, { action: { type: 'bet', amount: 7 }, seq: 0 })
    const badSql = probe.take()
    expect(bad.status).toBe(400)
    expect(badSql).toHaveLength(1)
    expect(badSql[0]).toMatch(/sessions/i)

    const dealt = await bet(p, seat.sessionId, 0, 25)
    const first = await p.post(`/api/sessions/${seat.sessionId}/actions`, { action: { type: 'stand' }, seq: dealt.seq })
    const body = await first.text()
    probe.take()
    const retry = await p.post(`/api/sessions/${seat.sessionId}/actions`, { action: { type: 'hit' }, seq: dealt.seq })
    const retrySql = probe.take()
    expect(retry.status).toBe(200)
    expect(await retry.text()).toBe(body)
    expect(retrySql).toHaveLength(2)
    expect(retrySql.some((sql) => sql.startsWith('batch'))).toBe(false)

    probe.take()
    const resumed = await p.get(`/api/sessions/${seat.sessionId}`)
    expect(resumed.status).toBe(200)
    expect(probe.take()).toHaveLength(1)
  })

  it('replaces a stale player cookie when the session is not theirs', async () => {
    const res = await exports.default.fetch('http://neon.test/api/sessions/missing/actions', {
      method: 'POST',
      headers: { cookie: 'nc_player=nobody', 'content-type': 'application/json' },
      body: JSON.stringify({ action: { type: 'hit' }, seq: 0 }),
    })
    expect(res.status).toBe(404)
    expect(res.headers.get('set-cookie')).toMatch(/^nc_player=[0-9a-f-]{36};/)
  })
})
