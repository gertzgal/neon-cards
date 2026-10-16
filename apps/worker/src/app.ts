import type { GameRules } from '@neon-cards/engine'
import { parseCode } from '@neon-cards/room'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { schema } from './db'
import type { AppEnv } from './env'
import { ensurePlayer, withPlayer } from './player'
import { allowFailedJoin, mintUnique, nicknameFor } from './rooms'
import { ApiError, createSession, getSession, history, postAction, registry } from './sessions'
import { readWallet } from './wallet'

export type Health = { ok: true; db: { schema: string } } | { ok: false; error: string }

async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, 'body must be JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ApiError(400, 'body must be a JSON object')
  return body as Record<string, unknown>
}

/**
 * The API over a game registry. Production passes apps/worker/src/games.ts; tests add test-only games.
 * `devGames` join the registry only on requests to a Worker with DEV_RIG=1.
 */
export function createApp(games: readonly GameRules[], devGames: readonly GameRules[] = []) {
  const prodReg = registry(games)
  const devReg = registry([...games, ...devGames])
  const regFor = (env: AppEnv['Bindings']) => (env.DEV_RIG === '1' ? devReg : prodReg)
  const app = new Hono<AppEnv>().basePath('/api')

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'internal error' }, 500)
  })

  app.get('/health', async (c) => {
    try {
      const row = await c.env.DB.prepare("SELECT value FROM meta WHERE key = 'schema'").first<{
        value: string
      }>()
      if (!row) return c.json<Health>({ ok: false, error: 'schema row missing' }, 503)
      return c.json<Health>({ ok: true, db: { schema: row.value } })
    } catch (err) {
      return c.json<Health>({ ok: false, error: String(err) }, 503)
    }
  })

  app.get('/wallet', withPlayer, async (c) => {
    await ensurePlayer(c)
    return c.json(await readWallet(c.var.db, c.var.playerId))
  })

  app.post('/sessions', withPlayer, async (c) => {
    await ensurePlayer(c)
    const body = await jsonBody(c.req.raw)
    if (typeof body.gameId !== 'string') throw new ApiError(400, 'gameId must be a string')
    const config = body.config ?? {}
    const devRig = c.env.DEV_RIG === '1'
    if (!devRig && typeof config === 'object' && config !== null && 'rig' in config) {
      throw new ApiError(400, 'config.rig needs DEV_RIG=1')
    }
    if (body.seed !== undefined && (!devRig || typeof body.seed !== 'string')) {
      throw new ApiError(400, 'seed is a dev-only string (DEV_RIG=1)')
    }
    const created = await createSession(c.var.db, regFor(c.env), c.var.playerId, {
      gameId: body.gameId,
      config,
      seed: body.seed as string | undefined,
    })
    return c.json(created, 201)
  })

  app.get('/sessions/:id', withPlayer, async (c) => {
    try {
      return c.json(await getSession(c.var.db, regFor(c.env), c.var.playerId, c.req.param('id')))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) await ensurePlayer(c)
      throw err
    }
  })

  app.post('/sessions/:id/actions', withPlayer, async (c) => {
    const started = performance.now()
    const body = await jsonBody(c.req.raw)
    if (!Number.isInteger(body.seq) || (body.seq as number) < 0) throw new ApiError(400, 'seq must be a whole number')
    if (body.action === undefined) throw new ApiError(400, 'action is required')
    try {
      const result = await postAction(c.var.db, regFor(c.env), c.var.playerId, c.req.param('id'), {
        action: body.action,
        seq: body.seq as number,
      })
      // Worker time only (D1 included). The client TTFB is this plus the network.
      c.header('Server-Timing', `action;dur=${(performance.now() - started).toFixed(1)}`)
      return c.json(result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) await ensurePlayer(c)
      throw err
    }
  })

  app.get('/history', withPlayer, async (c) => {
    await ensurePlayer(c)
    return c.json({ rounds: await history(c.var.db, c.var.playerId, c.req.query('gameId') || undefined) })
  })

  app.post('/rooms', withPlayer, async (c) => {
    await ensurePlayer(c)
    const body = await jsonBody(c.req.raw)
    if (body.gameId !== 'flip7' && body.gameId !== 'exploding-kittens') throw new ApiError(400, 'that game has no rooms')
    const gameId = body.gameId === 'exploding-kittens' ? 'exploding-kittens' : 'flip7'
    const rules = regFor(c.env).get(gameId)
    if (!rules) throw new ApiError(404, `unknown game "${gameId}"`)
    const nickname = await nicknameFor(c.var.db, c.var.playerId)
    const span = rules.definition.seats
    const requested = body.seats
    const seats =
      requested === undefined ? span.max : typeof requested === 'number' && Number.isInteger(requested) ? requested : NaN
    if (!Number.isInteger(seats) || seats < span.min || seats > span.max) throw new ApiError(400, 'that table size is not in this game')
    const code = await mintUnique(c.var.db)
    await c.var.db.insert(schema.roomDirectory).values({
      code,
      gameId,
      hostPlayerId: c.var.playerId,
      createdAt: Date.now(),
      closedAt: null,
    })
    const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(code))
    const opened = await stub.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify({
        code,
        gameId,
        hostId: c.var.playerId,
        nickname,
        seats,
      }),
    })
    if (!opened.ok) throw new Error('room did not open')
    return c.json({ code, frame: await opened.json() }, 201)
  })

  app.get('/rooms/:code', withPlayer, async (c) => {
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') throw new ApiError(400, 'expected a websocket')
    await ensurePlayer(c)
    const code = parseCode(c.req.param('code'))
    const missing = async () => {
      if (!allowFailedJoin(c.var.playerId)) throw new ApiError(429, 'too many failed joins')
      throw new ApiError(404, 'unknown room')
    }
    if (!code) return missing()
    const row = await c.var.db.select().from(schema.roomDirectory).where(eq(schema.roomDirectory.code, code)).get()
    if (!row || row.closedAt !== null) return missing()
    const nickname = await nicknameFor(c.var.db, c.var.playerId)
    const url = new URL(c.req.url)
    url.searchParams.set('nickname', nickname)
    const headers = new Headers(c.req.raw.headers)
    headers.set('cookie', `nc_player=${c.var.playerId}`)
    const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(code))
    return stub.fetch(new Request(url, { headers }))
  })

  return app
}
