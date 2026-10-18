import { useLayoutEffect, type ReactNode } from 'react'
import type { CardView, Rank, Seat, StandardFace, Suit } from '@neon-cards/engine'
import { ekFace } from '@neon-cards/game-exploding-kittens'
import type { EkFace, Title } from '@neon-cards/game-exploding-kittens/rules'
import {
  GearIcon,
  Hud,
  IconButton,
  NeonButton,
  NeonRoot,
  PlayingCard,
  ScoreBadge,
  SeatCaption,
  SoundIcon,
  standardFaceRenderer,
  useTableMetrics,
  type CardFaceRenderer,
  type Size,
} from '@neon-cards/ui'
import { BookIcon } from '../shell/icons'
import type { SceneId } from './scenes'

type Kind = Seat['kind']

interface Person {
  id: string
  name: string
  kind: Kind
}

const ash: Person = { id: 's0', name: 'Ash', kind: 'human' }
const mira: Person = { id: 's1', name: 'Mira', kind: 'human' }
const nova: Person = { id: 's2', name: 'Nova', kind: 'human' }
const pip: Person = { id: 's3', name: 'Pip', kind: 'cpu' }
const jules: Person = { id: 's3', name: 'Jules', kind: 'human' }

function ekCard(id: string, title: Title | null): CardView<EkFace> {
  return { id, deck: 'exploding-kittens', face: title === null ? null : { title } }
}

function backs(seat: string, count: number): CardView<EkFace>[] {
  return Array.from({ length: count }, (_, i) => ekCard(`${seat}-back-${i}`, null))
}

function std(id: string, rank: Rank, suit: Suit): CardView<StandardFace> {
  return { id, deck: 'standard52', face: { rank, suit } }
}

function hole(id: string): CardView<StandardFace> {
  return { id, deck: 'standard52', face: null }
}

interface Boxes {
  phone: boolean
  gap: number
  seat: Size
  hand: Size
  pile: Size
}

function boxesFor(width: number, height: number): Boxes {
  const phone = width <= 699
  const tight = phone && height <= 700
  if (tight) return { phone, gap: 4, seat: { w: 28, h: 38 }, hand: { w: 44, h: 60 }, pile: { w: 40, h: 54 } }
  if (phone) return { phone, gap: 6, seat: { w: 34, h: 46 }, hand: { w: 56, h: 76 }, pile: { w: 48, h: 64 } }
  if (height <= 800) return { phone, gap: 8, seat: { w: 44, h: 60 }, hand: { w: 74, h: 100 }, pile: { w: 66, h: 90 } }
  return { phone, gap: 8, seat: { w: 52, h: 70 }, hand: { w: 92, h: 124 }, pile: { w: 80, h: 108 } }
}

function fitWidth(card: Size, count: number, maxW: number, gap: number): Size {
  if (count <= 1) return card
  const gaps = gap * (count - 1)
  const w = Math.max(18, Math.min(card.w, Math.floor((maxW - gaps) / Math.max(1, count))))
  return { w, h: Math.max(24, Math.round((w * card.h) / card.w)) }
}

function CardRow<Face>({
  cards,
  renderer,
  box,
  selected,
}: {
  cards: readonly CardView<Face>[]
  renderer: CardFaceRenderer<Face>
  box: Size
  selected?: readonly string[]
}) {
  return (
    <div className="ux-cards">
      {cards.map((card) => (
        <div key={card.id} className="ux-card" data-region={`card-${card.id}`} data-selected={selected?.includes(card.id) ? 'true' : 'false'}>
          <PlayingCard card={card} renderer={renderer} box={box} />
        </div>
      ))}
    </div>
  )
}

