import type { Difficulty, GameRules } from '@neon-cards/engine'
import { explodingKittens, HUMAN, settings } from './definition'
import { ekDeck } from './deck'
import type { EkAction, EkConfig, EkFace, EkPolicy, EkState, EkView } from './types'

export { explodingKittens, HUMAN }
export { ekDeck }
export { RIGS, TITLE_ORDER } from './types'
export type {
  Effect,
  EkAction,
  EkConfig,
  EkEvent,
  EkFace,
  EkPolicy,
  EkPolicies,
  EkState,
  EkView,
  Pending,
  PendingView,
  RigName,
  Title,
} from './types'

/** Replaced by the policies PR. `choose` is never a strategy. */
function unbuilt(difficulty: Difficulty): EkPolicy {
  return {
    choose() {
      throw new Error(`Exploding Kittens ${difficulty} policy is not in the rules package`)
    },
  }
}

export const policies = {
  easy: unbuilt('easy'),
  medium: unbuilt('medium'),
  hard: unbuilt('hard'),
}

export const rules: GameRules<EkConfig, EkState, EkAction, EkView, EkFace> = {
  definition: explodingKittens,
  policies,
  meta: {
    title: 'Exploding Kittens',
    description: 'Draw cards. Do not explode. Last one alive wins.',
    economy: 'score',
    settings,
  },
}
