import type { Effect } from '../rules'

const LINE: Record<Effect['type'], string> = {
  skip: 'Skip',
  attack: 'Attack',
  shuffle: 'Shuffle',
  future: 'Peek',
  favor: 'Favor',
  pair: 'Pair',
  three: 'Ask',
  five: 'Take',
}

/** A few words for the card that was just played, whoever played it. */
export function lineForPlayed(effect: Effect): string {
  return LINE[effect.type]
}
