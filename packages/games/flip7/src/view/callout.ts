import type { Flip7Face } from '@neon-cards/engine'

/** A few words for the card that just landed, whoever it landed on. */
export function lineForCard(face: Flip7Face): string {
  if (face.kind === 'number') return String(face.value)
  if (face.kind === 'modifier') return face.op === 'add' ? `Plus ${face.value}` : 'Times two'
  if (face.action === 'freeze') return 'Freeze'
  if (face.action === 'flipThree') return 'Three flips'
  return 'Second chance'
}
