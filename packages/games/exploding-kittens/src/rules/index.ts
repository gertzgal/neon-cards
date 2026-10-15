import type { GameRules } from '@neon-cards/engine'
import { explodingKittens, HUMAN, settings } from './definition'
import { ekDeck } from './deck'
import { policies } from './policies/index'
import type { EkAction, EkConfig, EkFace, EkState, EkView } from './types'

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

export { policies }

export const rules: GameRules<EkConfig, EkState, EkAction, EkView, EkFace> = {
  definition: explodingKittens,
  policies,
  meta: {
    title: 'Exploding Kittens',
    description: 'Draw cards. Do not explode. Last one alive wins.',
    economy: 'score',
    settings,
    quick: { types: ['pass', 'nope'], decline: { type: 'pass' } },
  },
}
