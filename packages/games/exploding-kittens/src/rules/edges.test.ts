import { soloSeats, act, createRng, replay, restoreRng, type Match } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { rules } from './index'
import {
  actOn,
  ek,
  expectReplay,
  give,
  holds,
  HUMAN,
  keyHits,
  lab,
  openSession,
  rejects,
  replaceHand,
  seatTurn,
  setTop,
  strip,
  stripAll,
  take,
  titlesOf,
  type Session,
} from './test-helpers'
import { TITLE_ORDER, type EkAction, type EkEvent, type EkState, type Title } from './types'

const cpu = 'cpu-1'
const cpu2 = 'cpu-2'
const cpu3 = 'cpu-3'

function silence(state: EkState, except?: string): void {
  for (const seat of state.order) {
    if (seat !== except) strip(state, seat, 'nope')
  }
}

function playable(state: EkState, seat: string, title: 'attack' | 'skip' | 'shuffle' | 'future', owed = 0): EkState {
  silence(state)
  if (!holds(state, seat, title)) give(state, seat, title)
  seatTurn(state, seat, owed)
  return state
}

function types(events: EkEvent[]): string[] {
  return events.map((event) => event.type)
}

function handIds(state: EkState, seat: string): string[] {
  return state.seats[seat]?.hand.map((card) => card.id) ?? []
}

function buryKittens(state: EkState): void {
  const kept = []
  for (const card of state.draw) {
    if (card.face.title === 'kitten') state.removed.push(card)
    else kept.push(card)
  }
  state.draw = kept
}

describe('nope', () => {
  it('E1 one Nope cancels and leaves the play in the discard', () => {
    const state = playable(lab(), HUMAN, 'attack', 3)
    give(state, cpu, 'nope')
    const opened = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(types(opened.events)).toEqual(['Played'])
    const noped = actOn(opened.state, cpu, { type: 'nope' })
    expect(types(noped.events)).toEqual(['Noped', 'Cancelled'])
    const cancelled = noped.events[1]
    expect(cancelled).toMatchObject({ type: 'Cancelled', seat: HUMAN, nopes: 1 })
    expect(noped.events[0]).toMatchObject({ type: 'Noped', seat: cpu, nopes: 1 })
    expect(titlesOf(noped.state.discard)).toEqual(['attack', 'nope'])
    expect(noped.state.turn).toBe(HUMAN)
    expect(noped.state.owed).toBe(3)
    expect(noped.state.pending).toEqual({ kind: 'turn', seat: HUMAN })
  })

  it('E2 a Nope on a Nope resolves the effect', () => {
    const state = playable(lab(), HUMAN, 'attack')
    give(state, HUMAN, 'nope')
    give(state, cpu, 'nope')
    const opened = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(ek.toAct(opened.state)).toBe(cpu)
    const once = actOn(opened.state, cpu, { type: 'nope' })
    expect(ek.toAct(once.state)).toBe(HUMAN)
    const twice = actOn(once.state, HUMAN, { type: 'nope' })
    expect(types(twice.events)).toEqual(['Noped', 'Attacked'])
    expect(twice.events[0]).toMatchObject({ type: 'Noped', nopes: 2 })
    expect(twice.state.turn).toBe(cpu)
    expect(twice.state.owed).toBe(2)
  })

  it('E3 three Nopes cancel', () => {
    const state = playable(lab(), HUMAN, 'skip')
    give(state, HUMAN, 'nope')
    give(state, cpu, 'nope')
    give(state, cpu, 'nope')
    let cursor = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    cursor = actOn(cursor.state, cpu, { type: 'nope' })
    cursor = actOn(cursor.state, HUMAN, { type: 'nope' })
    cursor = actOn(cursor.state, cpu, { type: 'nope' })
    expect(cursor.events.at(-1)).toMatchObject({ type: 'Cancelled', nopes: 3 })
    expect(cursor.state.turn).toBe(HUMAN)
    expect(cursor.state.owed).toBe(0)
    expect(cursor.state.pending).toEqual({ kind: 'turn', seat: HUMAN })
  })

  it('E4 an empty queue resolves inside the play', () => {
    const state = playable(lab(), HUMAN, 'skip')
    const out = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    expect(types(out.events)).toEqual(['Played'])
    expect(out.events.some((event) => event.type === 'Passed' || event.type === 'Noped')).toBe(false)
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(0)
  })

  it('E5 a living seat with no Nope is not in the queue', () => {
    const state = playable(lab(3), HUMAN, 'attack')
    give(state, cpu2, 'nope')
    const out = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(out.state.pending).toMatchObject({ kind: 'nope', queue: [cpu2] })
    expect(ek.legalActions(out.state, cpu)).toEqual([])
    expect(ek.toAct(out.state)).toBe(cpu2)
  })

  it('E6 the actor is absent until someone else Nopes', () => {
    const state = playable(lab(), HUMAN, 'attack')
    give(state, HUMAN, 'nope')
    give(state, cpu, 'nope')
    const opened = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(opened.state.pending).toMatchObject({ kind: 'nope', queue: [cpu], top: HUMAN })
    const noped = actOn(opened.state, cpu, { type: 'nope' })
    expect(noped.state.pending).toMatchObject({ kind: 'nope', queue: [HUMAN], top: cpu, nopes: 1 })
  })

  it('E7 a CPU Attack stops on the human before any CPU is offered it', () => {
    const session = openSession('e7', 3)
    const state = session.state
    silence(state)
    replaceHand(state, HUMAN, ['skip', 'nope', 'tacocat'])
    replaceHand(state, cpu, ['attack', 'beard', 'future'])
    strip(state, cpu2, 'nope')
    seatTurn(state, HUMAN, 0)
    const match: Match<typeof session.config, EkState> = {
      gameId: ek.id,
      version: ek.version,
      seed: session.seed,
      config: session.config,
      seats: session.seats,
      state,
      rng: session.rng.state(),
      seq: 0,
    }
    let calls = 0
    const policy = {
      choose(_view: unknown, legal: EkAction[]) {
        calls += 1
        const pending = (_view as { pending: { kind: string } | null }).pending
        if (pending?.kind === 'nope') throw new Error('CPU was offered the Attack')
        const attack = legal.find((action) => action.type === 'play' && action.title === 'attack')
        if (!attack) throw new Error(`expected an attack, saw ${JSON.stringify(legal)}`)
        return attack
      },
    }
    const stepped = act({ ...rules, policies: { easy: policy, medium: policy, hard: policy } }, match, HUMAN, {
      type: 'play',
      title: 'skip',
    })
    expect(calls).toBe(1)
    expect(ek.toAct(stepped.match.state)).toBe(HUMAN)
    expect(stepped.match.state.pending).toMatchObject({ kind: 'nope', effect: { type: 'attack' }, nopes: 0, top: cpu })
    expect(stepped.events.some((event) => event.type === 'Attacked')).toBe(false)
    expect(stepped.events.some((event) => event.type === 'Played')).toBe(true)
    expect(ek.view(stepped.match.state, HUMAN).pending).toMatchObject({ kind: 'nope', seat: HUMAN })
  })

  it('E8 a drawn kitten and a defuse do not open a Nope window', () => {
    const state = lab()
    seatTurn(state, HUMAN)
    setTop(state, 'kitten')
    if (!holds(state, HUMAN, 'defuse')) give(state, HUMAN, 'defuse')
    const drawn = actOn(state, HUMAN, { type: 'draw' })
    expect(types(drawn.events)).toEqual(['DrewKitten'])
    expect(drawn.state.pending?.kind).toBe('defuse')
    expect(ek.legalActions(drawn.state, HUMAN).some((action) => action.type === 'nope')).toBe(false)
    const defused = actOn(drawn.state, HUMAN, { type: 'defuse', index: 0 })
    expect(defused.events.some((event) => event.type === 'Noped' || event.type === 'Passed')).toBe(false)
    expect(defused.state.pending?.kind).not.toBe('nope')
  })

  it('E9 playing a Nope on a turn throws', () => {
    const state = lab()
    give(state, HUMAN, 'nope')
    seatTurn(state, HUMAN)
    rejects(state, HUMAN, { type: 'play', title: 'nope' } as unknown as EkAction)
  })

  it('E10 a Noped pair, three, or five does not move the target card', () => {
    const state = lab(3)
    silence(state)
    give(state, cpu2, 'nope')
    replaceHand(state, HUMAN, ['skip', 'skip', 'tacocat', 'tacocat', 'tacocat', 'attack', 'shuffle', 'future', 'beard'])
    const defuse = take(state, 'defuse')
    state.discard.push(defuse)
    strip(state, HUMAN, 'defuse')
    seatTurn(state, HUMAN)
    const pairHand = handIds(state, cpu)
    const pair = actOn(state, HUMAN, { type: 'pair', title: 'skip', target: cpu })
    const cancelledPair = actOn(pair.state, cpu2, { type: 'nope' })
    expect(cancelledPair.events.at(-1)).toMatchObject({ type: 'Cancelled' })
    expect(handIds(cancelledPair.state, cpu)).toEqual(pairHand)
    expect(titlesOf(cancelledPair.state.discard)).toContain('skip')

    const again = lab(3)
    silence(again)
    give(again, cpu2, 'nope')
    replaceHand(again, HUMAN, ['beard', 'beard', 'beard'])
    const named = give(again, cpu, 'tacocat')
    seatTurn(again, HUMAN)
    const three = actOn(again, HUMAN, { type: 'three', title: 'beard', target: cpu, name: 'tacocat' })
    const nopedThree = actOn(three.state, cpu2, { type: 'nope' })
    expect(handIds(nopedThree.state, cpu)).toContain(named.id)
    expect(nopedThree.events.some((event) => event.type === 'Asked')).toBe(false)

    const five = lab()
    silence(five)
    give(five, cpu, 'nope')
    replaceHand(five, HUMAN, ['attack', 'skip', 'shuffle', 'future', 'tacocat'])
    const prize = take(five, 'defuse')
    five.discard.push(prize)
    seatTurn(five, HUMAN)
    const cast = actOn(five, HUMAN, { type: 'five', titles: ['future', 'attack', 'skip', 'shuffle', 'tacocat'], takeId: prize.id })
    const nopedFive = actOn(cast.state, cpu, { type: 'nope' })
    expect(nopedFive.state.discard.some((card) => card.id === prize.id)).toBe(true)
    expect(handIds(nopedFive.state, HUMAN)).not.toContain(prize.id)
    expect(nopedFive.events.some((event) => event.type === 'Took')).toBe(false)
  })
})

