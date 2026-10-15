import { defineGuide, guideFeltCard, type GuideCardRow } from '@neon-cards/ui'
import { rules } from '../rules'
import { FACE_LABEL } from '../rules/deck'
import { TITLE_ORDER, type Title } from '../rules/types'
import { scenes } from './art'
import { ekFace } from './face'

function row(title: Title): GuideCardRow {
  return {
    id: title,
    name: FACE_LABEL[title],
    sentence: scenes[title].rule,
    paint: (widthPx) =>
      guideFeltCard({
        id: `guide:${title}`,
        deck: 'exploding-kittens',
        face: { title },
        renderer: ekFace,
        widthPx,
      }),
  }
}

export const guide = defineGuide({
  title: 'EXPLODING KITTENS',
  sections: [
    {
      kind: 'prose',
      id: 'goal',
      title: 'GOAL',
      blocks: [{ kind: 'paragraph', text: [{ text: rules.meta.description }] }],
    },
    {
      kind: 'prose',
      id: 'turn',
      title: 'YOUR TURN',
      blocks: [
        {
          kind: 'list',
          items: [
            [{ text: 'Play as many cards as you like, or none.' }],
            [{ text: 'End your turn by ' }, { text: 'drawing one card', gold: true }, { text: '.' }],
            [{ text: 'Drew a kitten? Play a ' }, { text: 'Defuse', gold: true }, { text: " or you're out." }],
          ],
        },
      ],
    },
    {
      kind: 'cards',
      id: 'cards',
      title: 'THE CARDS',
      rows: TITLE_ORDER.map(row),
    },
    {
      kind: 'prose',
      id: 'win',
      title: 'WINNING',
      blocks: [
        {
          kind: 'list',
          items: [[{ text: 'Everyone else exploded? ' }, { text: 'You win.', gold: true }]],
        },
      ],
    },
  ],
})
