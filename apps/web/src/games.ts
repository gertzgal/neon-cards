import type { GamePlugin } from './plugin'

/** One line per game. The lobby lists them in this order. */
export const games: GamePlugin[] = []

export const findGame = (id: string) => games.find((game) => game.rules.definition.id === id)
