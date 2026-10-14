import type { BlackjackView, HandView } from '@neon-cards/game-blackjack/rules'
import type { RoundRecap, RoundSummary } from '@neon-cards/ui'

const word = (hand: HandView) => (hand.status === 'bust' ? 'BUST' : (hand.outcome?.toUpperCase() ?? null))

export function blackjackRecap(summary: RoundSummary<BlackjackView>): RoundRecap | null {
  const { view } = summary
  if (!view?.hands.length) return null
  // A forfeited hand never reached an outcome. The row still shows the cards and that it was given up.
  if (summary.forfeit) {
    return { outcome: 'FORFEIT', hands: view.hands.map((hand) => hand.cards) }
  }
  const words = view.hands.map(word)
  if (words.includes(null)) return null
  return {
    outcome: words.join(' · '),
    ...(words.includes('BLACKJACK') ? { tone: 'gold' as const } : {}),
    hands: view.hands.map((hand) => hand.cards),
  }
}
