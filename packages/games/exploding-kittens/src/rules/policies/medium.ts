import type { EkAction, EkPolicy, EkView } from '../types'
import { defuseAt, first, giveChoice, largestOther, nopeChoice, playOf, topKitten } from './count'

function mediumTurn(view: EkView, legal: readonly EkAction[]): EkAction {
  const draw = legal.find((action) => action.type === 'draw') ?? first(legal)
  if (topKitten(view)) {
    if (view.owed === 0) {
      const attack = playOf(legal, 'attack')
      if (attack) return attack
    }
    const shuffle = playOf(legal, 'shuffle')
    if (shuffle) return shuffle
    const skip = playOf(legal, 'skip')
    if (skip) return skip
    return draw
  }
  if (view.knownTop.length === 0 && view.drawCount >= 1) {
    const future = playOf(legal, 'future')
    if (future) return future
  }
  const target = largestOther(view)
  if (target) {
    const pair = legal.find(
      (action) => action.type === 'pair' && action.title !== 'defuse' && action.title !== 'kitten' && action.target === target,
    )
    if (pair) return pair
  }
  return draw
}

export const medium: EkPolicy = {
  choose(view, legal) {
    const pending = view.pending
    if (pending?.kind === 'give') return giveChoice(view, legal)
    if (pending?.kind === 'defuse') return defuseAt(legal, view.drawCount)
    if (pending?.kind === 'nope') return nopeChoice(view, legal, () => false)
    return mediumTurn(view, legal)
  },
}
