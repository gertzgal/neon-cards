import type { CardView, Seat, StandardFace } from '@neon-cards/engine'
import { useState, type ReactNode } from 'react'
import type { OpponentSeatModel } from '../api'
import { NeonRoot } from '../backdrop/neon-root'
import { ScoreBadge, StatusBadge } from '../primitives/badge'
import { PlayingCard } from '../primitives/playing-card'
import { Chip, ChipStack } from '../primitives/chips'
import { ActionBar, BetControls, NeonButton, SegmentedControl } from '../primitives/controls'
import { DealerTray } from '../primitives/dealer-tray'
import { Hand } from '../primitives/hand'
import { Hud } from '../primitives/hud'
import { OpponentRows } from '../primitives/opponent-rows'
import { standardFaceRenderer } from '../primitives/standard-face'
import { PlayerSpot, TableLayout } from '../primitives/table-layout'
import { chipValues } from '../theme/tokens'
import { flip7FaceRenderer, type Flip7Face } from './flip7-face'

let nextId = 0
function std(code: string, faceDown = false): CardView<StandardFace> {
  const rank = code.slice(0, -1) as StandardFace['rank']
  const suit = code.slice(-1) as StandardFace['suit']
  return { id: `s${nextId++}`, deck: 'standard52', face: faceDown ? null : { rank, suit } }
}
function f7(face: Flip7Face): CardView<Flip7Face> {
  return { id: `f${nextId++}`, deck: 'flip7', face }
}
const num = (value: number): CardView<Flip7Face> => f7({ kind: 'number', value })

function useSound() {
  const [on, setOn] = useState(true)
  return { on, toggle: () => setOn((v) => !v) }
}

function BlackjackScene() {
  const sound = useSound()
  return (
    <TableLayout
      hud={<Hud bankroll={1250} sound={sound} onSettings={() => {}} />}
      top={<DealerTray cards={[std('9C'), std('7D', true)]} renderer={standardFaceRenderer} total={9} />}
      middle={<ChipStack chips={[25, 25]} />}
      bottom={
        <PlayerSpot state="active" badge={<ScoreBadge value={16} testId="player-total" />}>
          <Hand cards={[std('8H'), std('8S')]} renderer={standardFaceRenderer} testId="player-hand" state="active" />
        </PlayerSpot>
      }
      controls={
        <ActionBar
          actions={[
            { id: 'hit', label: 'HIT', primary: true },
            { id: 'stand', label: 'STAND' },
            { id: 'double', label: 'DOUBLE' },
            { id: 'split', label: 'SPLIT' },
          ]}
          onAction={() => {}}
        />
      }
    />
  )
}

function BettingScene() {
  const sound = useSound()
  const [pot, setPot] = useState<(typeof chipValues)[number][]>([25, 25])
  const bank = 1250 - pot.reduce<number>((a, b) => a + b, 0)
  return (
    <TableLayout
      hud={<Hud bankroll={bank} sound={sound} onSettings={() => {}} />}
      top={<DealerTray cards={[]} renderer={standardFaceRenderer} placeholder="BLACKJACK PAYS 3:2" />}
      middle={<ChipStack chips={pot} />}
      bottom={null}
      controls={
        <BetControls
          onPick={(v) => setPot((p) => [...p, v])}
          isDisabled={(v) => v > bank}
          onClear={() => setPot([])}
          onDeal={() => {}}
          canClear={pot.length > 0}
          canDeal={pot.length > 0}
        />
      }
    />
  )
}

const ada: Seat = { id: 'cpu1', kind: 'cpu', name: 'ADA', difficulty: 'easy' }
const bix: Seat = { id: 'cpu2', kind: 'cpu', name: 'BIX', difficulty: 'medium' }
const cy: Seat = { id: 'cpu3', kind: 'cpu', name: 'CY-9', difficulty: 'hard' }

