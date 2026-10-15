import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('room directory', () => {
  it('stores a code for a host, and a new player has no nickname', async () => {
    const id = crypto.randomUUID()
    const now = Date.now()
    await env.DB.prepare('INSERT INTO players (id, created_at) VALUES (?, ?)').bind(id, now).run()
    await env.DB.prepare(
      'INSERT INTO room_directory (code, game_id, host_player_id, created_at) VALUES (?, ?, ?, ?)',
    )
      .bind('ABCD', 'flip7', id, now)
      .run()
    const row = await env.DB.prepare(
      'SELECT code, game_id, host_player_id, closed_at FROM room_directory WHERE code = ?',
    )
      .bind('ABCD')
      .first<{ code: string; game_id: string; host_player_id: string; closed_at: number | null }>()
    expect(row).toEqual({ code: 'ABCD', game_id: 'flip7', host_player_id: id, closed_at: null })
    const player = await env.DB.prepare('SELECT nickname, nickname_locked FROM players WHERE id = ?')
      .bind(id)
      .first<{ nickname: string | null; nickname_locked: number }>()
    expect(player).toEqual({ nickname: null, nickname_locked: 0 })
  })

  it('rejects a nickname lock that is not 0 or 1', async () => {
    const id = crypto.randomUUID()
    await expect(
      env.DB.prepare('INSERT INTO players (id, created_at, nickname_locked) VALUES (?, ?, ?)').bind(id, Date.now(), 2).run(),
    ).rejects.toThrow()
  })
})
