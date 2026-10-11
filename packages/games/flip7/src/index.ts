import { definePlugin } from '@neon-cards/ui'
import { rules } from './rules'
import { flip7Face } from './view/face'
import { Flip7Table } from './view/Table'

export { rules }
export { Flip7Table, flip7Face }

// The table runs its own playback with its own juice map, so the plugin-level map stays empty.
export const plugin = definePlugin({ rules, Table: Flip7Table, faceRenderer: flip7Face, juice: {} })