function SeatRow<Face>({
  person,
  cards,
  renderer,
  box,
  badge,
  status,
  pick,
  points,
  state,
}: {
  person: Person
  cards: readonly CardView<Face>[]
  renderer: CardFaceRenderer<Face>
  box: Size
  badge?: number | null
  status?: string
  pick?: boolean
  points?: string
  state?: 'idle' | 'active' | 'out'
}) {
  return (
    <div
      className="nc-seat ux-seat"
      data-region={`seat-${person.id}`}
      data-testid={`seat-${person.id}`}
      data-state={state ?? 'idle'}
      data-kind={person.kind}
      data-pick={pick ? 'true' : 'false'}
    >
      <div className="ux-seat-id">
        <SeatCaption seat={person} />
        {points !== undefined && (
          <span className="ux-points" data-region={`points-${person.id}`} data-testid={`seat-${person.id}-score`}>
            {points}
          </span>
        )}
      </div>
      <CardRow cards={cards} renderer={renderer} box={box} />
      {badge !== undefined && badge !== null && (
        <div data-region={`total-${person.id}`}>
          <ScoreBadge value={badge} tone="cyan" size="sm" testId={`seat-${person.id}-total`} />
        </div>
      )}
      {status && (
        <span className="ux-status" data-testid={`seat-${person.id}-status`}>
          {status}
        </span>
      )}
    </div>
  )
}

function Stack<Face>({ id, card, renderer, box, count }: { id: string; card: CardView<Face>; renderer: CardFaceRenderer<Face>; box: Size; count?: number }) {
  return (
    <div className="ux-pile" data-region={id} data-testid={id}>
      <PlayingCard card={card} renderer={renderer} box={box} />
      {count !== undefined && <span className="ux-count">{count}</span>}
    </div>
  )
}

function Timer({ seconds, label }: { seconds: number; label: string }) {
  return (
    <div className="ux-timer" data-region="timer" data-testid="turn-timer" data-seconds={seconds} data-label={label}>
      <ScoreBadge value={seconds} tone="pink" size="sm" testId="turn-timer-value" />
      <span className="ux-timer-label">{label}</span>
    </div>
  )
}

