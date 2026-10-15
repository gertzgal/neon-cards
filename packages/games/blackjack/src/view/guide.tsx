import { defineGuide, type GuideCardRow } from '@neon-cards/ui'
import type { BlackjackFace } from '../rules'
import { cardFrameVars } from './Card'
import { BlackjackFaceArt, suitTone } from './face'
import './table.css'

function felt(face: BlackjackFace): GuideCardRow['paint'] {
  return (widthPx) => {
    const height = widthPx / 0.74
    return (
      <div style={{ position: 'relative', width: widthPx, height, flex: 'none', ...cardFrameVars(widthPx, height) }}>
        <div className="bj-card" data-tone={suitTone(face.suit)}>
          <div className="bj-card-in">
            <BlackjackFaceArt face={face} />
          </div>
        </div>
      </div>
    )
  }
}

function row(id: string, name: string, sentence: string, face: BlackjackFace): GuideCardRow {
  return { id, name, sentence, paint: felt(face) }
}

export const guide = defineGuide({
  title: 'BLACKJACK',
  sections: [
    {
      kind: 'prose',
      id: 'goal',
      title: 'GOAL',
      blocks: [
        {
          kind: 'paragraph',
          text: [
            { text: 'Get closer to ' },
            { text: '21', gold: true },
            { text: ' than the dealer. Go over 21 and you bust.' },
          ],
        },
      ],
    },
    {
      kind: 'prose',
      id: 'turn',
      title: 'YOUR TURN',
      blocks: [
        {
          kind: 'list',
          items: [
            [{ text: 'Place a bet, then ' }, { text: 'DEAL', gold: true }, { text: '.' }],
            [
              { text: 'HIT', gold: true },
              { text: ' takes a card. ' },
              { text: 'STAND', gold: true },
              { text: ' keeps your total.' },
            ],
          ],
        },
      ],
    },
    {
      kind: 'cards',
      id: 'cards',
      title: 'THE CARDS',
      rows: [
        row('ace', 'ACE', 'Counts 1 or 11, whichever helps.', { rank: 'A', suit: 'S' }),
        row('face', 'J \u00b7 Q \u00b7 K', 'Every face card counts 10.', { rank: 'K', suit: 'H' }),
        row('number', '2 \u2013 10', 'Number cards count their number.', { rank: '7', suit: 'D' }),
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
            [{ text: "Beat the dealer's total to win your bet." }],
            [{ text: 'Ace + 10 first deal is ' }, { text: 'Blackjack', gold: true }, { text: ': pays 3:2.' }],
            [{ text: 'Dealer stands on all 17s.' }],
          ],
        },
      ],
    },
  ],
})
