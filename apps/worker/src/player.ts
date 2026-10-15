import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
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

function setPlayerCookie(c: Context<AppEnv>, playerId: string) {
  setCookie(c, PLAYER_COOKIE, playerId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: ONE_YEAR,
    secure: new URL(c.req.url).protocol === 'https:',
  })
}

/**
 * Resolves the anonymous player from the httpOnly cookie.
 * A missing cookie is created here. A cookie that is already set is trusted for the request:
 * the players row is a primary-key lookup that every action was paying as its own D1 round trip,
 * and a session row for that player can only exist if the player does. Routes that write without
 * loading a session call `ensurePlayer`, which still replaces a cookie that names nobody.
 */
export const withPlayer = createMiddleware<AppEnv>(async (c, next) => {
  const db = openDb(c.env.DB)
  c.set('db', db)
  const cookie = getCookie(c, PLAYER_COOKIE)
  if (!cookie) {
    const playerId = await createPlayer(db, Date.now())
    setPlayerCookie(c, playerId)
    c.set('playerId', playerId)
    c.set('playerVerified', true)
  } else {
    c.set('playerId', cookie)
    c.set('playerVerified', false)
  }
  await next()
})

/** Makes the cookie name a real player, creating one when it doesn't. No-op when this request already did. */
export async function ensurePlayer(c: Context<AppEnv>): Promise<void> {
  if (c.var.playerVerified) return
  const found = await c.var.db
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(eq(schema.players.id, c.var.playerId))
    .get()
  if (found) {
    c.set('playerVerified', true)
    return
  }
  const playerId = await createPlayer(c.var.db, Date.now())
  setPlayerCookie(c, playerId)
  c.set('playerId', playerId)
  c.set('playerVerified', true)
}
