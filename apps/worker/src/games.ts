import type { GameRules } from '@neon-cards/engine'
import { rules as blackjack } from '@neon-cards/game-blackjack/rules'

/** The worker game registry: one line per game, keyed by `definition.id`. */
export const games: GameRules[] = [blackjack]
