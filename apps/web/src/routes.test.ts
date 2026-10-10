import { describe, expect, it } from 'vitest'
import { hrefFor, parseRoute } from './routes'

describe('parseRoute', () => {
  it('maps every shell path to its route', () => {
    expect(parseRoute('/', '')).toEqual({ name: 'home' })
    expect(parseRoute('/games/blackjack', '')).toEqual({ name: 'game', gameId: 'blackjack' })
    expect(parseRoute('/games/flip7/', '')).toEqual({ name: 'game', gameId: 'flip7' })
    expect(parseRoute('/history', '')).toEqual({ name: 'history', gameId: null })
    expect(parseRoute('/history', '?game=blackjack')).toEqual({ name: 'history', gameId: 'blackjack' })
    expect(parseRoute('/games/Bad_Id', '')).toEqual({ name: 'notFound', path: '/games/Bad_Id' })
    expect(parseRoute('/nope', '')).toEqual({ name: 'notFound', path: '/nope' })
  })
})

describe('hrefFor', () => {
  it('round-trips through parseRoute', () => {
    expect(hrefFor({ name: 'home' })).toBe('/')
    expect(hrefFor({ name: 'game', gameId: 'blackjack' })).toBe('/games/blackjack')
    expect(hrefFor({ name: 'history', gameId: null })).toBe('/history')
    expect(hrefFor({ name: 'history', gameId: 'flip7' })).toBe('/history?game=flip7')
    const [path, search] = hrefFor({ name: 'history', gameId: 'flip7' }).split('?')
    expect(parseRoute(path ?? '', `?${search}`)).toEqual({ name: 'history', gameId: 'flip7' })
  })
})
