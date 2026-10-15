import type { Rng } from '@neon-cards/engine'
import type { EkAction, EkPolicy, EkView } from '../types'
import { first, giveChoice } from './count'

/**
 * `rng.int(EASY_DRAW_WEIGHT) === 0` draws before looking at the rest of the menu.
 * 2 is one half. The weight, and the Attack ban while a turn is already owed, keep Easy from stalling.
 */
export const EASY_DRAW_WEIGHT = 2

function easyTurn(view: EkView, legal: readonly EkAction[], rng: Rng): EkAction {
  const draw = legal.find((action) => action.type === 'draw')
  if (rng.int(EASY_DRAW_WEIGHT) === 0 && draw) return draw
  const filtered = legal.filter((action) => {
    if (action.type === 'favor' || action.type === 'five' || action.type === 'three') return false
    if (action.type === 'play' && action.title === 'attack' && view.owed !== 0) return false
    return true
  })
  const types: EkAction['type'][] = []
  for (const action of filtered) if (!types.includes(action.type)) types.push(action.type)
  if (types.length === 0) return draw ?? first(legal)
  const type = types[rng.int(types.length)]
  const ofType = filtered.filter((action) => action.type === type)
  if (ofType.length === 0) return draw ?? first(legal)
  return ofType[rng.int(ofType.length)] ?? draw ?? first(legal)
}

export const easy: EkPolicy = {
  choose(view, legal, rng) {
    const pending = view.pending
    if (pending?.kind === 'give') return giveChoice(view, legal)
    if (pending?.kind === 'defuse') return legal[rng.int(legal.length)] ?? first(legal)
    if (pending?.kind === 'nope') {
      const nope = legal.find((action) => action.type === 'nope')
      if (rng.int(4) === 0 && nope) return nope
      return legal.find((action) => action.type === 'pass') ?? first(legal)
    }
    return easyTurn(view, legal, rng)
  },
}
