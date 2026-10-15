import { defineGuide } from '@neon-cards/ui'
import { rules } from '../rules'

export const guide = defineGuide({
  title: 'FLIP 7',
  sections: [
    {
      kind: 'prose',
      id: 'goal',
      title: 'GOAL',
      blocks: [{ kind: 'paragraph', text: [{ text: rules.meta.description }] }],
    },
  ],
})
