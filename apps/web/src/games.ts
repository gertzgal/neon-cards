import { createElement } from 'react'
import { BlackjackTable, createSfx, rules as blackjackRules } from '@neon-cards/game-blackjack'
import { definePlugin, standardFaceRenderer, type GamePlugin } from '@neon-cards/ui'
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

export const findGame = (id: string) => games.find((game) => game.rules.definition.id === id)
