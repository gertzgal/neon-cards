import type { SeatId } from '@neon-cards/engine'
import { showPlayCallout, type JuiceKit, type JuiceMap } from '@neon-cards/ui'
import type { EkEvent } from '../rules'
import { lineForPlayed } from './callout'

export const seatTarget = (human: SeatId, seat: SeatId) => (seat === human ? 'player-spot' : `seat-${seat}`)

/** Juice words on the table are NOPE and BOOM. Everything else is a sound, a flash, or a digit. */
export function createJuice(human: SeatId): JuiceMap {
  const at = (seat: SeatId) => seatTarget(human, seat)
  const handlers: {
    [K in EkEvent['type']]?: (event: Extract<EkEvent, { type: K }>, kit: JuiceKit) => void | Promise<void>
  } = {
    async Played(event, kit) {
      showPlayCallout(lineForPlayed(event.effect), at(event.seat), event.seat)
      for (const card of event.cards) await kit.deal(`card-${card.id}`, { from: at(event.seat) })
    },
    async Noped(event, kit) {
      kit.sfx('push')
      void kit.flash('pink')
      await kit.deal(`card-${event.card.id}`, { from: at(event.seat) })
      await kit.numberPop('NOPE', { tier: 'normal', tone: 'pink' })
    },
    async Exploded(event, kit) {
      kit.sfx('bust')
      void kit.flash('bust')
      void kit.shake('big')
      await kit.flip(`card-${event.kitten.id}`)
      await kit.numberPop('BOOM', { tier: 'big', tone: 'bust' })
    },
    async Defused(event, kit) {
      kit.sfx('win')
      void kit.flash('cyan')
      await kit.deal(`card-${event.defuse.id}`, { from: at(event.seat) })
      await kit.deal(`card-${event.kitten.id}`, { from: at(event.seat) })
    },
    async DrewKitten(event, kit) {
      kit.sfx('flip')
      await kit.flip(`card-${event.card.id}`)
    },
    async Drew(event, kit) {
      if (event.card) await kit.deal(`card-${event.card.id}`, { from: 'draw' })
    },
    async Attacked(event, kit) {
      void kit.flash('violet', at(event.to))
      void kit.badgePulse(event.to === human ? 'owed' : `seat-${event.to}-total`)
      await kit.numberPop(String(event.owed), { tone: 'violet', at: at(event.to) })
    },
    async Won(event, kit) {
      kit.sfx('blackjack')
      void kit.flash(event.seat === human ? 'gold' : 'cyan')
      void kit.shake('big')
      await kit.badgePulse('game-over')
    },
    async Shuffled(_event, kit) {
      kit.sfx('flip')
      await kit.shake('small', 'draw')
    },
    async Reshuffled(_event, kit) {
      kit.sfx('flip')
      await kit.shake('small', 'draw')
    },
    async Took(event, kit) {
      await kit.deal(`card-${event.card.id}`, { from: 'discard' })
    },
    async Asked(event, kit) {
      if (event.hit) await kit.deal(`card-${event.card.id}`, { from: at(event.to) })
    },
  }
  return handlers as JuiceMap
}
