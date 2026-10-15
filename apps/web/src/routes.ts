export type Route =
  | { name: 'home' }
  | { name: 'game'; gameId: string }
  | { name: 'history'; gameId: string | null }
  | { name: 'room'; code: string }
  | { name: 'notFound'; path: string }

/** Room codes omit I, O, 0, and 1 so a code read aloud is hard to miss. */
const ROOM_CODE = /^\/r\/([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4})$/

export function parseRoute(pathname: string, search: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'home' }
  if (path === '/history') return { name: 'history', gameId: new URLSearchParams(search).get('game') }
  const game = /^\/games\/([a-z0-9-]+)$/.exec(path)
  if (game?.[1]) return { name: 'game', gameId: game[1] }
  const room = ROOM_CODE.exec(path)
  if (room?.[1]) return { name: 'room', code: room[1] }
  return { name: 'notFound', path }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/'
    case 'game':
      return `/games/${route.gameId}`
    case 'history':
      return route.gameId ? `/history?game=${encodeURIComponent(route.gameId)}` : '/history'
    case 'room':
      return `/r/${route.code}`
    case 'notFound':
      return route.path
  }
}
