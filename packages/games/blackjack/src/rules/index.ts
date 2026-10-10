import type { GameRules } from '@neon-cards/engine'
import { blackjack } from './definition'
import type { BlackjackAction, BlackjackConfig, BlackjackState, BlackjackView } from './types'
import type { BlackjackFace } from './cards'

export { blackjack, defaultConfig, PLAYER } from './definition'
export { IllegalActionError } from '@neon-cards/engine'

export const rules: GameRules<BlackjackConfig, BlackjackState, BlackjackAction, BlackjackView, BlackjackFace> = {
  definition: blackjack,
  meta: {
    title: 'Blackjack',
    description: 'Beat the dealer to 21. Blackjack pays 3:2, dealer stands on all 17s.',
    economy: 'chips',
    minBet: 5,
  },
}
export { handValue, isNatural, parseFace, rankValue, standard52 } from './cards'
export type { BlackjackCard, BlackjackFace, HandValue, Rank, Suit } from './cards'
export { RIGS, rigFaces } from './rigs'
export type { RigName } from './rigs'
export * from './types'
