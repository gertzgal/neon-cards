// The public contract of @neon-cards/ui. Games and the shell build against these shapes.
import type { ComponentType, ReactNode } from 'react'
import type { CardView, GameEvent, GameRules, Seat, SeatId, Settlement } from '@neon-cards/engine'

export type { CardView, GameMeta, SettingSpec } from '@neon-cards/engine'
import type { ChipValue, Tone } from './theme/tokens'

// ---------- Card faces ----------

/** `hand` is the human's cards, `tray` the dealer's, `compact` an opponent seat's. */
export type CardSize = 'hand' | 'tray' | 'compact'

export interface FaceRenderContext {
  size: CardSize
  /** Rendered card width in CSS px, for picking a whole-number pixel scale. */
  widthPx: number
}

/** How one deck's game-defined `Face` draws inside the shared card frame (rim, back, dimmed face-down, juice). */
export interface CardFaceRenderer<Face = unknown> {
  deck: string
  /** Neon accent for the rim, glow and ink of this face. */
  tone(face: Face): Tone
  /** Rim color when the face needs a hue outside the five tones. Defaults to `tone`. */
  accent?(face: Face): string
  /** Short readable label for aria-label and test assertions, e.g. "8♥", "+4", "FREEZE". */
  label(face: Face): string
  render(face: Face, ctx: FaceRenderContext): ReactNode
}

// ---------- Table primitives ----------

/** Visual state shared by hands, seats and badges. `active` is the toAct pulse glow. */
export type SeatState = 'idle' | 'active' | 'waiting' | 'bust' | 'win' | 'blackjack' | 'out'

export interface PlayingCardProps<Face = unknown> {
  /** `face: null` draws the shared dimmed back. */
  card: CardView<Face>
  renderer: CardFaceRenderer<Face>
  size?: CardSize
  state?: SeatState
}

export interface HandProps<Face = unknown> {
  cards: CardView<Face>[]
  renderer: CardFaceRenderer<Face>
  size?: CardSize
  /** `fan` rotates and arcs. `row` is flat. `strip` is a straight row that overlaps slightly and scrolls. */
  layout?: 'fan' | 'row' | 'strip'
  /** Max width the hand may use before cards overlap more, in px. Defaults per size and viewport. */
  maxWidth?: number
  state?: SeatState
  testId?: string
}

export interface ScoreBadgeProps {
  value: string | number | null
  tone?: Tone
  state?: SeatState
  size?: 'sm' | 'md' | 'lg'
  testId?: string
}

export interface DealerTrayProps<Face = unknown> {
  cards: CardView<Face>[]
  renderer: CardFaceRenderer<Face>
  total?: string | number | null
  state?: SeatState
  /** Shown faintly instead of an empty box during betting. */
  placeholder?: ReactNode
}

/** One CPU or remote seat in the top zone. Rendered with data-testid="seat-<seat.id>". */
export interface OpponentSeatModel<Face = unknown> {
  seat: Seat
  cards: CardView<Face>[]
  total?: string | number | null
  /** Short status word under the name, e.g. "STAYED", "BUST", "FROZEN". */
  status?: string
  state?: SeatState
}

export interface OpponentRowsProps<Face = unknown> {
  seats: OpponentSeatModel<Face>[]
  renderer: CardFaceRenderer<Face>
}

export interface ChipProps {
  value: ChipValue
  size?: 'sm' | 'md' | 'lg'
}

/** The pot or a bet: chips grouped into stacks, with the amount under them. */
export interface ChipStackProps {
  chips: ChipValue[]
  amount?: number | null
  testId?: string
}

/** The row of chip buttons for betting. Each button has data-testid="chip-<value>". */
export interface ChipRackProps {
  values?: readonly ChipValue[]
  onPick(value: ChipValue, from: HTMLElement): void
  isDisabled?(value: ChipValue): boolean
}

export interface ActionSpec {
  /** Rendered as data-testid="action-<id>". */
  id: string
  label: ReactNode
  primary?: boolean
  tone?: 'pink' | 'cyan'
  disabled?: boolean
  /** Grid span on the phone layout, e.g. DEAL spanning three columns. */
  span?: number
  ariaLabel?: string
}