function Actions({ reason, labels }: { reason?: string; labels: readonly { id: string; text: string; primary?: boolean; disabled?: boolean }[] }) {
  if (!reason && labels.length === 0) return null
  return (
    <div className="ux-controls">
      {reason && (
        <p className="ux-reason" data-region="reason" data-testid="play-reason">
          {reason}
        </p>
      )}
      {labels.length > 0 && (
        <div className="ux-actions">
          {labels.map((action) => (
            <div key={action.id} className="ux-action" data-region={`action-${action.id}`}>
              <NeonButton
                testId={`action-${action.id}`}
                ariaLabel={action.text}
                {...(action.primary === true ? { primary: true } : {})}
                {...(action.disabled === true ? { disabled: true } : {})}
              >
                {action.text}
              </NeonButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Bar({ nickname, hostDeal }: { nickname: string; hostDeal?: boolean }) {
  return (
    <div className="room-chips" data-testid="room-bar">
      <span className="room-chip" data-region="room-code" data-testid="room-code">
        K7NP
      </span>
      <span className="room-chip" data-region="nickname" data-testid="nickname">
        {nickname}
      </span>
      <span className="room-chip" data-region="spectator-count" data-testid="spectator-count">
        1
      </span>
      {hostDeal && (
        <span className="room-chip main" data-region="room-deal" data-testid="room-deal">
          Deal
        </span>
      )}
      <span className="room-chip" data-region="room-leave" data-testid="room-leave">
        Leave
      </span>
    </div>
  )
}

function Frame({
  scene,
  score,
  nickname,
  hostDeal,
  seats,
  middle,
  you,
  actions,
}: {
  scene: SceneId
  score: number
  nickname: string
  hostDeal?: boolean
  seats: ReactNode
  middle: ReactNode
  you: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="ux-screen" data-testid="ux-preview" data-scene={scene}>
      <div data-region="hud">
        <Hud
          bankroll={null}
          left={
            <div className="nc-pill nc-bankroll" data-region="score" data-testid="hud-score" data-value={score}>
              {score}
            </div>
          }
          center={<Bar nickname={nickname} {...(hostDeal === true ? { hostDeal: true } : {})} />}
          right={
            <div className="ux-icons" data-region="hud-icons">
              <IconButton label="How to play" testId="hud-guide" onClick={() => undefined}>
                <BookIcon />
              </IconButton>
              <IconButton label="Mute" testId="hud-sound" onClick={() => undefined}>
                <SoundIcon on />
              </IconButton>
              <IconButton label="Settings" testId="hud-settings" onClick={() => undefined}>
                <GearIcon />
              </IconButton>
            </div>
          }
        />
      </div>
      <div className="ux-seats">{seats}</div>
      <div className="ux-middle">{middle}</div>
      {you}
      {actions}
    </div>
  )
}

const hand = [
  ekCard('h-skip', 'skip'),
  ekCard('h-attack', 'attack'),
  ekCard('h-favor', 'favor'),
  ekCard('h-nope', 'nope'),
  ekCard('h-taco', 'tacocat'),
]

function EkSeats({
  box,
  miraCount,
  novaCount,
  pipCount,
  miraCards,
  novaCards,
  pipCards,
  miraBadge,
  novaBadge,
  pipBadge,
  miraState,
  novaState,
  pipState,
  miraStatus,
  novaStatus,
  pipStatus,
  miraPick,
  novaPick,
  pipPick,
}: {
  box: Size
  miraCount: number
  novaCount: number
  pipCount: number
  miraCards?: CardView<EkFace>[]
  novaCards?: CardView<EkFace>[]
  pipCards?: CardView<EkFace>[]
  miraBadge?: number | null
  novaBadge?: number | null
  pipBadge?: number | null
  miraState?: 'idle' | 'active' | 'out'
  novaState?: 'idle' | 'active' | 'out'
  pipState?: 'idle' | 'active' | 'out'
  miraStatus?: string
  novaStatus?: string
  pipStatus?: string
  miraPick?: boolean
  novaPick?: boolean
  pipPick?: boolean
}) {
  return (
    <>
      <SeatRow
        person={mira}
        cards={miraCards ?? backs('mira', miraCount)}
        renderer={ekFace}
        box={box}
        badge={miraBadge === undefined ? miraCount : miraBadge}
        {...(miraState ? { state: miraState } : {})}
        {...(miraStatus ? { status: miraStatus } : {})}
        {...(miraPick ? { pick: true } : {})}
      />
      <SeatRow
        person={nova}
        cards={novaCards ?? backs('nova', novaCount)}
        renderer={ekFace}
        box={box}
        badge={novaBadge === undefined ? novaCount : novaBadge}
        {...(novaState ? { state: novaState } : {})}
        {...(novaStatus ? { status: novaStatus } : {})}
        {...(novaPick ? { pick: true } : {})}
      />
      <SeatRow
        person={pip}
        cards={pipCards ?? backs('pip', pipCount)}
        renderer={ekFace}
        box={box}
        badge={pipBadge === undefined ? pipCount : pipBadge}
        {...(pipState ? { state: pipState } : {})}
        {...(pipStatus ? { status: pipStatus } : {})}
        {...(pipPick ? { pick: true } : {})}
      />
    </>
  )
}

function YouHand({ box, cards = hand, selected }: { box: Size; cards?: readonly CardView<EkFace>[]; selected?: readonly string[] }) {
  return (
    <div className="ux-you" data-region="you" data-testid="seat-s0">
      <SeatCaption seat={ash} />
      <CardRow cards={cards} renderer={ekFace} box={box} {...(selected ? { selected } : {})} />
    </div>
  )
}

function ekMiddle(box: Size, top: Title | null, count: number, timer: { seconds: number; label: string } | null, extra?: ReactNode) {
  return (
    <>
      <Stack id="draw" card={ekCard('pile', null)} renderer={ekFace} box={box} count={count} />
      {extra}
      {top && <Stack id="discard" card={ekCard('discard', top)} renderer={ekFace} box={box} />}
      {timer && <Timer seconds={timer.seconds} label={timer.label} />}
    </>
  )
}

function EkScene({ scene, box }: { scene: SceneId; box: Boxes }) {
  const seatBox = fitWidth(box.seat, 4, box.phone ? 168 : 220, box.gap)
  const handBox = fitWidth(box.hand, 5, box.phone ? 250 : 560, box.gap)
  const common = { miraCount: 4, novaCount: 4, pipCount: 4 }
  if (scene === 'ek-favor') {
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} miraPick novaPick pipPick />}
        middle={ekMiddle(box.pile, null, 23, { seconds: 30, label: 'TURN' })}
        you={<YouHand box={handBox} selected={['h-favor']} />}
        actions={<Actions reason="Pick a player." labels={[{ id: 'play', text: 'Play', primary: true, disabled: true }]} />}
      />
    )
  }
  if (scene === 'ek-give') {
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} miraState="idle" />}
        middle={ekMiddle(box.pile, 'favor', 23, { seconds: 30, label: 'GIVE' })}
        you={<YouHand box={handBox} selected={['h-skip']} />}
        actions={<Actions reason="Give a card." labels={[{ id: 'give', text: 'Give', primary: true }]} />}
      />
    )
  }
  if (scene === 'ek-steal') {
    const pair = [ekCard('h-taco', 'tacocat'), ekCard('h-taco2', 'tacocat'), ekCard('h-skip', 'skip'), ekCard('h-nope', 'nope'), ekCard('h-favor', 'favor')]
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} miraPick />}
        middle={ekMiddle(box.pile, null, 23, { seconds: 30, label: 'TURN' })}
        you={<YouHand box={handBox} cards={pair} selected={['h-taco', 'h-taco2']} />}
        actions={<Actions reason="Steal from Mira." labels={[{ id: 'play', text: 'Play', primary: true }]} />}
      />
    )
  }
  if (scene === 'ek-attack') {
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} miraState="active" miraStatus="x2" />}
        middle={ekMiddle(box.pile, 'attack', 23, { seconds: 30, label: 'TURN' })}
        you={<YouHand box={handBox} />}
      />
    )
  }
  if (scene === 'ek-nope') {
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} />}
        middle={ekMiddle(box.pile, 'attack', 23, { seconds: 5, label: 'NOPE' })}
        you={<YouHand box={handBox} selected={['h-nope']} />}
        actions={
          <Actions
            labels={[
              { id: 'nope', text: 'Nope', primary: true },
              { id: 'pass', text: 'Pass' },
            ]}
          />
        }
      />
    )
  }
  if (scene === 'ek-explode') {
    const dead = [ekCard('dead-skip', 'skip'), ekCard('dead-beard', 'beard'), ekCard('dead-taco', 'tacocat'), ekCard('dead-defuse', 'defuse')]
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={
          <EkSeats
            {...common}
            box={seatBox}
            miraCards={dead}
            miraBadge={null}
            miraState="out"
            miraStatus="OUT"
          />
        }
        middle={ekMiddle(box.pile, 'kitten', 22, { seconds: 30, label: 'TURN' })}
        you={<YouHand box={handBox} />}
        actions={<Actions labels={[{ id: 'draw', text: 'Draw', primary: true }]} />}
      />
    )
  }
  if (scene === 'ek-defuse') {
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} novaBadge={7} />}
        middle={ekMiddle(box.pile, 'defuse', 23, { seconds: 30, label: 'TURN' }, <Stack id="kitten" card={ekCard('shown-kitten', 'kitten')} renderer={ekFace} box={box.pile} />)}
        you={<YouHand box={handBox} />}
        actions={<Actions labels={[{ id: 'draw', text: 'Draw', primary: true }]} />}
      />
    )
  }
  if (scene === 'ek-turn') {
    return (
      <Frame
        scene={scene}
        score={0}
        nickname="Ash"
        seats={<EkSeats {...common} box={seatBox} />}
        middle={ekMiddle(box.pile, 'skip', 22, { seconds: 30, label: 'TURN' })}
        you={<YouHand box={handBox} />}
        actions={<Actions labels={[{ id: 'draw', text: 'Draw', primary: true }]} />}
      />
    )
  }
  return (
    <Frame
      scene="ek-hands"
      score={0}
      nickname="Ash"
      seats={<EkSeats box={seatBox} miraCount={4} novaCount={4} pipCount={4} miraBadge={8} novaBadge={6} pipBadge={5} />}
      middle={ekMiddle(box.pile, null, 23, { seconds: 30, label: 'TURN' })}
      you={<YouHand box={handBox} />}
      actions={<Actions labels={[{ id: 'draw', text: 'Draw', primary: true }]} />}
    />
  )
}

