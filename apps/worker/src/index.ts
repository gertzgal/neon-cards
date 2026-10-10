import { Hono } from 'hono'
import type { AppEnv } from './env'
import { withPlayer } from './player'
import { readWallet } from './wallet'

export type { Env } from './env'

export type Health = { ok: true; db: { schema: string } } | { ok: false; error: string }

const app = new Hono<AppEnv>().basePath('/api')

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

export default app
