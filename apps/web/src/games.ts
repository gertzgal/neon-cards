import { plugin as blackjack } from '@neon-cards/game-blackjack'
import type { GamePlugin } from '@neon-cards/ui'

/** One line per game. The lobby lists them in this order. */
export const games: GamePlugin[] = [blackjack]

export const findGame = (id: string) => games.find((game) => game.rules.definition.id === id)
