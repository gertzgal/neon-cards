import { describe, expect, it } from 'vitest'
import { act, applyOpening, soloSeats, startMatch, type Policy } from '@neon-cards/engine'
import { HUMAN, RIGS, rules, type Flip7Action, type Flip7View, type RigName } from '../rules'
import { applyEvent, cardOnTable, displayFromView } from './display'

const random: Policy<Flip7View, Flip7Action> = { choose: (_view, legal, rng) => legal[rng.int(legal.length)] as Flip7Action }
const randomRules = { ...rules, policies: { easy: random, medium: random, hard: random } }

/** Plays a game, folding every batch of events into the display and checking it lands on the view's display. */
function check(seed: string, opponents: 1 | 2 | 3, rig?: string) {
  const config = rules.definition.parseConfig(rig ? { opponents, rig } : { opponents })
  let step = startMatch(randomRules, { config: config, seats: soloSeats(randomRules.definition, config), seed: seed })
  const viewOf = () => rules.definition.view(step.match.state, HUMAN)
  let display = displayFromView(viewOf())
  for (let n = 0; step.match.state.stage !== 'gameOver' && n < 400; n++) {
    const id = rules.definition.toAct(step.match.state)
    if (id === null) step = applyOpening(randomRules, step.match)
    else {
      const legal = rules.definition.legalActions(step.match.state, id)
      step = act(randomRules, step.match, id, legal[(n * 5 + seed.length) % legal.length] as Flip7Action)
    }
    for (const e of step.events) display = applyEvent(display, e)
    expect(display).toEqual(displayFromView(viewOf()))
  }
}

describe('cardOnTable', () => {
  it('finds a held action, a card on a seat, and a card set aside', () => {
    const config = rules.definition.parseConfig({ opponents: 1, difficulty: 'easy', rig: 'freeze' })
    const started = startMatch(rules, { config: config, seats: soloSeats(rules.definition, config), seed: 'held-tap' })
    const step = applyOpening(rules, started.match)
    const display = displayFromView(rules.definition.view(step.match.state, HUMAN))
    const held = display.held
    const you = display.seats[HUMAN]
    if (!held || !you) throw new Error('freeze rig did not hold an action')
    expect(held.card.face).toEqual({ kind: 'action', action: 'freeze' })
    expect(cardOnTable(display, held.card.id)).toBe(held.card)
    expect(cardOnTable(display, 'pile')).toBeNull()

    const landed = { ...held.card, id: 'landed' }
    const parked = {
      ...display,
      held: null,
      tray: [held.card],
      seats: { ...display.seats, [HUMAN]: { ...you, freeze: landed } },
    }
    expect(cardOnTable(parked, 'landed')).toBe(landed)
    expect(cardOnTable(parked, held.card.id)).toBe(held.card)
  })
})

describe('the playback display', () => {
  it('folds every event of whole random games into the same display the view gives', () => {
    for (const opponents of [1, 2, 3] as const) for (const seed of ['p', 'q', 'r']) check(`${seed}${opponents}`, opponents)
  })

  it('folds every named rig the same way', () => {
    for (const name of Object.keys(RIGS) as RigName[]) check(`rig-${name}`, 2, name)
  })
})
