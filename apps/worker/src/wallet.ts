import { eq, sql } from 'drizzle-orm'
import { schema, type Db } from './db'

export const STARTING_BANKROLL = 1250
/** A balance below the smallest chip can't place any bet, so it counts as broke. */
export const BROKE_BELOW = 5

export interface Wallet {
  balance: number
  /** Set when this read refilled a broke wallet. */
  refilled?: number
}

export type LedgerReason = 'start' | 'refill' | 'round'

export async function readBalance(db: Db, playerId: string): Promise<number> {
  const row = await db
    .select({ balance: schema.wallets.balance })
    .from(schema.wallets)
    .where(eq(schema.wallets.playerId, playerId))
    .get()
  if (!row) throw new Error(`wallet missing for player ${playerId}`)
  return row.balance
}

export function walletDelta(db: Db, playerId: string, delta: number, reason: LedgerReason, ref: string | null, now: number) {
  return [
    db
      .update(schema.wallets)
      .set({ balance: sql`${schema.wallets.balance} + ${delta}`, updatedAt: now })
      .where(eq(schema.wallets.playerId, playerId)),
    db.insert(schema.walletLedger).values({ playerId, delta, reason, ref, createdAt: now }),
  ] as const
}

/** Reads the wallet, refilling a broke player to the starting bankroll and recording the refill. */
export async function readWallet(db: Db, playerId: string, now = Date.now()): Promise<Wallet> {
  const balance = await readBalance(db, playerId)
  if (balance >= BROKE_BELOW) return { balance }
  const refilled = STARTING_BANKROLL - balance
  await db.batch(walletDelta(db, playerId, refilled, 'refill', null, now))
  return { balance: STARTING_BANKROLL, refilled }
}