export interface ActionBarProps {
  actions: ActionSpec[]
  onAction(id: string): void
  /** Grid columns on phone and desktop. Defaults: 2 on phone, one row on desktop. */
  columns?: { phone?: number; desktop?: number }
}

/** Betting: the chip rack over [clear | deal] on phone, one row on desktop. Buttons: action-clear, action-deal, chip-<v>. */
export interface BetControlsProps {
  values?: readonly ChipValue[]
  onPick(value: ChipValue, from: HTMLElement): void
  isDisabled?(value: ChipValue): boolean
  onClear(): void
  onDeal(): void
  canClear: boolean
  canDeal: boolean
  dealLabel?: ReactNode
}

export interface SegmentedControlProps<V extends string | number = string | number> {
  label: string
  options: { value: V; label: string }[]
  value: V
  onChange(value: V): void
  /** Each option gets data-testid="<testId>-<value>". */
  testId?: string
}

export interface HudProps {
  /** The bankroll pill (data-testid="hud-bankroll"), counting up or down on change. Null hides it, for score games. */
  bankroll?: number | null
  left?: ReactNode
  /** Extra icon buttons placed before the sound and settings icons. */
  right?: ReactNode
  /** The sound icon (data-testid="hud-sound"). */
  sound?: { on: boolean; toggle(): void }
  /** The settings icon (data-testid="hud-settings"); hidden when absent. */
  onSettings?(): void
}

/** One composition from phone to desktop, top to bottom, with the controls on the felt arc. */
export interface TableLayoutProps {
  hud?: ReactNode
  top: ReactNode
  middle?: ReactNode
  bottom: ReactNode
  controls: ReactNode
}

// ---------- Juice ----------

/** An element, or the data-testid of one. */
export type JuiceTarget = Element | string
export type Point = { x: number; y: number }
export type ShakeSize = 'small' | 'big'
/** `big` is reserved for a blackjack-level moment. */
export type PopTier = 'small' | 'normal' | 'big'
export type FlashTone = 'bust' | 'gold' | Tone

/** The shared juice primitives. Every one resolves when its effect is done, and resolves at once when skipped. */
export interface JuiceKit {
  readonly reducedMotion: boolean
  /** True while the queue is being skipped: primitives resolve immediately with no effect. */
  readonly instant: boolean
  /** Fly-in from the shoe with a squash on landing. */
  deal(target: JuiceTarget, opts?: { from?: Point | JuiceTarget }): Promise<void>
  /**
   * Squash-and-stretch flip of a card that is already face-up in the DOM (playback applies the
   * event first): a card back covers it, shrinks away, and the face stretches in. With `swap`, no
   * cover is drawn and `swap` runs at the midpoint instead.
   */
  flip(target: JuiceTarget, swap?: () => void): Promise<void>
  /** Slide an element from a previous position (FLIP-style) to where it is now. */
  slide(target: JuiceTarget, from: Point | JuiceTarget): Promise<void>
  shake(size?: ShakeSize, target?: JuiceTarget): Promise<void>
  flash(tone: FlashTone, target?: JuiceTarget): Promise<void>
  numberPop(text: string, opts?: { tier?: PopTier; tone?: FlashTone; at?: JuiceTarget }): Promise<void>
  /** Chips spray out of `at` and fall. They never rise above the bottom of `ceiling` (e.g. the dealer tray). */
  chipBurst(opts?: { at?: JuiceTarget; count?: number; ceiling?: JuiceTarget }): Promise<void>
  chipsToPot(chips: ChipValue[], opts: { from: JuiceTarget; to: JuiceTarget }): Promise<void>
  chipsToPlayer(chips: ChipValue[], opts: { from: JuiceTarget; to: JuiceTarget }): Promise<void>
  badgePulse(target: JuiceTarget): Promise<void>
  sfx(name: SfxName): void
  wait(ms: number): Promise<void>
}

