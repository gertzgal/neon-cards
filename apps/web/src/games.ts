import { createElement } from 'react'
import { BlackjackTable, createSfx, rules as blackjackRules } from '@neon-cards/game-blackjack'
import { definePlugin, standardFaceRenderer, type GamePlugin } from '@neon-cards/ui'
import { highCardPlugin } from './dev/high-card'
import { audioLevels, readSettings } from './settings'

const blackjackSfx = createSfx(() => !audioLevels(readSettings()).sfx)

/** One line per game. The lobby lists them in this order. */
export const games: GamePlugin[] = [
  // Blackjack plays its own juice and sfx inside its table, so its juice map is empty.
  definePlugin({
    rules: blackjackRules,
    Table: (props) => createElement(BlackjackTable, { ...props, sfx: blackjackSfx }),
    faceRenderer: standardFaceRenderer,
    juice: {},
  }),
]

/** Routable by URL but never listed. The Worker serves them only with DEV_RIG=1 (local stacks, e2e, verify). */
export const devGames: GamePlugin[] = [highCardPlugin]

export const findGame = (id: string) => [...games, ...devGames].find((game) => game.rules.definition.id === id)
