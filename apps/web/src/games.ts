import { createElement } from 'react'
import { BlackjackTable, createSfx, rules as blackjackRules } from '@neon-cards/game-blackjack'
import { definePlugin, type GamePlugin } from './plugin'
import { audioLevels, readSettings } from './settings'

const sfxMuted = () => !audioLevels(readSettings()).sfx
const blackjackSfx = createSfx(sfxMuted)

/** One line per game. The lobby lists them in this order. */
export const games: GamePlugin[] = [
  definePlugin({ rules: blackjackRules, Table: (props) => createElement(BlackjackTable, { ...props, sfx: blackjackSfx }) }),
]

export const findGame = (id: string) => games.find((game) => game.rules.definition.id === id)
