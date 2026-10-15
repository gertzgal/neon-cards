import { defineGuide } from '@neon-cards/ui'

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
  ],
})
