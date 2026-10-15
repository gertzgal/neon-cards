import { defineGuide } from '@neon-cards/ui'
import { rules } from '../rules'

export const guide = defineGuide({
  title: 'EXPLODING KITTENS',
  sections: [
    {
      kind: 'prose',
      id: 'goal',
      title: 'GOAL',
      blocks: [{ kind: 'paragraph', text: [{ text: rules.meta.description }] }],
    },
  ],
})
