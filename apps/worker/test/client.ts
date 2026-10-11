import { highCard } from '@neon-cards/engine/testing'
import { env } from 'cloudflare:workers'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { games } from '../src/games'

/** The production registry plus the engine's test-only multi-seat game. */
export const testApp = createApp([...games, highCard])

/** A fake browser: one anonymous player, carrying the identity cookie across requests. */
export function client(overrides: Partial<Env> = {}) {
  let cookie: string | undefined
  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {}
    if (cookie) headers.cookie = cookie
    if (body !== undefined) headers['content-type'] = 'application/json'
    const req = new Request(`http://neon.test${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const res = await testApp.fetch(req, { ...env, ...overrides })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    return res
  }
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown) => call('POST', path, body),
    playerId: () => {
      const id = cookie?.split('=')[1]
      if (!id) throw new Error('no player cookie yet')
      return id
    },
  }
}

export async function json<T = Record<string, unknown>>(res: Response | Promise<Response>): Promise<T> {
  return (await (await res).json()) as T
}
