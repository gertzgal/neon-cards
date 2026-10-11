import type { GameRules } from '@neon-cards/engine'
import { highCard } from '@neon-cards/engine/testing'
import { rules as blackjack } from '@neon-cards/game-blackjack/rules'

/** The worker game registry: one line per game, keyed by `definition.id`. */
export const games: GameRules[] = [blackjack]

/** Test-only games, served only when DEV_RIG=1 so the real shell can prove multi-seat play. Never in production. */
export const devGames: GameRules[] = [highCard as GameRules]
