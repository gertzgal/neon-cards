import type { SeatId } from '@neon-cards/engine'
import { showPlayCallout, type JuiceKit, type JuiceMap, type Point } from '@neon-cards/ui'
import type { Flip7Event } from '../rules'
import { lineForCard } from './callout'

export interface JuiceHost {
  human: SeatId
  /** Where each card was on screen just before the event that moved it. */
  before: Map<string, Point>
  /** Turns an opponent's busted line face down once its BUST stamp has landed. The local line stays face up. */
  settleBust(seat: SeatId): void
}

/** The element that stands for a seat: the human's spot, or an opponent's seat box. */
export const seatTarget = (host: Pick<JuiceHost, 'human'>, seat: SeatId) => (seat === host.human ? 'player-spot' : `seat-${seat}`)

const stage = () => document.querySelector<HTMLElement>('.nc-stage')

async function aberrate(kit: JuiceKit, ms: number) {
  const el = stage()
  if (!el || kit.instant || kit.reducedMotion) return
  await el
    .animate(
      [
        { filter: 'none' },
        { filter: 'drop-shadow(5px 0 0 rgba(255,46,136,.85)) drop-shadow(-5px 0 0 rgba(46,242,255,.85))', offset: 0.15 },
        { filter: 'drop-shadow(2px 0 0 rgba(255,46,136,.5)) drop-shadow(-2px 0 0 rgba(46,242,255,.5))', offset: 0.5 },
        { filter: 'none' },
      ],
      { duration: ms, easing: 'ease-out' },
    )
    .finished.catch(() => undefined)
}

/** Maps Flip 7 events to the shared juice. Sized by moment: Flip 7 ≫ Bust > Flip Three > Second Chance save > Freeze > a flip. */
export function createJuice(host: JuiceHost): JuiceMap {
  const from = (id: string) => host.before.get(id) ?? 'draw-pile'
  const at = (seat: SeatId) => seatTarget(host, seat)
  const handlers: { [K in Flip7Event['type']]?: (e: Extract<Flip7Event, { type: K }>, kit: JuiceKit) => void | Promise<void> } = {
    async CardDealt(e, kit) {
      showPlayCallout(lineForCard(e.card.face), 'draw-pile', e.seat)
      await kit.deal(`card-${e.card.id}`, { from: 'draw-pile' })
      if (e.card.face.kind === 'number' && e.seat === host.human) void kit.badgePulse('round-value')
    },
    async Busted(e, kit) {
      kit.sfx('bust')
      void kit.flash('bust', at(e.seat))
      void kit.shake('small')
      await kit.numberPop('BUST', { tone: 'bust', tier: e.seat === host.human ? 'normal' : 'small', at: at(e.seat) })
      host.settleBust(e.seat)
    },
    async Stayed(e, kit) {
      kit.sfx('chip')
      await kit.badgePulse(e.seat === host.human ? 'round-value' : `seat-${e.seat}-total`)
    },
    async SecondChanceGained(e, kit) {
      kit.sfx('flip')
      await kit.deal(`card-${e.card.id}`, { from: from(e.card.id) })
    },
    async SecondChancePassed(e, kit) {
      kit.sfx('flip')
      await kit.deal(`card-${e.card.id}`, { from: from(e.card.id) })
    },
    SecondChanceDiscarded(_e, kit) {
      kit.sfx('lose')
    },
    async SecondChanceUsed(e, kit) {
      void kit.flash('bust', at(e.seat))
      await kit.wait(140)
      kit.sfx('win')
      void kit.shake('small', at(e.seat))
      await kit.flash('pink', at(e.seat))
    },
    async ActionTargeted(e, kit) {
      kit.sfx('turn')
      await kit.badgePulse(at(e.to))
    },
    async Frozen(e, kit) {
      kit.sfx('push')
      void kit.deal(`card-${e.card.id}`, { from: from(e.card.id) })
      await kit.flash('cyan', at(e.seat))
    },
    async FlipThreeStarted(e, kit) {
      kit.sfx('turn')
      void kit.flash('violet', at(e.seat))
      void kit.shake('small', at(e.seat))
      await kit.badgePulse('flip3-pips')
    },
    async CardSetAside(e, kit) {
      await kit.deal(`card-${e.card.id}`, { from: from(e.card.id) })
    },
    SetAsideDiscarded(_e, kit) {
      kit.sfx('lose')
    },
    ActionDiscarded(_e, kit) {
      kit.sfx('lose')
    },
    async Flip7Achieved(e, kit) {
      // Hitstop, light the seven slots in a run, then the one big moment of the game.
      await kit.wait(120)
      if (e.seat === host.human) {
        for (let i = 0; i < 7; i++) {
          void kit.badgePulse(`slot-${i}`)
          kit.sfx('click')
          await kit.wait(55)
        }
      } else {
        void kit.badgePulse(`seat-${e.seat}`)
      }
      kit.sfx('blackjack')
      void kit.shake('big')
      void kit.flash('gold')
      void aberrate(kit, 520)
      void kit.numberPop('+15', { tier: 'normal', tone: 'gold', at: at(e.seat) })
      await kit.numberPop('FLIP 7!', { tier: 'big', tone: 'gold' })
    },
    async DeckReshuffled(_e, kit) {
      kit.sfx('flip')
      await kit.shake('small', 'draw-pile')
      kit.sfx('flip')
    },
    async RoundScored(e, kit) {
      const mine = e.scores.find((s) => s.seat === host.human)
      for (const s of e.scores) {
        if (s.seat === host.human || s.busted || s.round === 0) continue
        void kit.badgePulse(`seat-${s.seat}-total`)
      }
      if (mine && !mine.busted && mine.round > 0) {
        kit.sfx('win')
        await kit.badgePulse('hud-total')
      }
      await kit.wait(200)
    },
    async TiebreakRound(_e, kit) {
      kit.sfx('turn')
      await kit.flash('gold', 'draw-pile')
    },
    async GameWon(e, kit) {
      kit.sfx('blackjack')
      void kit.flash('gold')
      await kit.numberPop(String(e.total), { tier: 'big', tone: e.seat === host.human ? 'gold' : 'cyan', at: at(e.seat) })
    },
  }
  return handlers as JuiceMap
}
