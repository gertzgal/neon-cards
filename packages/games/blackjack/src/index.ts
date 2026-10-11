import { definePlugin, standardFaceRenderer } from '@neon-cards/ui'
import { rules } from './rules'
import { BlackjackTable, juice } from './view'

export * from './rules'
export * from './view'

export const plugin = definePlugin({ rules, Table: BlackjackTable, faceRenderer: standardFaceRenderer, juice })
