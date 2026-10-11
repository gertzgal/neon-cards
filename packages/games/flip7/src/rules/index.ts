import type { GameRules } from '@neon-cards/engine'
import { flip7, settings } from './definition'
import { policies } from './policies'
import type { Flip7Action, Flip7Config, Flip7Face, Flip7State, Flip7View } from './types'

export { flip7, defaultConfig, HUMAN, legalTargets, settings } from './definition'
export * from './cards'
export { policies, easy, medium, hard, drawPile, pBust, pBustWithin, pFlip7Within } from './policies'
export { RIGS, parseRig, type RigName } from './rigs'
export * from './types'

export const rules: GameRules<Flip7Config, Flip7State, Flip7Action, Flip7View, Flip7Face> = {
  definition: flip7,
  policies,
  meta: {
    title: 'Flip 7',
    description: 'Flip cards, bank points, and never flip a repeat. First to 200 wins.',
    economy: 'score',
    settings,
  },
}
