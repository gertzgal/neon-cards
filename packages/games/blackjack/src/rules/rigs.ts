import { parseFace, type BlackjackFace } from './cards'

// Dev-only stacked shoes, in deal order: player, dealer up, player, dealer hole, then draws.
// Names match the prototype's ?rig= scenarios so e2e specs and manual testing share them.
export const RIGS = {
  blackjack: ['AH', '9C', 'KS', '7D'],
  bust: ['10H', '9C', '6S', '7D', 'KC'],
  win: ['10H', '9C', '9S', '8D', '5C'],
  lose: ['10H', '10C', '7S', '9D'],
  push: ['10H', '10C', '8S', '8D'],
  split: ['8H', '9C', '8S', '7D', '3C', '10D', '2S', 'KH'],
  splitaces: ['AH', '9C', 'AS', '7D', 'KC', 'QD', '2S'],
  dealerbj: ['10H', 'AS', '9S', 'KD'],
  bjpush: ['AH', 'AS', 'KS', 'KD'],
  double: ['6H', '9C', '5S', '7D', '10C', '2S'],
  dealerbust: ['10H', '6C', '6S', '10D', '9C'],
  soft17: ['10H', 'AC', '8S', '6D', '5C'],
} as const satisfies Record<string, readonly string[]>

export type RigName = keyof typeof RIGS

// Accepts a rig name or a comma-separated card list such as "AH,9C,KS,7D".
export function rigFaces(rig: string): BlackjackFace[] {
  const named = (RIGS as Record<string, readonly string[]>)[rig.toLowerCase()]
  const codes = named ?? rig.split(',').map((c) => c.trim()).filter(Boolean)
  return codes.map(parseFace)
}
