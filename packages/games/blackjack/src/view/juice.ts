import { chipsFor, type JuiceKit, type JuiceMap } from '@neon-cards/ui'
import type { BlackjackEvent } from '../rules'

type Handlers = {
  [T in BlackjackEvent['type']]?: (event: Extract<BlackjackEvent, { type: T }>, kit: JuiceKit) => void | Promise<void>
}

/** The animatable wrapper of the dealer's hole card. Its slot carries the layout transform, so effects go one level in. */
const holeCard = () => document.querySelector<HTMLElement>('[data-testid="dealer-hand"] .nc-slot:nth-child(2) .nc-fly')

/**
 * Juice for the events that need nothing but the event and the kit. The table adds the moments that
 * depend on what it is showing (the round result, the split slide, the refill).
 */
const handlers: Handlers = {
  deal: (e, kit) => kit.deal(`card-${e.card.id}`),
  async peek(_e, kit) {
    const hole = holeCard()
    if (!hole) return
    kit.sfx('turn')
    await kit.shake('small', hole)
    await kit.wait(60)
  },
  async reveal(e, kit) {
    await kit.flip(`card-${e.card.id}`)
    await kit.wait(260)
  },
  blackjack: (e, kit) => kit.badgePulse(`hand-${e.hand}-total`),
  async dealerBlackjack(_e, kit) {
    kit.sfx('lose')
    await Promise.all([kit.flash('cyan', 'dealer-tray'), kit.shake('small'), kit.badgePulse('dealer-total')])
  },
  async dealerBust(_e, kit) {
    await Promise.all([kit.flash('pink', 'dealer-tray'), kit.badgePulse('dealer-total')])
    await kit.wait(120)
  },
  turn: (_e, kit) => kit.wait(60),
  stand(_e, kit) {
    kit.sfx('click')
    return kit.wait(140)
  },
  async bust(e, kit) {
    kit.sfx('bust')
    await Promise.all([kit.shake('small'), kit.flash('bust', `hand-${e.hand}`), kit.badgePulse(`hand-${e.hand}-total`)])
  },
  async double(e, kit) {
    await kit.chipsToPot(chipsFor(e.amount), { from: 'hud-bankroll', to: 'pot' })
    await kit.wait(120)
  },
}

export const juice = handlers as JuiceMap