function Dealer({ box, cards, total }: { box: Size; cards: readonly CardView<StandardFace>[]; total?: number }) {
  return (
    <div className="ux-dealer" data-region="dealer" data-testid="dealer">
      <span className="ux-dealer-name">Dealer</span>
      <CardRow cards={cards} renderer={standardFaceRenderer} box={box} />
      {total !== undefined && (
        <div data-region="dealer-total">
          <ScoreBadge value={total} tone="cyan" size="sm" testId="dealer-total" />
        </div>
      )}
    </div>
  )
}

function BjYou({ box, cards, total, points }: { box: Size; cards: readonly CardView<StandardFace>[]; total: number; points: string }) {
  return (
    <div className="ux-you" data-region="you" data-testid="seat-s0">
      <div className="ux-seat-id">
        <SeatCaption seat={ash} />
        <span className="ux-points">{points}</span>
      </div>
      <CardRow cards={cards} renderer={standardFaceRenderer} box={box} />
      <div data-region="total-s0">
        <ScoreBadge value={total} tone="pink" size="sm" testId="seat-s0-total" />
      </div>
    </div>
  )
}

function BjScene({ scene, box }: { scene: SceneId; box: Boxes }) {
  const seatBox = fitWidth(box.seat, 2, box.phone ? 120 : 180, box.gap)
  const handBox = fitWidth(box.hand, 2, box.phone ? 160 : 280, box.gap)
  const opponents = (
    <>
      <SeatRow person={mira} cards={[std('m1', 'K', 'S'), std('m2', '7', 'H')]} renderer={standardFaceRenderer} box={seatBox} badge={17} points="+1" />
      <SeatRow person={nova} cards={[std('n1', '9', 'D'), std('n2', '8', 'C')]} renderer={standardFaceRenderer} box={seatBox} badge={17} points="0" />
      <SeatRow person={jules} cards={[std('j1', 'Q', 'H'), std('j2', '6', 'S')]} renderer={standardFaceRenderer} box={seatBox} badge={16} points="-1" />
    </>
  )
  if (scene === 'bj-bet') {
    return (
      <Frame
        scene={scene}
        score={3}
        nickname="Ash"
        hostDeal
        seats={
          <>
            <SeatRow person={mira} cards={[]} renderer={standardFaceRenderer} box={seatBox} points="+1" />
            <SeatRow person={nova} cards={[]} renderer={standardFaceRenderer} box={seatBox} points="0" />
            <SeatRow person={jules} cards={[]} renderer={standardFaceRenderer} box={seatBox} points="-1" />
          </>
        }
        middle={
          <p className="ux-note" data-region="ante" data-testid="ante">
            1 point each
          </p>
        }
        you={
          <div className="ux-you" data-region="you" data-testid="seat-s0">
            <div className="ux-seat-id">
              <SeatCaption seat={ash} />
              <span className="ux-points">+3</span>
            </div>
          </div>
        }
      />
    )
  }
  if (scene === 'bj-split') {
    const splitBox = fitWidth(box.hand, 2, box.phone ? 120 : 220, box.gap)
    return (
      <Frame
        scene={scene}
        score={3}
        nickname="Ash"
        seats={opponents}
        middle={
          <>
            <Dealer box={box.pile} cards={[std('d1', '7', 'C'), hole('d2')]} />
            <Timer seconds={30} label="TURN" />
          </>
        }
        you={
          <div className="ux-you" data-region="you" data-testid="seat-s0">
            <div className="ux-seat-id">
              <SeatCaption seat={ash} />
              <span className="ux-points">+3</span>
            </div>
            <div className="ux-split">
              <div className="ux-split-hand" data-region="hand-0" data-active="false" data-testid="split-0">
                <CardRow cards={[std('a1', 'K', 'H'), std('a2', '9', 'S')]} renderer={standardFaceRenderer} box={splitBox} />
                <div data-region="total-split-0">
                  <ScoreBadge value={19} tone="pink" size="sm" testId="split-0-total" />
                </div>
              </div>
              <div className="ux-split-hand" data-region="hand-1" data-active="true" data-testid="split-1">
                <CardRow cards={[std('b1', '6', 'D'), std('b2', '2', 'C')]} renderer={standardFaceRenderer} box={splitBox} />
                <div data-region="total-split-1">
                  <ScoreBadge value={8} tone="pink" size="sm" testId="split-1-total" />
                </div>
              </div>
            </div>
          </div>
        }
        actions={
          <Actions
            labels={[
              { id: 'hit', text: 'Hit', primary: true },
              { id: 'stand', text: 'Stand' },
              { id: 'double', text: 'Double' },
            ]}
          />
        }
      />
    )
  }
  return (
    <Frame
      scene="bj-table"
      score={3}
      nickname="Ash"
      seats={
        <>
          <SeatRow person={mira} cards={[std('m1', 'K', 'S'), std('m2', '7', 'H')]} renderer={standardFaceRenderer} box={seatBox} badge={17} points="+1" state="idle" />
          <SeatRow person={nova} cards={[std('n1', '9', 'D'), std('n2', '8', 'C')]} renderer={standardFaceRenderer} box={seatBox} badge={17} points="0" />
          <SeatRow person={jules} cards={[std('j1', 'Q', 'H'), std('j2', '6', 'S')]} renderer={standardFaceRenderer} box={seatBox} badge={16} points="-1" />
        </>
      }
      middle={
        <>
          <Dealer box={box.pile} cards={[std('d1', 'A', 'S'), hole('d2')]} />
          <Timer seconds={30} label="TURN" />
        </>
      }
      you={<BjYou box={handBox} cards={[std('y1', '9', 'H'), std('y2', '7', 'D')]} total={16} points="+3" />}
      actions={
        <Actions
          labels={[
            { id: 'hit', text: 'Hit', primary: true },
            { id: 'stand', text: 'Stand' },
            { id: 'double', text: 'Double' },
          ]}
        />
      }
    />
  )
}