describe('attack and skip', () => {
  it('E11 a fresh Attack sets the next living seat to owed 2', () => {
    const state = playable(lab(), HUMAN, 'attack')
    const out = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(out.events.at(-1)).toEqual({ type: 'Attacked', from: HUMAN, to: cpu, owed: 2 })
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(2)
  })

  it('E12 owed 4 Attacks into owed 6', () => {
    const state = playable(lab(), HUMAN, 'attack', 4)
    const out = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(6)
    expect(out.events.at(-1)).toMatchObject({ type: 'Attacked', owed: 6 })
  })

  it('E13 one completed turn of owed 2, then Attack, sets the next seat to 3', () => {
    const state = playable(lab(), HUMAN, 'skip', 2)
    give(state, HUMAN, 'attack')
    const once = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    expect(once.state.turn).toBe(HUMAN)
    expect(once.state.owed).toBe(1)
    const attacked = actOn(once.state, HUMAN, { type: 'play', title: 'attack' })
    expect(attacked.state.turn).toBe(cpu)
    expect(attacked.state.owed).toBe(3)
  })

  it('E14 Skip at owed 0 advances', () => {
    const state = playable(lab(), HUMAN, 'skip', 0)
    const out = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(0)
  })

  it('E15 Skip at owed 2 leaves the same seat at owed 1', () => {
    const state = playable(lab(), HUMAN, 'skip', 2)
    const out = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    expect(out.state.turn).toBe(HUMAN)
    expect(out.state.owed).toBe(1)
  })

  it('E16 Skip at owed 1 advances', () => {
    const state = playable(lab(), HUMAN, 'skip', 1)
    const out = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(0)
  })

  it('E17 two Skips end both turns of owed 2', () => {
    const state = playable(lab(), HUMAN, 'skip', 2)
    give(state, HUMAN, 'skip')
    const first = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    const second = actOn(first.state, HUMAN, { type: 'play', title: 'skip' })
    expect(second.state.turn).toBe(cpu)
    expect(second.state.owed).toBe(0)
  })

  it('E18 a Noped Attack leaves owed and turn unchanged', () => {
    const state = playable(lab(), HUMAN, 'attack', 4)
    give(state, cpu, 'nope')
    const opened = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    const out = actOn(opened.state, cpu, { type: 'nope' })
    expect(out.state.turn).toBe(HUMAN)
    expect(out.state.owed).toBe(4)
    expect(out.events.some((event) => event.type === 'Attacked')).toBe(false)
  })

  it('E19 a Noped Skip does not consume a turn', () => {
    const state = playable(lab(), HUMAN, 'skip', 2)
    give(state, cpu, 'nope')
    const opened = actOn(state, HUMAN, { type: 'play', title: 'skip' })
    const out = actOn(opened.state, cpu, { type: 'nope' })
    expect(out.state.turn).toBe(HUMAN)
    expect(out.state.owed).toBe(2)
  })

  it('E20 Skip then Skip ends owed 2, and Attack instead hands over owed 4', () => {
    const state = playable(lab(), HUMAN, 'skip', 2)
    give(state, HUMAN, 'skip')
    give(state, HUMAN, 'attack')
    const skipped = actOn(structuredClone(state), HUMAN, { type: 'play', title: 'skip' })
    const done = actOn(skipped.state, HUMAN, { type: 'play', title: 'skip' })
    expect(done.state.turn).toBe(cpu)
    expect(done.state.owed).toBe(0)
    const attacked = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    expect(attacked.state.turn).toBe(cpu)
    expect(attacked.state.owed).toBe(4)
  })
})

