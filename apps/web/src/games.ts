import { plugin as blackjack } from '@neon-cards/game-blackjack'
import type { GamePlugin } from '@neon-cards/ui'
import { highCardPlugin } from './dev/high-card'

/** One line per game. The lobby lists them in this order. */
export const games: GamePlugin[] = [blackjack]

/** Routable by URL but never listed. The Worker serves them only with DEV_RIG=1 (local stacks, e2e, verify). */
export const devGames: GamePlugin[] = [highCardPlugin]

export const findGame = (id: string) => [...games, ...devGames].find((game) => game.rules.definition.id === id)