function titleInside(card: HTMLElement): boolean {
  const face = card.querySelector('.nc-card-in')
  if (!face) return true
  const box = face.getBoundingClientRect()
  for (const node of card.querySelectorAll('.ek-face-title span')) {
    if (!(node instanceof HTMLElement)) continue
    if (node.scrollWidth > node.clientWidth + 1) return false
    const range = document.createRange()
    range.selectNodeContents(node)
    const ink = range.getBoundingClientRect()
    if (ink.width < 1) continue
    if (ink.left < box.left + 1 || ink.right > box.right - 1) return false
  }
  return true
}

/** Shrink a title until the whole word sits inside the card face. */
function fitTitles(root: ParentNode) {
  for (const card of root.querySelectorAll('.nc-card')) {
    if (!(card instanceof HTMLElement)) continue
    const title = card.querySelector('.ek-face-title')
    if (!(title instanceof HTMLElement) || titleInside(card)) continue
    let size = Number.parseFloat(getComputedStyle(title).fontSize)
    let guard = 0
    while (!titleInside(card) && size > 6 && guard < 24) {
      size -= 0.5
      title.style.fontSize = `${size}px`
      guard += 1
    }
  }
}

export function UxPreview({ scene }: { scene: SceneId }) {
  const metrics = useTableMetrics()
  useLayoutEffect(() => {
    let live = true
    delete document.documentElement.dataset.titlesFit
    void document.fonts.ready.then(() => {
      if (!live) return
      fitTitles(document)
      document.documentElement.dataset.titlesFit = 'true'
    })
    return () => {
      live = false
    }
  }, [scene, metrics.width, metrics.height])
  const box = boxesFor(metrics.width, metrics.height)
  const body = scene.startsWith('bj-') ? <BjScene scene={scene} box={box} /> : <EkScene scene={scene} box={box} />
  return <NeonRoot swirl="off">{body}</NeonRoot>
}
