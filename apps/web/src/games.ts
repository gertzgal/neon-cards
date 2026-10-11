import { createElement } from 'react'
import { BlackjackTable, rules as blackjackRules, type Sfx } from '@neon-cards/game-blackjack'
import { getAudio, type SfxName } from '@neon-cards/ui'
import { definePlugin, type GamePlugin } from './plugin'

const BLACKJACK_SFX: Record<Parameters<Sfx['play']>[0], SfxName> = {
  card: 'card',
  chip: 'chip',
  flip: 'flip',
  peek: 'turn',
  tap: 'click',
  bust: 'bust',
  win: 'win',
  lose: 'lose',
  push: 'push',
  blackjack: 'blackjack',
  refill: 'win',
}
const blackjackSfx: Sfx = { play: (name) => getAudio().play(BLACKJACK_SFX[name]) }

/** One line per game. The lobby lists them in this order. */
export const games: GamePlugin[] = [
  definePlugin({ rules: blackjackRules, Table: (props) => createElement(BlackjackTable, { ...props, sfx: blackjackSfx }) }),
]

export const findGame = (id: string) => games.find((game) => game.rules.definition.id === id)
