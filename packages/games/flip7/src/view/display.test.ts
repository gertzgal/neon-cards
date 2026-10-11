import { describe, expect, it } from 'vitest'
import { act, startMatch, type Policy } from '@neon-cards/engine'
import { HUMAN, RIGS, rules, type Flip7Action, type Flip7View, type RigName } from '../rules'
import { applyEvent, displayFromView } from './display'

const random: Policy<Flip7View, Flip7Action> = { choose: (_view, legal, rng) => legal[rng.int(legal.length)] as Flip7Action }
const randomRules = { ...rules, policies: { easy: random, medium: random, hard: random } }

/** Plays a game, folding every batch of events into the display and checking it lands on the view's display. */
function check(seed: string, opponents: 1 | 2 | 3, rig?: string) {
  const config = rules.definition.parseConfig(rig ? { opponents, rig } : { opponents })
  let step = startMatch(randomRules, config, seed)
  const viewOf = () => rules.definition.view(step.match.state, HUMAN)
  let display = displayFromView(viewOf())
  for (let n = 0; rules.definition.toAct(step.match.state) !== null && n < 400; n++) {
    const legal = rules.definition.legalActions(step.match.state, HUMAN)
    step = act(randomRules, step.match, HUMAN, legal[(n * 5 + seed.length) % legal.length] as Flip7Action)
    for (const e of step.events) display = applyEvent(display, e)
    expect(display).toEqual(displayFromView(viewOf()))
  }
}

describe('the playback display', () => {
  it('folds every event of whole random games into the same display the view gives', () => {
    for (const opponents of [1, 2, 3] as const) for (const seed of ['p', 'q', 'r']) check(`${seed}${opponents}`, opponents)
  })

  it('folds every named rig the same way', () => {
    for (const name of Object.keys(RIGS) as RigName[]) check(`rig-${name}`, 2, name)
  })
})
