import type { GameRules } from '@neon-cards/engine'
import { Hono } from 'hono'
import type { AppEnv } from './env'
import { withPlayer } from './player'
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

  app.get('/wallet', withPlayer, async (c) => c.json(await readWallet(c.var.db, c.var.playerId)))

  app.post('/sessions', withPlayer, async (c) => {
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

  app.get('/sessions/:id', withPlayer, async (c) =>
    c.json(await getSession(c.var.db, regFor(c.env), c.var.playerId, c.req.param('id'))),
  )

  app.post('/sessions/:id/actions', withPlayer, async (c) => {
    const body = await jsonBody(c.req.raw)
    if (!Number.isInteger(body.seq) || (body.seq as number) < 0) throw new ApiError(400, 'seq must be a whole number')
    if (body.action === undefined) throw new ApiError(400, 'action is required')
    return c.json(
      await postAction(c.var.db, regFor(c.env), c.var.playerId, c.req.param('id'), { action: body.action, seq: body.seq as number }),
    )
  })

  app.get('/history', withPlayer, async (c) =>
    c.json({ rounds: await history(c.var.db, c.var.playerId, c.req.query('gameId') || undefined) }),
  )

  return app
}
