import { exports } from 'cloudflare:workers'

/** A fake browser: one anonymous player, carrying the identity cookie across requests. */
export function client() {
  let cookie: string | undefined
  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {}
    if (cookie) headers.cookie = cookie
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await exports.default.fetch(`http://neon.test${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
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
    cookie: () => cookie,
  }
}