describe('defuse and explosion', () => {
  function kittenDraw(state: EkState, seat: string, owed = 0): { state: EkState; kittenId: string } {
    silence(state)
    const kitten = setTop(state, 'kitten')
    if (!holds(state, seat, 'defuse')) give(state, seat, 'defuse')
    seatTurn(state, seat, owed)
    const drawn = actOn(state, seat, { type: 'draw' })
    return { state: drawn.state, kittenId: kitten.id }
  }

  it('E21 index 0 is the next draw and index draw.length is the bottom', () => {
    const top = kittenDraw(lab(), HUMAN)
    const length = top.state.draw.length
    const atTop = actOn(top.state, HUMAN, { type: 'defuse', index: 0 })
    expect(atTop.state.draw[0]?.id).toBe(top.kittenId)
    const again = actOn(atTop.state, atTop.state.turn ?? cpu, { type: 'draw' })
    expect(again.events[0]).toMatchObject({ type: 'DrewKitten', card: { id: top.kittenId } })

    const bottom = kittenDraw(lab(), HUMAN)
    const buried = actOn(bottom.state, HUMAN, { type: 'defuse', index: bottom.state.draw.length })
    expect(buried.state.draw.at(-1)?.id).toBe(bottom.kittenId)
    expect(buried.state.draw[0]?.id).not.toBe(bottom.kittenId)
    expect(length).toBeGreaterThan(0)
  })

  it('E22 the last card is a kitten and the only index is 0', () => {
    const state = lab()
    silence(state)
    const kitten = take(state, 'kitten')
    state.removed.push(...state.draw)
    state.draw = [kitten]
    if (!holds(state, HUMAN, 'defuse')) give(state, HUMAN, 'defuse')
    seatTurn(state, HUMAN)
    const drawn = actOn(state, HUMAN, { type: 'draw' })
    expect(drawn.state.draw).toHaveLength(0)
    expect(ek.legalActions(drawn.state, HUMAN)).toEqual([{ type: 'defuse', index: 0 }])
    const defused = actOn(drawn.state, HUMAN, { type: 'defuse', index: 0 })
    expect(defused.state.draw.map((card) => card.id)).toEqual([kitten.id])
  })

  it('E23 an index outside the draw throws and leaves the state unchanged', () => {
    const drawn = kittenDraw(lab(), HUMAN)
    const limit = drawn.state.draw.length
    rejects(drawn.state, HUMAN, { type: 'defuse', index: -1 })
    rejects(drawn.state, HUMAN, { type: 'defuse', index: 1.5 })
    rejects(drawn.state, HUMAN, { type: 'defuse', index: limit + 1 })
  })

  it('E24 defuse consumes one turn through finishTurn', () => {
    const stacked = kittenDraw(lab(), HUMAN, 2)
    expect(stacked.state.owed).toBe(2)
    const stayed = actOn(stacked.state, HUMAN, { type: 'defuse', index: 0 })
    expect(stayed.state.turn).toBe(HUMAN)
    expect(stayed.state.owed).toBe(1)

    const fresh = kittenDraw(lab(), HUMAN, 0)
    const advanced = actOn(fresh.state, HUMAN, { type: 'defuse', index: 0 })
    expect(advanced.state.turn).toBe(cpu)
    expect(advanced.state.owed).toBe(0)
  })

  it('E25 Defused has no index, other views learn nothing, and replay rebuilds the draw', () => {
    function bury(index: number): Session {
      const session = openSession('e25', 2, 'kitten')
      const drawn = actOn(session.state, HUMAN, { type: 'draw' }, session.rng)
      session.log.push({ seq: 0, seat: HUMAN, action: { type: 'draw' } })
      session.events.push(...drawn.events)
      session.state = drawn.state
      const defused = actOn(session.state, HUMAN, { type: 'defuse', index }, session.rng)
      session.log.push({ seq: 1, seat: HUMAN, action: { type: 'defuse', index } })
      session.events.push(...defused.events)
      session.state = defused.state
      return session
    }
    const atTop = bury(0)
    const atFive = bury(5)
    expect(atTop.events).toEqual(atFive.events)
    const defused = atTop.events.find((event) => event.type === 'Defused')
    expect(defused && Object.keys(defused).sort()).toEqual(['defuse', 'kitten', 'seat', 'type'])
    expect(defused).not.toHaveProperty('index')
    expect(ek.view(atTop.state, HUMAN).knownTop.map((card) => card.face.title)).toEqual(['kitten'])
    expect(ek.view(atTop.state, HUMAN).plantedIndex).toBeNull()
    expect(ek.view(atFive.state, HUMAN).knownTop).toEqual([])
    expect(ek.view(atFive.state, HUMAN).plantedIndex).toBe(5)
    expect(ek.view(atTop.state, cpu)).toEqual(ek.view(atFive.state, cpu))
    expect(ek.view(atTop.state, cpu).knownTop).toEqual([])
    expect(ek.view(atTop.state, cpu).plantedIndex).toBeNull()
    expect(atTop.state.draw.map((card) => card.id)).not.toEqual(atFive.state.draw.map((card) => card.id))
    expectReplay(atTop)
    expectReplay(atFive)

    const seeded = kittenDraw(lab(), HUMAN)
    const knownId = seeded.state.draw[0]?.id
    if (!knownId) throw new Error('empty draw')
    seeded.state.known[cpu] = { top: [knownId], planted: 2 }
    const cleared = actOn(seeded.state, HUMAN, { type: 'defuse', index: 0 })
    expect(ek.view(cleared.state, cpu).knownTop).toEqual([])
    expect(ek.view(cleared.state, cpu).plantedIndex).toBeNull()
  })

  it('E26 a kitten with no defuse kills and the next living seat starts at owed 0', () => {
    const state = lab(3)
    silence(state)
    strip(state, HUMAN, 'defuse')
    const kitten = setTop(state, 'kitten')
    const hand = state.seats[HUMAN]?.hand.map((card) => card.id) ?? []
    seatTurn(state, HUMAN, 4)
    const out = actOn(state, HUMAN, { type: 'draw' })
    const exploded = out.events.find((event) => event.type === 'Exploded')
    expect(exploded).toMatchObject({ type: 'Exploded', seat: HUMAN, kitten: { id: kitten.id } })
    if (exploded?.type === 'Exploded') expect(exploded.hand.map((card) => card.id)).toEqual(hand)
    expect(out.state.seats[HUMAN]?.alive).toBe(false)
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(0)
    expect(out.state.winner).toBeNull()
    expect(titlesOf(out.state.discard).slice(-1)).toEqual(['kitten'])
  })

  it('E27 a kitten with a defuse does not kill', () => {
    const drawn = kittenDraw(lab(), HUMAN)
    expect(drawn.state.seats[HUMAN]?.alive).toBe(true)
    expect(drawn.state.pending?.kind).toBe('defuse')
    expect(drawn.state.winner).toBeNull()
  })

  it('E28 the explosion that leaves one player ends the game and settles zeros', () => {
    const state = lab()
    silence(state)
    strip(state, HUMAN, 'defuse')
    const spare = take(state, 'kitten')
    setTop(state, 'kitten')
    state.draw.splice(3, 0, spare)
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'draw' })
    expect(out.events.at(-1)).toEqual({ type: 'Won', seat: cpu })
    expect(out.state.winner).toBe(cpu)
    expect(out.state.pending).toBeNull()
    expect(out.state.turn).toBeNull()
    expect(ek.phase(out.state)).toBe('over')
    expect(ek.toAct(out.state)).toBeNull()
    expect(ek.settle(out.state)).toEqual([
      { seat: HUMAN, delta: 0 },
      { seat: cpu, delta: 0 },
    ])
    expect(out.state.draw.some((card) => card.id === spare.id)).toBe(true)
  })

  it('E29 nextLiving skips a dead seat and leftover owed is not copied', () => {
    const attack = playable(lab(3), HUMAN, 'attack')
    const dead = attack.seats[cpu]
    if (!dead) throw new Error('missing cpu')
    dead.alive = false
    const passed = actOn(attack, HUMAN, { type: 'play', title: 'attack' })
    expect(passed.state.turn).toBe(cpu2)
    expect(passed.state.owed).toBe(2)

    const state = lab(4)
    silence(state)
    strip(state, HUMAN, 'defuse')
    setTop(state, 'kitten')
    const skipped = state.seats[cpu]
    if (!skipped) throw new Error('missing cpu')
    skipped.alive = false
    seatTurn(state, HUMAN, 2)
    const died = actOn(state, HUMAN, { type: 'draw' })
    expect(died.state.winner).toBeNull()
    expect(died.state.turn).toBe(cpu2)
    expect(died.state.owed).toBe(0)
  })

  it('E30 the third explosion in a four-seat game ends it', () => {
    const state = lab(4)
    silence(state)
    stripAll(state, 'defuse')
    const kittens = [take(state, 'kitten'), take(state, 'kitten'), take(state, 'kitten')]
    state.draw.unshift(...kittens)
    seatTurn(state, HUMAN, 5)
    const first = actOn(state, HUMAN, { type: 'draw' })
    expect(first.state.winner).toBeNull()
    expect(first.state.order.filter((seat) => first.state.seats[seat]?.alive)).toEqual([cpu, cpu2, cpu3])
    const second = actOn(first.state, cpu, { type: 'draw' })
    expect(second.state.order.filter((seat) => second.state.seats[seat]?.alive)).toEqual([cpu2, cpu3])
    const third = actOn(second.state, cpu2, { type: 'draw' })
    expect(third.events.at(-1)).toEqual({ type: 'Won', seat: cpu3 })
    expect(third.state.pending).toBeNull()
    expect(ek.phase(third.state)).toBe('over')
  })
})

