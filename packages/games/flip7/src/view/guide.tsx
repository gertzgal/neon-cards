import type { Flip7Face } from '@neon-cards/engine'
import { defineGuide, guideFeltCard, type GuideCardRow } from '@neon-cards/ui'
import { rules } from '../rules'
import { actionSentence, flip7Face } from './face'

const number: Flip7Face = { kind: 'number', value: 7 }
const plus: Flip7Face = { kind: 'modifier', op: 'add', value: 4 }
const times: Flip7Face = { kind: 'modifier', op: 'times', value: 2 }

function row(id: string, name: string, face: Flip7Face): GuideCardRow {
  return {
    id,
    name,
    sentence: actionSentence(face),
    paint: (widthPx) => guideFeltCard({ id: `guide:${id}`, deck: 'flip7', face, renderer: flip7Face, widthPx }),
  }
}

export const guide = defineGuide({
  title: 'FLIP 7',
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
            [{ text: 'FLIP', gold: true }, { text: ' takes one more card.' }],
            [{ text: 'STAY', gold: true }, { text: " banks this round's points." }],
            [{ text: 'Flip a number you already have: ' }, { text: 'bust', gold: true }, { text: ', round scores 0.' }],
          ],
        },
      ],
    },
    {
      kind: 'cards',
      id: 'cards',
      title: 'THE CARDS',
      rows: [
        row('number', 'NUMBER 0\u201312', number),
        row('freeze', 'FREEZE', { kind: 'action', action: 'freeze' }),
        row('flipThree', 'FLIP THREE', { kind: 'action', action: 'flipThree' }),
        row('secondChance', 'SECOND CHANCE', { kind: 'action', action: 'secondChance' }),
        row('add', '+2 TO +10', plus),
        row('times', '\u00d72', times),
      ],
    },
    {
      kind: 'prose',
      id: 'win',
      title: 'WINNING',
      blocks: [
        {
          kind: 'list',
          items: [
            [{ text: 'Seven different numbers in a row: ' }, { text: 'Flip 7', gold: true }, { text: ', round ends.' }],
            [{ text: 'First to ' }, { text: '200', gold: true }, { text: ' at the end of a round wins.' }],
          ],
        },
      ],
    },
  ],
})
