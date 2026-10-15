import type { DeckSpec } from '@neon-cards/engine'
import { TITLE_ORDER, type EkFace, type Title } from './types'

export const COUNTS: Record<Title, number> = {
  kitten: 4,
  defuse: 6,
  nope: 5,
  attack: 4,
  skip: 4,
  favor: 4,
  shuffle: 4,
  future: 5,
  tacocat: 4,
  hairyPotato: 4,
  rainbowRalphing: 4,
  beard: 4,
  cattermelon: 4,
}

/** Aria and test labels. The id of a card never carries these words. */
export const FACE_LABEL: Record<Title, string> = {
  kitten: 'EXPLODING KITTEN',
  defuse: 'DEFUSE',
  nope: 'NOPE',
  attack: 'ATTACK',
  skip: 'SKIP',
  favor: 'FAVOR',
  shuffle: 'SHUFFLE',
  future: 'SEE THE FUTURE',
  tacocat: 'TACOCAT',
  hairyPotato: 'HAIRY POTATO CAT',
  rainbowRalphing: 'RAINBOW-RALPHING CAT',
  beard: 'BEARD CAT',
  cattermelon: 'CATTERMELON',
}

export const ekDeck: DeckSpec<EkFace> = {
  id: 'exploding-kittens',
  build() {
    const faces: EkFace[] = []
    for (const title of TITLE_ORDER) {
      const count = COUNTS[title]
      for (let i = 0; i < count; i++) faces.push({ title })
    }
    return faces
  },
}