/** Runs after the event is applied to the display. Bivariant, so a game can type `event` as its own event. */
export type JuiceHandler<E extends GameEvent = GameEvent> = {
  bivarianceHack(event: E, kit: JuiceKit): void | Promise<void>
}['bivarianceHack']
/** Maps a game's GameEvent types to shared juice. Unmapped types play with no effect. */
export type JuiceMap = Record<string, JuiceHandler>

export interface PlaybackOptions {
  juice: JuiceMap
  /** Which seats are CPUs: a `turn` event on a CPU seat gets the thinking beat. */
  seats: Seat[]
  /** Advance the game's displayed model by one event. Runs before that event's juice, and for every event when skipping. */
  apply(event: GameEvent): void
}

export interface Playback {
  /** Plays events in order; `turn` events get the thinking beat on their seat. Resolves when done or skipped. */
  play(events: GameEvent[]): Promise<void>
  /** Jump to the end of the current queue (bound to a tap on the table while playing). */
  skip(): void
  playing: boolean
  /** The seat whose turn is animating (from the last `turn` event), for the active glow. */
  actingSeat: SeatId | null
  /** True during a CPU seat's thinking beat. */
  thinking: boolean
}

// ---------- Audio ----------

export type SfxName = 'card' | 'flip' | 'chip' | 'bust' | 'win' | 'lose' | 'push' | 'blackjack' | 'click' | 'turn'

export interface AudioSettings {
  /** Master mute; the HUD sound icon toggles it. */
  muted: boolean
  music: boolean
  sfx: boolean
  /** 0..1 master volume. */
  volume: number
}

export interface AudioManager {
  readonly settings: AudioSettings
  readonly unlocked: boolean
  update(patch: Partial<AudioSettings>): void
  subscribe(listener: (settings: AudioSettings) => void): () => void
  /** Creates or resumes the AudioContext. Call from a user gesture; the manager also listens for the first one. */
  unlock(): Promise<void>
  play(name: SfxName): void
  startMusic(): void
  stopMusic(): void
}

// ---------- Plugin contract (docs/architecture.md, "Plugin contract") ----------

/** One server response's events, in order. `id` increases per response so the Table knows when to play. */
export interface EventBatch {
  id: number
  events: GameEvent[]
}

export interface TableProps<View = unknown, Action = unknown> {
  seats: Seat[]
  humanSeat: SeatId
  /** The human seat's view after `events`. Show it once playback finishes. */
  view: View
  events: EventBatch
  /** Bankroll for 'chips' games, null for 'score' games. */
  wallet: number | null
  /** Sends one human action to the server. Resolves when the response (and its new batch) has arrived. */
  act(action: Action): Promise<void>
  /** True while an action is in flight. */
  busy: boolean
  /** The shell's sound and settings buttons. A table that draws its own top bar renders them at its right. */
  hudIcons?: ReactNode
}

/** A finished round's `summary` as `GET /api/history` returns it. */
export interface RoundSummary<View = unknown> {
  settlements: Settlement[]
  view?: View
  /** Set when the round was closed unfinished and its stake forfeited. */
  forfeit?: boolean
}

/** How a history row shows one finished round. */
export interface RoundRecap<Face = unknown> {
  /** A word or two, e.g. "BLACKJACK", or "WIN · BUST" for a split. */
  outcome: string
  /** Overrides the row's tone, which otherwise follows the net. `bust` is the explode loss. */
  tone?: Tone | 'bust'
  /** The human's hands at the end of the round, drawn small with the plugin's face renderer. */
  hands?: CardView<Face>[][]
}

/** One painted run. `gold` is the prototype's bold word. */
export interface GuideRun {
  readonly text: string
  readonly gold?: true
}

export type GuideText = readonly GuideRun[]

export interface GuideParagraph {
  readonly kind: 'paragraph'
  readonly text: GuideText
}

export interface GuideList {
  readonly kind: 'list'
  readonly items: readonly GuideText[]
}

export type GuideBlock = GuideParagraph | GuideList

/** Numbered block of copy. The shell supplies the index badge. */
export interface GuideProseSection {
  readonly kind: 'prose'
  readonly id: string
  readonly title: string
  readonly blocks: readonly GuideBlock[]
}