describe('favor, peek, shuffle, combos', () => {
  it('E31 favor against an empty hand is a Whiff', () => {
    const state = lab()
    replaceHand(state, HUMAN, ['favor'])
    replaceHand(state, cpu, [])
    silence(state)
    seatTurn(state, HUMAN, 2)
    const out = actOn(state, HUMAN, { type: 'favor', target: cpu })
    expect(out.events.at(-1)).toEqual({ type: 'Whiff', seat: HUMAN })
    expect(out.state.pending).toEqual({ kind: 'turn', seat: HUMAN })
    expect(out.state.owed).toBe(2)
  })

  it('E32 a one-card favor moves that card with no face and no give action', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['favor'])
    replaceHand(state, cpu, ['tacocat'])
    const card = state.seats[cpu]?.hand[0]
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'favor', target: cpu })
    expect(out.events.at(-1)).toEqual({ type: 'Gave', from: cpu, to: HUMAN })
    expect(out.events.at(-1)).not.toHaveProperty('card')
    expect(handIds(out.state, HUMAN)).toContain(card?.id)
    expect(out.state.seats[cpu]?.hand).toEqual([])
    expect(out.state.pending).toEqual({ kind: 'turn', seat: HUMAN })
  })

  it('E33 favor against two or more cards asks the target', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['favor'])
    replaceHand(state, cpu, ['tacocat', 'beard'])
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'favor', target: cpu })
    expect(out.state.pending).toEqual({ kind: 'give', seat: cpu, to: HUMAN })
    expect(ek.toAct(out.state)).toBe(cpu)
    expect(ek.legalActions(out.state, HUMAN)).toEqual([])
    const card = out.state.seats[cpu]?.hand[1]
    if (!card) throw new Error('missing gift')
    const given = actOn(out.state, cpu, { type: 'give', cardId: card.id })
    expect(given.events).toEqual([{ type: 'Gave', from: cpu, to: HUMAN }])
    expect(handIds(given.state, HUMAN)).toContain(card.id)
    expect(given.state.pending).toEqual({ kind: 'turn', seat: HUMAN })
  })

  it('E34 favor targeting yourself, a dead seat, or an unknown id throws', () => {
    const state = lab(3)
    replaceHand(state, HUMAN, ['favor'])
    seatTurn(state, HUMAN)
    rejects(state, HUMAN, { type: 'favor', target: HUMAN })
    rejects(state, HUMAN, { type: 'favor', target: 'nobody' })
    const dead = state.seats[cpu]
    if (!dead) throw new Error('missing cpu')
    dead.alive = false
    rejects(state, HUMAN, { type: 'favor', target: cpu })
  })

  it('E35 See the Future with 0, 1, and 2 cards peeks that many and shows no face', () => {
    for (const count of [0, 1, 2] as const) {
      const state = lab()
      silence(state)
      replaceHand(state, HUMAN, ['future'])
      const kept = state.draw.filter((card) => card.face.title !== 'kitten').slice(0, count)
      state.removed.push(...state.draw.filter((card) => !kept.includes(card)), ...state.discard)
      state.discard = []
      state.draw = kept
      seatTurn(state, HUMAN)
      const out = actOn(state, HUMAN, { type: 'play', title: 'future' })
      expect(out.events.at(-1)).toEqual({ type: 'Peeked', seat: HUMAN, count })
      expect(JSON.stringify(out.events.at(-1))).not.toContain('face')
      expect(ek.view(out.state, HUMAN).knownTop.map((card) => card.id)).toEqual(kept.map((card) => card.id))
    }
  })

  it('E36 a second peek replaces knownTop', () => {
    const state = lab()
    silence(state)
    buryKittens(state)
    replaceHand(state, HUMAN, ['future', 'future'])
    seatTurn(state, HUMAN)
    const first = actOn(state, HUMAN, { type: 'play', title: 'future' })
    const seen = ek.view(first.state, HUMAN).knownTop.map((card) => card.id)
    const top = first.state.draw[0]
    if (!top) throw new Error('empty draw')
    first.state.draw.push(first.state.draw.shift() as typeof top)
    const second = actOn(first.state, HUMAN, { type: 'play', title: 'future' })
    const next = ek.view(second.state, HUMAN).knownTop.map((card) => card.id)
    expect(next[0]).toBe(first.state.draw[0]?.id)
    expect(next).not.toEqual(seen)
  })

  it('E37 drawing the peeked top shifts the prefix', () => {
    const state = lab()
    silence(state)
    buryKittens(state)
    replaceHand(state, HUMAN, ['future'])
    seatTurn(state, HUMAN)
    const peeked = actOn(state, HUMAN, { type: 'play', title: 'future' })
    const before = ek.view(peeked.state, HUMAN).knownTop.map((card) => card.id)
    const drawn = actOn(peeked.state, HUMAN, { type: 'draw' })
    expect(ek.view(drawn.state, HUMAN).knownTop.map((card) => card.id)).toEqual(before.slice(1))
  })

  it('E38 shuffle of 0 cards and of 1 card clears known', () => {
    for (const count of [0, 1]) {
      const state = lab()
      silence(state)
      replaceHand(state, HUMAN, ['shuffle'])
      const kept = state.draw.slice(0, count)
      state.removed.push(...state.draw.slice(count), ...state.discard)
      state.discard = []
      state.draw = kept
      seatTurn(state, HUMAN)
      if (kept[0]) state.known[HUMAN] = { top: [kept[0].id], planted: 0 }
      else state.known[HUMAN] = { top: [], planted: 1 }
      state.known[cpu] = { top: [], planted: 4 }
      const out = actOn(state, HUMAN, { type: 'play', title: 'shuffle' })
      expect(out.events.at(-1)).toEqual({ type: 'Shuffled', count })
      expect(ek.view(out.state, HUMAN).knownTop).toEqual([])
      expect(ek.view(out.state, HUMAN).plantedIndex).toBeNull()
      expect(out.state.known[cpu]).toEqual({ top: [], planted: null })
      expect(out.state.draw.map((card) => card.id)).toEqual(kept.map((card) => card.id))
    }
  })

  it('E39 shuffle does not publish the draw order', () => {
    const state = lab()
    silence(state)
    buryKittens(state)
    replaceHand(state, HUMAN, ['shuffle'])
    const before = state.draw.length
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'play', title: 'shuffle' }, createRng('shuffle'))
    const event = out.events.at(-1)
    expect(event).toEqual({ type: 'Shuffled', count: before })
    expect(JSON.stringify(event)).not.toContain('exploding-kittens-')
    const view = ek.view(out.state, HUMAN)
    expect(view.drawCount).toBe(before)
    expect(keyHits(view, 'draw')).toEqual([])
    expect(view.knownTop).toEqual([])
  })

  it('E40 a pair against an empty hand is a Whiff', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['skip', 'skip'])
    replaceHand(state, cpu, [])
    seatTurn(state, HUMAN, 2)
    const out = actOn(state, HUMAN, { type: 'pair', title: 'skip', target: cpu })
    expect(out.events.at(-1)).toEqual({ type: 'Whiff', seat: HUMAN })
    expect(out.state.owed).toBe(2)
    expect(out.state.turn).toBe(HUMAN)
  })

  it('E41 the apply rng picks the stolen card and replay steals the same id', () => {
    let found: { seed: string; title: Title } | null = null
    for (let i = 0; i < 400 && !found; i++) {
      const session = openSession(`e41-${i}`, 2)
      const counts = new Map<Title, number>()
      for (const card of session.state.seats[HUMAN]?.hand ?? []) counts.set(card.face.title, (counts.get(card.face.title) ?? 0) + 1)
      const title = TITLE_ORDER.find((name) => (counts.get(name) ?? 0) >= 2)
      if (title && (session.state.seats[cpu]?.hand.length ?? 0) > 0) found = { seed: `e41-${i}`, title }
    }
    if (!found) throw new Error('no seeded pair')
    const session = openSession(found.seed, 2)
    const played = actOn(session.state, HUMAN, { type: 'pair', title: found.title, target: cpu }, session.rng)
    session.log.push({ seq: 0, seat: HUMAN, action: { type: 'pair', title: found.title, target: cpu } })
    session.events.push(...played.events)
    session.state = played.state
    const cursor = session
    while (cursor.state.pending?.kind === 'nope') {
      const seat = ek.toAct(cursor.state)
      if (!seat) throw new Error('nope without a seat')
      const passed = actOn(cursor.state, seat, { type: 'pass' }, cursor.rng)
      cursor.log.push({ seq: cursor.log.length, seat, action: { type: 'pass' } })
      cursor.events.push(...passed.events)
      cursor.state = passed.state
    }
    const stole = cursor.events.find((event) => event.type === 'Stole')
    expect(stole).toEqual({ type: 'Stole', from: cpu, to: HUMAN })
    expect(stole).not.toHaveProperty('card')
    const gained = cursor.state.seats[HUMAN]?.hand.at(-1)
    if (!gained) throw new Error('nothing stolen')
    expect(ek.view(cursor.state, HUMAN).hand.some((card) => card.id === gained.id)).toBe(true)
    expect(ek.view(cursor.state, cpu).hand.some((card) => card.id === gained.id)).toBe(false)
    expectReplay(cursor)

    const again = openSession(found.seed, 2)
    const rng = restoreRng(again.rng.state())
    const once = ek.apply(again.state, HUMAN, { type: 'pair', title: found.title, target: cpu }, rng)
    const twice = ek.apply(structuredClone(again.state), HUMAN, { type: 'pair', title: found.title, target: cpu }, restoreRng(again.rng.state()))
    expect(once.state.seats[HUMAN]?.hand.at(-1)?.id).toBe(twice.state.seats[HUMAN]?.hand.at(-1)?.id)
  })

  it('E42 three naming defuse takes the first defuse', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['beard', 'beard', 'beard'])
    replaceHand(state, cpu, ['skip', 'defuse', 'defuse'])
    const first = state.seats[cpu]?.hand.find((card) => card.face.title === 'defuse')
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'three', title: 'beard', target: cpu, name: 'defuse' })
    expect(out.events.at(-1)).toMatchObject({ type: 'Asked', from: HUMAN, to: cpu, title: 'defuse', hit: true, card: { id: first?.id, face: { title: 'defuse' } } })
    expect(handIds(out.state, HUMAN)).toContain(first?.id)
  })

  it('E43 three naming a missing defuse hits nothing', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['beard', 'beard', 'beard'])
    strip(state, cpu, 'defuse')
    seatTurn(state, HUMAN)
    const before = handIds(state, cpu)
    const out = actOn(state, HUMAN, { type: 'three', title: 'beard', target: cpu, name: 'defuse' })
    expect(out.events.at(-1)).toEqual({ type: 'Asked', from: HUMAN, to: cpu, title: 'defuse', hit: false })
    expect(handIds(out.state, cpu)).toEqual(before)
  })

  it('E44 three naming tacocat takes that card', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['beard', 'beard', 'beard'])
    replaceHand(state, cpu, ['skip', 'tacocat'])
    const card = state.seats[cpu]?.hand.find((item) => item.face.title === 'tacocat')
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'three', title: 'beard', target: cpu, name: 'tacocat' })
    expect(out.events.at(-1)).toMatchObject({ type: 'Asked', hit: true, card: { id: card?.id } })
    expect(handIds(out.state, HUMAN)).toContain(card?.id)
  })

  it('E45 two Skips as a pair steal and do not skip', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['skip', 'skip'])
    replaceHand(state, cpu, ['tacocat'])
    seatTurn(state, HUMAN, 5)
    const out = actOn(state, HUMAN, { type: 'pair', title: 'skip', target: cpu })
    expect(out.events.some((event) => event.type === 'Stole')).toBe(true)
    expect(out.state.owed).toBe(5)
    expect(out.state.turn).toBe(HUMAN)
    expect(out.state.pending).toEqual({ kind: 'turn', seat: HUMAN })
  })

  it('E46 five titles take a discarded defuse into the hand', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['attack', 'skip', 'shuffle', 'future', 'tacocat'])
    const prize = take(state, 'defuse')
    state.discard.push(prize)
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'five', titles: ['tacocat', 'attack', 'future', 'skip', 'shuffle'], takeId: prize.id })
    const played = out.events.find((event) => event.type === 'Played')
    expect(played).toMatchObject({ effect: { type: 'five', titles: ['attack', 'skip', 'shuffle', 'future', 'tacocat'], takeId: prize.id } })
    const took = out.events.find((event) => event.type === 'Took')
    expect(took).toMatchObject({ type: 'Took', seat: HUMAN, card: { id: prize.id, face: { title: 'defuse' } } })
    expect(handIds(out.state, HUMAN)).toEqual([prize.id])
  })

  it('E47 a discarded kitten taken by five stays in the hand and is not a turn play', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['attack', 'skip', 'shuffle', 'future', 'tacocat'])
    const kitten = take(state, 'kitten')
    state.discard.push(kitten)
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'five', titles: ['attack', 'skip', 'shuffle', 'future', 'tacocat'], takeId: kitten.id })
    expect(handIds(out.state, HUMAN)).toEqual([kitten.id])
    expect(out.state.seats[HUMAN]?.alive).toBe(true)
    expect(ek.legalActions(out.state, HUMAN).some((action) => action.type === 'play' && String(action.title) === 'kitten')).toBe(false)
  })

  it('E48 five with a repeated title throws', () => {
    const state = lab()
    replaceHand(state, HUMAN, ['attack', 'skip', 'shuffle', 'future', 'tacocat'])
    const prize = take(state, 'defuse')
    state.discard.push(prize)
    seatTurn(state, HUMAN)
    rejects(state, HUMAN, { type: 'five', titles: ['attack', 'attack', 'skip', 'shuffle', 'future'], takeId: prize.id })
  })

  it('E49 a takeId outside the discard and the five throws', () => {
    const state = lab()
    replaceHand(state, HUMAN, ['attack', 'skip', 'shuffle', 'future', 'tacocat'])
    const hidden = state.seats[cpu]?.hand[0]
    if (!hidden) throw new Error('missing card')
    seatTurn(state, HUMAN)
    rejects(state, HUMAN, { type: 'five', titles: ['attack', 'skip', 'shuffle', 'future', 'tacocat'], takeId: hidden.id })
  })

  it('E50 a Noped five leaves takeId in the discard', () => {
    const state = lab()
    silence(state)
    give(state, cpu, 'nope')
    replaceHand(state, HUMAN, ['attack', 'skip', 'shuffle', 'future', 'tacocat'])
    const prize = take(state, 'defuse')
    state.discard.push(prize)
    seatTurn(state, HUMAN)
    const cast = actOn(state, HUMAN, { type: 'five', titles: ['attack', 'skip', 'shuffle', 'future', 'tacocat'], takeId: prize.id })
    const out = actOn(cast.state, cpu, { type: 'nope' })
    expect(out.state.discard.some((card) => card.id === prize.id)).toBe(true)
    expect(handIds(out.state, HUMAN)).not.toContain(prize.id)
  })

  it('E51 two tacocats are a steal', () => {
    const state = lab()
    silence(state)
    replaceHand(state, HUMAN, ['tacocat', 'tacocat'])
    replaceHand(state, cpu, ['beard'])
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'pair', title: 'tacocat', target: cpu })
    expect(out.events.some((event) => event.type === 'Stole')).toBe(true)
    expect(titlesOf(out.state.seats[HUMAN]?.hand ?? [])).toContain('beard')
  })

  it('E52 a held kitten is not the one that explodes', () => {
    const bare = lab()
    silence(bare)
    strip(bare, HUMAN, 'defuse')
    const drawn = take(bare, 'kitten')
    const held = take(bare, 'kitten')
    bare.draw.unshift(drawn)
    bare.seats[HUMAN]?.hand.push(held)
    seatTurn(bare, HUMAN)
    const died = actOn(bare, HUMAN, { type: 'draw' })
    const exploded = died.events.find((event) => event.type === 'Exploded')
    expect(exploded).toMatchObject({ type: 'Exploded', kitten: { id: drawn.id } })
    if (exploded?.type === 'Exploded') expect(exploded.hand.map((card) => card.id)).toContain(held.id)

    const safe = lab()
    silence(safe)
    if (!holds(safe, HUMAN, 'defuse')) give(safe, HUMAN, 'defuse')
    const next = take(safe, 'kitten')
    const kept = take(safe, 'kitten')
    safe.draw.unshift(next)
    safe.seats[HUMAN]?.hand.push(kept)
    seatTurn(safe, HUMAN)
    const pending = actOn(safe, HUMAN, { type: 'draw' })
    expect(handIds(pending.state, HUMAN)).toContain(kept.id)
    expect(pending.state.seats[HUMAN]?.alive).toBe(true)
    const back = actOn(pending.state, HUMAN, { type: 'defuse', index: 0 })
    expect(handIds(back.state, HUMAN)).toContain(kept.id)
    expect(back.state.draw[0]?.id).toBe(next.id)
    expect(back.state.seats[HUMAN]?.alive).toBe(true)
  })
})

