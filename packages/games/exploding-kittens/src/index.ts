import { definePlugin } from '@neon-cards/ui'
import { rules } from './rules'
import { ekFace } from './view/face'
import { ekRecap } from './view/recap'
import { ExplodingKittensTable } from './view/Table'

export { rules }
export { ExplodingKittensTable, ekFace, ekRecap }

// The table runs its own playback, so the plugin-level map stays empty.
export const plugin = definePlugin({
  rules,
  Table: ExplodingKittensTable,
  faceRenderer: ekFace,
  juice: {},
  recap: ekRecap,
})
