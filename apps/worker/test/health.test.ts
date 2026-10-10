import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('GET /api/health', () => {
  it('reads the schema row written by the migrations', async () => {
    const res = await exports.default.fetch('http://neon.test/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, db: { schema: 'foundation' } })
  })

  it('returns 404 for unknown API routes', async () => {
    const res = await exports.default.fetch('http://neon.test/api/nope')
    expect(res.status).toBe(404)
  })
})