describe('conservation, privacy, illegal plays', () => {
  it('E54 a CPU defuse payload hides the index, the draw, and the rest of the hand', () => {
    const state = lab(3)
    silence(state)
    setTop(state, 'kitten')
    if (!holds(state, cpu, 'defuse')) give(state, cpu, 'defuse')
    seatTurn(state, cpu)
    const drawn = actOn(state, cpu, { type: 'draw' })
    const low = actOn(drawn.state, cpu, { type: 'defuse', index: 0 })
    const high = actOn(drawn.state, cpu, { type: 'defuse', index: 4 })
    expect(low.events).toEqual(high.events)
    expect(types(low.events)).toEqual(['Defused'])
    expect(ek.view(low.state, HUMAN)).toEqual(ek.view(high.state, HUMAN))
    expect(low.state.draw.map((card) => card.id)).not.toEqual(high.state.draw.map((card) => card.id))
    const human = ek.view(low.state, HUMAN)
    expect(human.plantedIndex).toBeNull()
    expect(human.knownTop).toEqual([])
    const payload = { events: [...drawn.events, ...low.events], view: human }
    expect(keyHits(payload, 'index')).toEqual([])
    expect(keyHits(payload, 'draw')).toEqual([])
    const hidden = low.state.seats[cpu]?.hand.map((card) => card.id) ?? []
    const blob = JSON.stringify(payload)
    for (const id of hidden) expect(blob).not.toContain(`"${id}"`)
    expect(payload.events.some((event) => event.type === 'DrewKitten' || event.type === 'Defused')).toBe(true)
  })

  it('E55 a CPU See the Future stays off the human view', () => {
    const state = lab()
    silence(state)
    buryKittens(state)
    replaceHand(state, cpu, ['future'])
    seatTurn(state, cpu)
    const out = actOn(state, cpu, { type: 'play', title: 'future' })
    expect(out.events.at(-1)).toEqual({ type: 'Peeked', seat: cpu, count: 3 })
    expect(JSON.stringify(out.events.at(-1))).not.toContain('face')
    expect(ek.view(out.state, HUMAN).knownTop).toEqual([])
    expect(ek.view(out.state, HUMAN).plantedIndex).toBeNull()
    expect(ek.view(out.state, cpu).knownTop).toHaveLength(3)
  })

  it('E56 draw during nope, give, or defuse throws', () => {
    const nope = playable(lab(), HUMAN, 'attack')
    give(nope, cpu, 'nope')
    const opened = actOn(nope, HUMAN, { type: 'play', title: 'attack' })
    rejects(opened.state, cpu, { type: 'draw' })

    const favor = lab()
    silence(favor)
    replaceHand(favor, HUMAN, ['favor'])
    replaceHand(favor, cpu, ['tacocat', 'beard'])
    seatTurn(favor, HUMAN)
    const giving = actOn(favor, HUMAN, { type: 'favor', target: cpu })
    rejects(giving.state, cpu, { type: 'draw' })

    const drawn = lab()
    setTop(drawn, 'kitten')
    if (!holds(drawn, HUMAN, 'defuse')) give(drawn, HUMAN, 'defuse')
    seatTurn(drawn, HUMAN)
    const pending = actOn(drawn, HUMAN, { type: 'draw' })
    rejects(pending.state, HUMAN, { type: 'draw' })
  })

  it('E57 a Nope with none in hand throws', () => {
    const state = playable(lab(), HUMAN, 'attack')
    give(state, cpu, 'nope')
    const opened = actOn(state, HUMAN, { type: 'play', title: 'attack' })
    strip(opened.state, cpu, 'nope')
    rejects(opened.state, cpu, { type: 'nope' })
  })

  it('E58 a play of a title the hand does not hold throws', () => {
    const state = lab()
    strip(state, HUMAN, 'future')
    seatTurn(state, HUMAN)
    rejects(state, HUMAN, { type: 'play', title: 'future' })
  })

  it('E59 an action from a seat who is not to act throws and the state is unchanged', () => {
    const state = lab()
    seatTurn(state, HUMAN)
    const before = structuredClone(state)
    rejects(state, cpu, { type: 'draw' })
    expect(state).toEqual(before)
  })

  it('E60 both piles empty draws a null card and nobody dies', () => {
    const state = lab()
    state.removed.push(...state.draw, ...state.discard)
    state.draw = []
    state.discard = []
    seatTurn(state, HUMAN, 0)
    const out = actOn(state, HUMAN, { type: 'draw' })
    expect(out.events).toEqual([{ type: 'Drew', seat: HUMAN, card: null }])
    expect(out.state.seats[HUMAN]?.alive).toBe(true)
    expect(out.state.turn).toBe(cpu)
    expect(out.state.owed).toBe(0)
  })

  it('E61 an empty draw shuffles the discard in and clears known', () => {
    const state = lab()
    const pile = state.draw.filter((card) => card.face.title !== 'kitten').slice(0, 4)
    state.removed.push(...state.draw.filter((card) => !pile.includes(card)))
    state.draw = []
    state.discard = pile
    const knownTop = pile[0]
    if (!knownTop) throw new Error('reshuffle pile is empty')
    state.known[HUMAN] = { top: [knownTop.id], planted: 2 }
    state.known[cpu] = { top: [], planted: 1 }
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'draw' }, createRng('reshuffle'))
    expect(out.events[0]).toEqual({ type: 'Reshuffled', count: 4 })
    expect(out.events[1]?.type).toBe('Drew')
    expect(out.state.draw).toHaveLength(3)
    expect(out.state.discard).toEqual([])
    expect(out.state.known[HUMAN]).toEqual({ top: [], planted: null })
    expect(out.state.known[cpu]).toEqual({ top: [], planted: null })
    expect(JSON.stringify(out.events[0])).not.toContain('exploding-kittens-')
  })

  it('E62 an empty hand may still draw', () => {
    const state = lab()
    buryKittens(state)
    replaceHand(state, HUMAN, [])
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'draw' })
    expect(types(out.events)).toEqual(['Drew'])
    expect(out.state.seats[HUMAN]?.hand).toHaveLength(1)
    expect(out.state.seats[HUMAN]?.alive).toBe(true)
  })

  it('E63 Won fires on the killing action and a later action throws', () => {
    const state = lab()
    strip(state, HUMAN, 'defuse')
    setTop(state, 'kitten')
    seatTurn(state, HUMAN)
    const out = actOn(state, HUMAN, { type: 'draw' })
    expect(out.events.at(-1)).toEqual({ type: 'Won', seat: cpu })
    rejects(out.state, cpu, { type: 'draw' })
    rejects(out.state, HUMAN, { type: 'draw' })
  })

  it('E64 replay of a pass, a nope, a steal, and a defuse index matches without a policy', () => {
    let seed: string | null = null
    let solo: 'attack' | 'skip' | null = null
    let pair: Title | null = null
    for (let i = 0; i < 2500 && !seed; i++) {
      const session = openSession(`e64-${i}`, 3)
      const counts = new Map<Title, number>()
      for (const card of session.state.seats[HUMAN]?.hand ?? []) counts.set(card.face.title, (counts.get(card.face.title) ?? 0) + 1)
      const pairTitle = TITLE_ORDER.find((title) => (counts.get(title) ?? 0) >= 2 && title !== 'nope' && title !== 'defuse' && title !== 'kitten')
      const soloTitle = (['skip', 'attack'] as const).find((title) => (counts.get(title) ?? 0) >= 1 && (title !== pairTitle || (counts.get(title) ?? 0) >= 3))
      const youNope = counts.get('nope') ?? 0
      if (!pairTitle || !soloTitle || youNope > 0) continue
      if (!holds(session.state, cpu, 'nope') || !holds(session.state, cpu2, 'nope')) continue
      seed = `e64-${i}`
      solo = soloTitle
      pair = pairTitle
    }
    if (!seed || !solo || !pair) throw new Error('no E64 seed')
    const session = openSession(seed, 3)
    const play = (action: EkAction) => {
      const seat = ek.toAct(session.state)
      if (!seat) throw new Error('nobody to act')
      const out = actOn(session.state, seat, action, session.rng)
      session.log.push({ seq: session.log.length, seat, action })
      session.events.push(...out.events)
      session.state = out.state
    }
    play({ type: 'play', title: solo })
    let noped = false
    const pendingKind = () => session.state.pending?.kind as string | undefined
    while (pendingKind() === 'nope') {
      const seat = ek.toAct(session.state)
      if (seat === cpu2 && !noped && holds(session.state, cpu2, 'nope')) {
        play({ type: 'nope' })
        noped = true
      } else play({ type: 'pass' })
    }
    play({ type: 'pair', title: pair, target: cpu })
    while (pendingKind() === 'nope') play({ type: 'pass' })
    let guard = 0
    while (!session.events.some((event) => event.type === 'Defused')) {
      if (guard++ > 500) throw new Error('no defuse in the E64 script')
      const pending = session.state.pending
      const kind = pending?.kind as string | undefined
      if (!pending || !kind) break
      if (kind === 'defuse') play({ type: 'defuse', index: Math.min(1, session.state.draw.length) })
      else if (kind === 'give' && pending.kind === 'give') {
        const card = session.state.seats[pending.seat]?.hand[0]
        if (!card) throw new Error('empty give')
        play({ type: 'give', cardId: card.id })
      } else if (kind === 'nope') play({ type: 'pass' })
      else play({ type: 'draw' })
    }
    expect(session.events.some((event) => event.type === 'Passed')).toBe(true)
    expect(session.events.some((event) => event.type === 'Noped')).toBe(true)
    expect(session.events.some((event) => event.type === 'Stole')).toBe(true)
    expect(session.log.some((record) => record.action.type === 'defuse')).toBe(true)
    const spy = {
      choose() {
        throw new Error('replay ran a policy')
      },
    }
    const rebuilt = replay({ ...rules, policies: { easy: spy, medium: spy, hard: spy } }, {
      seed: session.seed,
      config: session.config,
      seats: soloSeats(rules.definition, session.config),
      log: session.log,
    })
    expect(rebuilt.match.state.draw.map((card) => card.id)).toEqual(session.state.draw.map((card) => card.id))
    expect(session.state.order.map((seat) => rebuilt.match.state.seats[seat]?.hand.map((card) => card.id))).toEqual(
      session.state.order.map((seat) => handIds(session.state, seat)),
    )
    expect(rebuilt.events.filter((event) => event.type !== 'turn')).toEqual(session.events)
  })

  it('E67 a later insert at 0 shifts a planted kitten from 5 to 6', () => {
    const state = lab()
    const older = take(state, 'kitten')
    const newer = take(state, 'kitten')
    const fillers = state.draw.filter((card) => card.face.title !== 'kitten').slice(0, 6)
    state.draw = [...fillers, ...state.draw.filter((card) => !fillers.includes(card) && card.id !== older.id && card.id !== newer.id)]
    const displaced = state.draw[5]
    if (!displaced) throw new Error('draw shorter than 6')
    state.removed.push(displaced)
    state.draw[5] = older
    if (!holds(state, HUMAN, 'defuse')) give(state, HUMAN, 'defuse')
    state.pending = { kind: 'defuse', seat: HUMAN, kitten: newer }
    state.turn = HUMAN
    state.known[HUMAN] = { top: [], planted: 5 }
    const out = actOn(state, HUMAN, { type: 'defuse', index: 0 })
    const view = ek.view(out.state, HUMAN)
    expect(view.knownTop[0]?.face.title).toBe('kitten')
    expect(view.knownTop[0]?.id).toBe(newer.id)
    expect(view.plantedIndex).toBe(6)
    expect(out.state.draw[6]?.id).toBe(older.id)
    expect(view.plantedIndex).not.toBe(0)
  })

  it('E68 lists one five and still accepts a different legal five', () => {
    const state = lab(3)
    silence(state)
    replaceHand(state, HUMAN, ['beard', 'attack', 'skip', 'shuffle', 'future', 'tacocat'])
    strip(state, HUMAN, 'defuse')
    const bottom = take(state, 'defuse')
    const top = take(state, 'defuse')
    const kitten = take(state, 'kitten')
    state.discard = [bottom, kitten, top]
    seatTurn(state, HUMAN)
    const legal = ek.legalActions(state, HUMAN)
    const fives = legal.filter((action) => action.type === 'five')
    expect(fives).toEqual([{ type: 'five', titles: ['attack', 'skip', 'shuffle', 'future', 'tacocat'], takeId: top.id }])
    const withDefuse = structuredClone(state)
    give(withDefuse, HUMAN, 'defuse')
    expect(ek.legalActions(withDefuse, HUMAN).some((action) => action.type === 'five')).toBe(false)
    const listed = fives[0]
    if (!listed) throw new Error('missing five')
    const policy = (menu: EkAction[]) => menu.find((action) => action.type === 'five')
    expect(policy(legal)).toBe(listed)
    const taken = actOn(state, HUMAN, { type: 'five', titles: ['beard', 'tacocat', 'future', 'shuffle', 'skip'], takeId: kitten.id })
    expect(taken.events.some((event) => event.type === 'Took')).toBe(true)
    rejects(state, HUMAN, { type: 'five', titles: ['attack', 'attack', 'skip', 'shuffle', 'future'], takeId: top.id })
  })
})