function OpponentsScene({ count }: { count: number }) {
  const sound = useSound()
  const all: OpponentSeatModel<Flip7Face>[] = [
    { seat: ada, cards: [num(7), num(3), f7({ kind: 'modifier', op: 'add', value: 4 })], total: 14, status: 'THINKING', state: 'active' },
    { seat: bix, cards: [num(12), num(9)], total: 21, status: 'STAYED', state: 'waiting' },
    { seat: cy, cards: [num(11), num(5), num(11)], total: 27, status: 'BUST', state: 'bust' },
  ]
  const models = all.slice(0, count)
  return (
    <TableLayout
      hud={<Hud bankroll={null} left={<StatusBadge tone="pink">SCORE 112</StatusBadge>} sound={sound} onSettings={() => {}} />}
      top={<OpponentRows seats={models} renderer={flip7FaceRenderer} />}
      middle={<StatusBadge>ADA IS PLAYING</StatusBadge>}
      bottom={
        <PlayerSpot state="waiting" badge={<ScoreBadge value={18} testId="player-total" />}>
          <Hand
            cards={[num(8), f7({ kind: 'action', action: 'secondChance' }), num(6), f7({ kind: 'modifier', op: 'times', value: 2 })]}
            renderer={flip7FaceRenderer}
            testId="player-hand"
          />
        </PlayerSpot>
      }
      controls={
        <ActionBar
          actions={[
            { id: 'hit', label: 'HIT', primary: true, disabled: true },
            { id: 'stay', label: 'STAY', disabled: true },
          ]}
          onAction={() => {}}
          columns={{ phone: 2, desktop: 2 }}
        />
      }
    />
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nc-gallery-section">
      <h2>{title}</h2>
      <div className="nc-gallery-row">{children}</div>
    </section>
  )
}

function SheetScene() {
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const flip7: Flip7Face[] = [
    { kind: 'number', value: 0 },
    { kind: 'number', value: 7 },
    { kind: 'number', value: 12 },
    { kind: 'modifier', op: 'add', value: 10 },
    { kind: 'modifier', op: 'times', value: 2 },
    { kind: 'action', action: 'freeze' },
    { kind: 'action', action: 'flipThree' },
    { kind: 'action', action: 'secondChance' },
  ]
  return (
    <div className="nc-gallery-sheet" data-testid="gallery-sheet">
      <Section title="STANDARD 52">
        {['AS', '10H', 'KC', 'QD', '7S'].map((c) => (
          <PlayingCard key={c} card={std(c)} renderer={standardFaceRenderer} size="tray" />
        ))}
        <PlayingCard card={std('2C', true)} renderer={standardFaceRenderer} size="tray" />
      </Section>
      <Section title="FLIP 7 (GAME-DEFINED FACES)">
        {flip7.map((face, i) => (
          <PlayingCard key={i} card={f7(face)} renderer={flip7FaceRenderer} size="tray" />
        ))}
      </Section>
      <Section title="CHIPS">
        {chipValues.map((v) => (
          <Chip key={v} value={v} size="lg" />
        ))}
        <ChipStack chips={[500, 100, 100, 25, 25, 25, 5, 5]} testId="sheet-pot" />
      </Section>
      <Section title="BADGES">
        <ScoreBadge value={16} />
        <ScoreBadge value="7/17" tone="cyan" />
        <ScoreBadge value={26} state="bust" />
        <ScoreBadge value={21} state="blackjack" />
        <ScoreBadge value={14} size="sm" tone="cyan" />
        <StatusBadge>YOUR TURN</StatusBadge>
        <StatusBadge tone="gold">FLIP 7!</StatusBadge>
      </Section>
      <Section title="BUTTONS">
        <div className="nc-gallery-buttons">
          <NeonButton primary>HIT</NeonButton>
          <NeonButton>STAND</NeonButton>
          <NeonButton tone="cyan">INFO</NeonButton>
          <NeonButton disabled>SPLIT</NeonButton>
        </div>
        <SegmentedControl<typeof difficulty>
          label="DIFFICULTY"
          testId="sheet-difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'easy', label: 'EASY' },
            { value: 'medium', label: 'MEDIUM' },
            { value: 'hard', label: 'HARD' },
          ]}
        />
      </Section>
    </div>
  )
}

export function Gallery({ scene, count }: { scene: string; count: number }) {
  return (
    <NeonRoot>
      <div data-testid={`scene-${scene}`} style={{ position: 'absolute', inset: 0 }}>
        {scene === 'betting' && <BettingScene />}
        {scene === 'opponents' && <OpponentsScene count={count} />}
        {scene === 'sheet' && <SheetScene />}
        {scene === 'table' && <BlackjackScene />}
      </div>
    </NeonRoot>
  )
}
