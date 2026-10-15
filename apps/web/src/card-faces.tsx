import { createRoot } from 'react-dom/client'
import type { Flip7Face } from '@neon-cards/engine'
import { ekFace } from '@neon-cards/game-exploding-kittens'
import type { Title } from '@neon-cards/game-exploding-kittens/rules'
import { flip7Face } from '@neon-cards/game-flip7'
import { NeonRoot, PlayingCard, handLayout, tableMetrics, type Size } from '@neon-cards/ui'
import './styles.css'

const EK: Title[] = [
  'kitten',
  'defuse',
  'nope',
  'attack',
  'skip',
  'favor',
  'shuffle',
  'future',
  'tacocat',
  'hairyPotato',
  'cattermelon',
  'beard',
  'rainbowRalphing',
]

const params = new URLSearchParams(location.search)
const deck = params.get('deck') === 'flip7' ? 'flip7' : 'ek'
const id = params.get('card') ?? (deck === 'ek' ? 'nope' : '7')
const asked = params.get('size')
const size = asked === 'compact' || asked === 'tray' ? asked : 'hand'

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const ADDS = [2, 4, 6, 8, 10] as const

function flipFace(card: string): Flip7Face {
  if (card === 'freeze' || card === 'flipThree' || card === 'secondChance') return { kind: 'action', action: card }
  if (card === 'x2') return { kind: 'modifier', op: 'times', value: 2 }
  const plus = /^p(\d+)$/.exec(card)
  const add = ADDS.find((value) => String(value) === plus?.[1])
  if (add) return { kind: 'modifier', op: 'add', value: add }
  const value = NUMBERS.find((n) => String(n) === card) ?? 7
  return { kind: 'number', value }
}

/**
 * The box a card actually gets in the hand. Exploding Kittens opens at eight cards.
 * Flip 7 numbers share a four-card fan before the hand grows. Modifiers and actions
 * sit in the compact extra row, which is the small card those labels have to survive.
 */
function handBox(kind: 'ek' | 'number' | 'extra'): Size {
  const metrics = tableMetrics(window.innerWidth, window.innerHeight)
  if (kind === 'extra') return metrics.card.compact
  const limit = metrics.phone ? metrics.width - (kind === 'ek' ? 64 : 120) : Math.min(metrics.width * 0.7, 860)
  const count = kind === 'ek' ? 8 : 4
  return handLayout(count, metrics.card.hand, 'fan', limit, 'hand').card
}

function Face() {
  if (deck === 'ek') {
    const title = EK.find((item) => item === id) ?? 'nope'
    return (
      <PlayingCard
        card={{ id: `ek-${title}`, deck: 'exploding-kittens', face: { title } }}
        renderer={ekFace}
        size={size}
        {...(size === 'hand' ? { box: handBox('ek') } : {})}
      />
    )
  }
  const face = flipFace(id)
  const extra = face.kind === 'modifier'
  return (
    <PlayingCard
      card={{ id: `flip7-${id}`, deck: 'flip7', face }}
      renderer={flip7Face}
      size={extra ? 'compact' : size}
      {...(size === 'hand' ? { box: handBox(extra ? 'extra' : 'number') } : {})}
    />
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from card-faces.html')
createRoot(root).render(
  <NeonRoot>
    <div data-testid="card-proof" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <Face />
    </div>
  </NeonRoot>,
)