/**
 * One static felt card plus the sentence beside it.
 * `paint` closes over the face and the felt renderer. The shell never receives either.
 * `id` is an opaque testid suffix. The shell does not branch on it.
 */
export interface GuideCardRow {
  readonly id: string
  readonly name: string
  readonly sentence: string
  readonly paint: (widthPx: number) => ReactNode
}

/** Two columns from 900px. Phone stays one column. Any cards section, not a title match. */
export interface GuideCardsSection {
  readonly kind: 'cards'
  readonly id: string
  readonly title: string
  readonly rows: readonly GuideCardRow[]
}

export type GuideSection = GuideProseSection | GuideCardsSection

/** Everything the page needs. Order is the order on screen. */
export interface GameGuide {
  readonly title: string
  readonly sections: readonly GuideSection[]
}

declare const guideCloseBrand: unique symbol

/** A dismiss. Only `useTableGuide` mints one, so a raw lambda cannot close the page. */
export type GuideClose = (() => void) & { readonly [guideCloseBrand]: true }

/** Open is first-visit until `closeGuide`. The book calls `openGuide` and does not clear the flag. */
export interface TableGuide {
  readonly open: boolean
  openGuide(): void
  readonly closeGuide: GuideClose
}

/** The browser plugin a game package exports. The shell reads title, settings and economy from `rules.meta`. */
export interface GamePlugin<View = unknown, Action = unknown, Face = unknown> {
  rules: GameRules<unknown, unknown, Action, View, Face>
  Table: ComponentType<TableProps<View, Action>>
  faceRenderer: CardFaceRenderer<Face>
  juice: JuiceMap
  /** Optional. Without it a history row shows only the net and the time. */
  recap?(summary: RoundSummary<View>): RoundRecap<Face> | null
  /** How to play. The shell renders this and nothing else from the game. */
  guide: GameGuide
}

function blank(value: string): boolean {
  return value.trim() === ''
}

function rejectEmptyRuns(sectionId: string, runs: GuideText): void {
  if (runs.length === 0) throw new Error(`guide section ${sectionId} has an empty run`)
  for (const run of runs) {
    if (blank(run.text)) throw new Error(`guide section ${sectionId} has an empty run`)
  }
}

/** Reject a document that cannot be a page. Return the same object. Do not copy strings. */
export function defineGuide(guide: GameGuide): GameGuide {
  if (blank(guide.title)) throw new Error('guide title is empty')
  if (guide.sections.length === 0) throw new Error('guide has no sections')
  const sectionIds = new Set<string>()
  const rowIds = new Set<string>()
  for (const section of guide.sections) {
    if (blank(section.id)) throw new Error('guide section id is empty')
    if (sectionIds.has(section.id)) throw new Error(`guide section id repeats: ${section.id}`)
    sectionIds.add(section.id)
    if (section.kind === 'prose') {
      if (section.blocks.length === 0) throw new Error(`guide section ${section.id} has no blocks`)
      for (const block of section.blocks) {
        if (block.kind === 'paragraph') rejectEmptyRuns(section.id, block.text)
        else {
          if (block.items.length === 0) throw new Error(`guide section ${section.id} has an empty list`)
          for (const item of block.items) rejectEmptyRuns(section.id, item)
        }
      }
    } else {
      if (section.rows.length === 0) throw new Error(`guide section ${section.id} has no rows`)
      for (const row of section.rows) {
        if (blank(row.id)) throw new Error('guide row id is empty')
        if (rowIds.has(row.id)) throw new Error(`guide row id repeats: ${row.id}`)
        rowIds.add(row.id)
        if (blank(row.name) || blank(row.sentence)) throw new Error(`guide row ${row.id} needs a name and a sentence`)
      }
    }
  }
  return guide
}

/** Erases a plugin's View/Action/Face so plugins of different games fit one registry array. */
export function definePlugin<View, Action, Face>(plugin: GamePlugin<View, Action, Face>): GamePlugin {
  return plugin as unknown as GamePlugin
}
