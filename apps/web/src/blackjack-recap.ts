import type { BlackjackView, HandView } from '@neon-cards/game-blackjack/rules'
import type { RoundRecap, RoundSummary } from '@neon-cards/ui'

const word = (hand: HandView) => (hand.status === 'bust' ? 'BUST' : (hand.outcome?.toUpperCase() ?? null))

export function blackjackRecap({ view }: RoundSummary<BlackjackView>): RoundRecap | null {
  if (!view?.hands.length) return null
  const words = view.hands.map(word)
  if (words.includes(null)) return null
  return {
    outcome: words.join(' · '),
    ...(words.includes('BLACKJACK') ? { tone: 'gold' as const } : {}),
    hands: view.hands.map((hand) => hand.cards),
  }
}