describe('turn menu', () => {
  it('lists draw, plays, favors, pairs, threes, then one five', () => {
    const state = lab(3)
    silence(state)
    replaceHand(state, HUMAN, ['attack', 'skip', 'favor', 'tacocat', 'tacocat', 'beard', 'beard', 'beard'])
    strip(state, HUMAN, 'defuse')
    const prize = take(state, 'defuse')
    state.discard.push(prize)
    seatTurn(state, HUMAN)
    const threes = [cpu, cpu2].flatMap((target) => TITLE_ORDER.map((name) => ({ type: 'three' as const, title: 'beard' as const, target, name })))
    expect(ek.legalActions(state, HUMAN)).toEqual([
      { type: 'draw' },
      { type: 'play', title: 'attack' },
      { type: 'play', title: 'skip' },
      { type: 'favor', target: cpu },
      { type: 'favor', target: cpu2 },
      { type: 'pair', title: 'tacocat', target: cpu },
      { type: 'pair', title: 'tacocat', target: cpu2 },
      { type: 'pair', title: 'beard', target: cpu },
      { type: 'pair', title: 'beard', target: cpu2 },
      ...threes,
      { type: 'five', titles: ['attack', 'skip', 'favor', 'tacocat', 'beard'], takeId: prize.id },
    ])
  })
})

