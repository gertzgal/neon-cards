import { eq } from 'drizzle-orm'
import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { openDb, schema, type Db } from './db'
import type { AppEnv } from './env'
import { STARTING_BANKROLL } from './wallet'

export const PLAYER_COOKIE = 'nc_player'
const ONE_YEAR = 60 * 60 * 24 * 365

async function createPlayer(db: Db, now: number): Promise<string> {
  const id = crypto.randomUUID()
  await db.batch([
    db.insert(schema.players).values({ id, createdAt: now }),
    db.insert(schema.wallets).values({ playerId: id, balance: STARTING_BANKROLL, updatedAt: now }),
    db
      .insert(schema.walletLedger)
      .values({ playerId: id, delta: STARTING_BANKROLL, reason: 'start', ref: null, createdAt: now }),
  ])
  return id
}

/** Resolves the anonymous player from the httpOnly cookie, creating one (with a wallet) when missing or unknown. */
export const withPlayer = createMiddleware<AppEnv>(async (c, next) => {
  const db = openDb(c.env.DB)
  c.set('db', db)
  const cookie = getCookie(c, PLAYER_COOKIE)
  let playerId = cookie
  if (playerId) {
    const found = await db.select({ id: schema.players.id }).from(schema.players).where(eq(schema.players.id, playerId)).get()
    if (!found) playerId = undefined
  }
  if (!playerId) playerId = await createPlayer(db, Date.now())
  if (playerId !== cookie) {
    setCookie(c, PLAYER_COOKIE, playerId, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: ONE_YEAR,
      secure: new URL(c.req.url).protocol === 'https:',
    })
  }
  c.set('playerId', playerId)
  await next()
})
