import type { RoundRecap, RoundSummary } from '@neon-cards/ui'
import type { EkFace, EkView } from '../rules'

export function ekRecap(summary: RoundSummary<EkView>): RoundRecap<EkFace> | null {
  const view = summary.view
  if (!view?.winner) return null
  if (view.winner === view.me) return { outcome: 'WIN', tone: 'gold' }
  return { outcome: 'LOSE', tone: 'bust' }
}
