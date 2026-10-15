import type { SeatId } from '@neon-cards/engine'
import type { Effect, EkAction, EkPolicy, EkView } from '../types'
import { HARD_P, defuseAt, first, giveChoice, holds, largestOther, nopeChoice, playOf, pTop, topKitten } from './count'

function hardExtra(view: EkView, effect: Effect, actor: SeatId): boolean {
  if (effect.type === 'five' && actor !== view.me) {
    const card = view.discard.find((item) => item.id === effect.takeId)
    return card?.face.title === 'defuse' || card?.face.title === 'nope'
  }
  if (effect.type === 'shuffle') {
    const top = view.knownTop[0]
    return top !== undefined && top.face.title !== 'kitten'
  }
  return false
}

function scared(view: EkView, legal: readonly EkAction[]): EkAction | undefined {
  const shuffle = playOf(legal, 'shuffle')
  if (shuffle) return shuffle
  const future = playOf(legal, 'future')
  if (future) return future
  const target = largestOther(view)
  if (target) {
    const three = legal.find(
      (action) =>
        action.type === 'three' &&
        action.name === 'defuse' &&
        action.title !== 'defuse' &&
        action.title !== 'kitten' &&
        action.target === target,
    )
    if (three) return three
    const pair = legal.find(
      (action) => action.type === 'pair' && action.title !== 'defuse' && action.title !== 'kitten' && action.target === target,
    )
    if (pair) return pair
  }
  const skip = playOf(legal, 'skip')
  if (skip) return skip
  if (view.owed === 0) return playOf(legal, 'attack')
  return undefined
}

function hardTurn(view: EkView, legal: readonly EkAction[]): EkAction {
  const five = legal.find((action) => action.type === 'five')
  if (five) return five
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
  if (pTop(view) >= HARD_P && !holds(view, 'defuse') && view.knownTop.length === 0) {
    return scared(view, legal) ?? draw
  }
  return draw
}

export const hard: EkPolicy = {
  choose(view, legal) {
    const pending = view.pending
    if (pending?.kind === 'give') return giveChoice(view, legal)
    if (pending?.kind === 'defuse') return defuseAt(legal, view.owed <= 1 ? 0 : view.drawCount)
    if (pending?.kind === 'nope') return nopeChoice(view, legal, (effect, actor) => hardExtra(view, effect, actor))
    return hardTurn(view, legal)
  },
}
