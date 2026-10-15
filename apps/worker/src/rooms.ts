import { mintCode, noteFailedJoin, parseCode, randomNickname } from '@neon-cards/room'
import { eq } from 'drizzle-orm'
import { schema, type Db } from './db'

const failures = new Map<string, number[]>()

function byte(): number {
  const buf = new Uint8Array(1)
  crypto.getRandomValues(buf)
  return buf[0] ?? 0
}

export async function nicknameFor(db: Db, playerId: string): Promise<string> {
  const row = await db
    .select({ nickname: schema.players.nickname, locked: schema.players.nicknameLocked })
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
    .get()
  if (row?.nickname) return row.nickname
  const nickname = randomNickname(byte)
  await db.update(schema.players).set({ nickname, nicknameLocked: 1 }).where(eq(schema.players.id, playerId))
  return nickname
}

export async function mintUnique(db: Db): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = mintCode(byte)
    const existing = await db
      .select({ code: schema.roomDirectory.code })
      .from(schema.roomDirectory)
      .where(eq(schema.roomDirectory.code, code))
      .get()
    if (!existing) return code
  }
  throw new Error('could not mint a room code')
}

/** False when this player is over the failed-join limit. */
export function allowFailedJoin(playerId: string, now = Date.now()): boolean {
  const next = noteFailedJoin(failures.get(playerId) ?? [], now)
  failures.set(playerId, next.stamps)
  return !next.limited
}

export { parseCode }
