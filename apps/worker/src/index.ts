import { Hono } from 'hono'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

export type Health = { ok: true; db: { schema: string } } | { ok: false; error: string }

const app = new Hono<{ Bindings: Env }>().basePath('/api')

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

export default app
