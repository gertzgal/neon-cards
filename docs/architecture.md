# Neon Cards: architecture contract

This is the shared contract every agent builds against. Change it only through a PR that updates this file first, and say why in docs/decisions.md.

## Goal
A platform for neon pixel card games, with Blackjack as the first game and Flip 7 as the second. Every game shares one look, one feel, and one UX shell. Each game owns only its rules, its deck, its CPU policies, and its table layout composed from shared UI pieces. Adding a game such as Flip 7 or poker later should take a new package plus one line in each registry (web and worker), without touching the platform.

Flip 7 is the design target for multi-seat play: one human against 1 to 3 CPU opponents at a selectable difficulty (Easy, Medium, Hard). Real-time multiplayer between humans comes later and is out of scope for v1, but nothing below may assume exactly one human and one house.

## Stack
- pnpm workspaces monorepo, TypeScript strict everywhere, Node 22.
- **Backend:** Hono on Cloudflare Workers. The same Worker serves the API under /api and the built web app as static assets.
- **Database:** Cloudflare D1 (SQLite) with Drizzle ORM and SQL migrations under apps/worker/migrations. It runs locally through `wrangler dev` with a local D1, so agents can verify everything with no cloud account. Durable Objects are reserved for future real-time multiplayer and not used in v1.
- **Frontend:** Vite + React + TypeScript. Cards, chips, badges, and buttons are DOM elements animated with the Web Animations API (or the `motion` library), so Playwright can find them with `data-testid` and verify them. Canvas or WebGL is used only for the swirling edge background and the CRT overlay (scanlines, glow, vignette).
- **Tests:** Vitest for the engine and rules (seeded and deterministic, asserting literal expected values), Vitest with `@cloudflare/vitest-plugin` (the renamed `@cloudflare/vitest-pool-workers`) for the API, and Playwright for end-to-end runs against `wrangler dev`.
- **CI:** GitHub Actions on every PR: install, typecheck, lint, unit tests, API tests, build, Playwright e2e. Main must always be green.

## Layout
```
apps/
  worker/        Hono API + static asset serving, D1 schema and migrations, wrangler.toml
  web/           Vite React app: the shell (router, HUD, settings, history), mounts game plugins
packages/
  engine/        Game-agnostic core. Pure TS, no DOM, no IO. Types, seeded RNG, deck building, replay.
  ui/            Shared UX kit: theme tokens, CRT and swirl background, table primitives, juice system, audio
  games/
    blackjack/   Blackjack plugin: rules (pure) + table view (React, composed from packages/ui)
    flip7/       (next) Flip 7 plugin: rules + CPU policies (pure) + table view
docs/
  decisions.md, architecture.md, look-and-feel-brief.md, adding-a-game.md, reference/ (mock, prototype, shots)
.cursor/skills/verify-neon-cards/SKILL.md   scripted way for any agent to drive the real app and prove a change
```

## Core data shapes (packages/engine)
```ts
type Rng = { next(): number; int(maxExclusive: number): number; state(): string }  // seeded, serializable (sfc32)

// A card instance. `id` is unique per physical card in the shoe so animations can track it.
// `id` never encodes the face, so a face-down card can keep its real id and the UI can flip it in place.
// `face` is game-defined; the theme's face renderer for this deck draws it.
interface Card<Face = unknown> { id: string; deck: string; face: Face }
// What views and events carry: `face: null` is a face-down card.
type CardView<Face = unknown> = Card<Face | null>

// Decks are data, not code. Standard 52 and Flip 7 are both just DeckSpecs.
interface DeckSpec<Face> { id: string; build(): Face[] }          // one copy of the deck
// helpers: buildShoe(spec, copies, rng, idPrefix = spec.id) -> Card<Face>[], shuffle(items, rng)
// ids are `${idPrefix}-${index in the shuffled shoe}`; a game that reshuffles mid-session passes a fresh prefix.

type SeatId = string
type Difficulty = 'easy' | 'medium' | 'hard'
// 'house' seats (the blackjack dealer) are played by the rules themselves inside apply(), never by a Policy.
interface Seat { id: SeatId; kind: 'human' | 'cpu' | 'house'; name: string; difficulty?: Difficulty }  // difficulty only on 'cpu'

// Everything the UI animates comes from typed events. The UI never diffs state to guess what happened.
// Events are public: they never carry information hidden from any seat (deal a hidden card as a CardView with
// face: null and reveal it in a later event). A seat's private information reaches it only through view().
type GameEvent = { type: string; seat?: SeatId; [k: string]: unknown }
// The platform emits this before each CPU action's events. Games may emit it too (Blackjack: the next hand to play).
type TurnEvent = { type: 'turn'; seat: SeatId }

// `delta` is in the game's economy unit (see meta.economy): chips for 'chips' games, points for 'score' games.
interface Settlement { seat: SeatId; delta: number }

type GamePhase = 'betting' | 'playing' | 'settling' | 'over'   // games without betting start in 'playing'

interface GameDefinition<Config, State, Action, View, Face> {
  id: string; name: string; version: number
  deck: DeckSpec<Face>
  seats: { min: number; max: number }
  defaultConfig: Config
  parseConfig(input: unknown): Config            // validates client-sent config at the API boundary; throws on invalid
  seatsFor(config: Config): Seat[]               // builds the seat list, in turn order, from config (e.g. opponents, difficulty)
  setup(config: Config, seats: Seat[], rng: Rng): State
  toAct(state: State): SeatId | null             // whose turn it is; null while nobody can act. Never a 'house' seat.
  legalActions(state: State, seat: SeatId): Action[]   // [] for any seat that is not toAct(state)
  apply(state: State, seat: SeatId, action: Action, rng: Rng): { state: State; events: GameEvent[] }  // throws IllegalActionError
  view(state: State, seat: SeatId): View         // MUST hide hidden information (hole card, shoe order, other seats' hidden cards)
  phase(state: State): GamePhase
  settle(state: State): Settlement[]             // valid once phase is 'settling' (or 'over' reached straight from play)
  staked?(state: State, seat: SeatId): number    // chips committed to the unsettled round (0 if none); required for 'chips' games
}

// CPU seats run a Policy. Policies are pure and see only what that seat's view() exposes, never full state.
interface Policy<View, Action> { choose(view: View, legal: Action[], rng: Rng): Action }
type Policies<View, Action> = Record<Difficulty, Policy<View, Action>>
```
Rules are pure: same state + action + rng state gives the same result, and `apply()` never mutates its input state. A full round can be replayed from `seed + action log`. That powers history, debugging, and deterministic e2e tests. CPU actions go into the action log exactly like human actions, so replay never re-runs a policy.

Further rules every game follows:
- `Config`, `State`, `Action`, `View`, and events are plain JSON (no classes, Maps, `undefined` values, or functions), because the server stores them in D1 and sends them over HTTP.
- `legalActions()` is the menu the UI renders and Policies pick from. A parameterized action appears once with a representative value (Blackjack's `bet` carries the suggested amount). `apply()` is the authority on legality: it throws `IllegalActionError` (exported by the engine) for anything it rejects, and the server answers 400.
- Every action that leaves `phase` at `'settling'` ends exactly one round, and so does an action that moves it into `'over'` from `'betting'` or `'playing'`. The platform calls `settle()` exactly then. (Blackjack's `bet` from `'settling'` can deal and resolve a natural in one action, settling to settling, and that is a round.) An action taken during `'settling'` that does not finish a new round must leave `'settling'`.
- `setup()` emits no events. The UI renders the first view as the opening deal. While `'settling'`, `toAct` may return a seat whose action starts the next round (Blackjack's next `bet`, Flip 7's "next round"), or null.
- `seats.min`/`seats.max` count every seat `seatsFor` can return, house seats included.

## Multi-seat turn order
- `seatsFor(config)` returns seats in turn order. `toAct(state)` is the single source of truth for whose turn it is; the rules advance it inside `apply()`.
- One seat acts at a time. An action that targets another seat (Flip 7's Freeze, Flip Three) carries the target inside the Action; the acting seat is still `toAct`.
- Only `human` and `cpu` seats are ever returned by `toAct`. Dealer play (house seats) happens inside `apply()` and shows up as events with `seat` set to the house seat.

## CPU seats
- CPU seats run on the server, never in the browser. After every human action, the server loops: while `toAct(state)` is a `cpu` seat, it calls `policies[seat.difficulty].choose(view(state, seat), legalActions(state, seat), cpuRng)`, applies the chosen action, and appends it to the action log with that seat.
- `cpuRng` is a separate stream, `cpuRng(seed, seq)` = `createRng(`${seed}:cpu:${seq}`)` where `seq` is the CPU action's index in the action log, so CPU randomness never shifts the deck's RNG.
- The deck RNG is one stream per session: `createRng(seed)` feeds `setup()` and every `apply()` in log order, and its `state()` is persisted between requests (`restoreRng(state)`).
- Each CPU action's events are wrapped as `{type: 'turn', seat}` followed by the events `apply()` returned, all in the same response. The response ends when no CPU seat is to act: it's the human's turn again, or nobody can act. A CPU action that ends a round does not stop the loop; the round is reported in `Step.rounds` and the game decides through `toAct` who starts the next one.
- The engine runs this loop (`act()` and `startMatch()`, see Engine runtime); the server only persists and responds.
- The UI plays CPU turns as a paced queue: a short "thinking" beat (about 500 ms) on the seat, then the action's juice, then the next turn. Tapping skips to the end of the queue. Pacing is purely client-side; the server returns everything at once.
- If CPU seats come before the human in turn order, the `POST /api/sessions` response resolves their turns the same way.

## Game settings
- Settings live in `Config` and travel `POST /api/sessions {gameId, config}` → `definition.parseConfig(config)` → `seatsFor(config)` and `setup(config, ...)`. Nothing about seats or difficulty is hard-coded in the platform.
- The game declares which settings the shell should show in `rules.meta.settings` (choice lists only, rendered as segmented pixel buttons on a pre-game sheet). Flip 7's are `opponents: 1 | 2 | 3` and `difficulty: easy | medium | hard`. Blackjack has none in v1.
- The shell remembers the last-used settings per game in localStorage.

## Card faces
- `Face` is entirely game-defined. The engine never inspects it; only the game's rules and its `faceRenderer` do. The shared card frame (size, rim, back, dimmed face-down state, deal/flip juice) is the same for every game.
- Reference shapes the model must hold: standard 52 (`{rank, suit}`), and Flip 7 (`{kind: 'number', value: 0..12} | {kind: 'modifier', op: 'add', value: 2|4|6|8|10} | {kind: 'modifier', op: 'times', value: 2} | {kind: 'action', action: 'freeze' | 'flipThree' | 'secondChance'}`).
- The Flip 7 DeckSpec (Engine PR) is 94 cards: number cards 12×12, 11×11, down to 1×1, plus one 0; one each of +2, +4, +6, +8, +10, and x2; three each of Freeze, Flip Three, and Second Chance.

## Plugin contract (what a game package exports)
A game package has two entrypoints, because the Worker must run the rules and CPU policies without pulling in React:
- `@neon-cards/game-<id>/rules`: pure, no DOM, no React. Exports `GameRules`.
- `@neon-cards/game-<id>`: the browser plugin. Exports `GamePlugin`, which re-uses the same `rules`.

```ts
// packages/engine. Both registries see GameRules, so everything the Worker needs (economy, settings) lives here.
interface GameRules<Config = unknown, State = unknown, Action = unknown, View = unknown, Face = unknown> {
  definition: GameDefinition<Config, State, Action, View, Face>
  policies?: Policies<View, Action>              // required when seatsFor() can return 'cpu' seats
  meta: GameMeta
}

interface GameMeta {
  title: string; description: string
  economy: 'chips' | 'score'                     // 'chips' games bet from and settle into the wallet; 'score' games never touch it
  minBet?: number                                // 'chips' games only
  settings?: SettingSpec[]                       // shown on the pre-game sheet; values land in config[key]
}

interface SettingSpec { key: string; label: string; options: { value: string | number; label: string }[] }

// packages/ui (it needs React types). The shell reads title, settings, and economy from plugin.rules.meta.
interface GamePlugin {
  rules: GameRules
  Table: React.ComponentType<TableProps>        // composed from packages/ui primitives only
  faceRenderer: CardFaceRenderer                 // how this deck's faces draw in the shared card frame
  juice: JuiceMap                                // maps this game's GameEvent types to shared juice primitives
  recap?(summary: { settlements: Settlement[]; view?: View }): RoundRecap | null   // optional: a history row's outcome
  guide: GameGuide                               // how to play; the shell paints this page and does not branch on the game
}

// What a history row shows besides the net and time. `hands` draw as small glyphs with faceRenderer.label/tone.
interface RoundRecap { outcome: string; tone?: Tone; hands?: CardView[][] }   // outcome: "BLACKJACK", "WIN · BUST"
```
The browser-side plugin types (`GamePlugin`, `TableProps`, `EventBatch`, `CardFaceRenderer`, `JuiceMap`, `RoundRecap`, `GameGuide`) are exported by `@neon-cards/ui`, with `definePlugin()` to erase a plugin's generics for the registry and `defineGuide()` to reject a document that cannot be a page (it returns the same object). The shell paints one How to play page from `plugin.guide` and never branches on game id, face kind, or section list. A game may omit a section by leaving it out of its own document. Whether this browser has closed the page is `neon-cards:guide-seen:<gameId>` in localStorage, not the settings JSON and not D1. The shell renders `Table` with:
```ts
interface EventBatch { id: number; events: GameEvent[] }   // one server response's events; id increases per response
interface TableProps<View, Action> {
  seats: Seat[]; humanSeat: SeatId
  view: View                 // the human's view after `events`; the Table shows it once playback finishes
  events: EventBatch         // the Table plays it through usePlayback(): turn beats for CPU seats, then juice
  wallet: number | null      // null for 'score' games
  act(action: Action): Promise<void>   // resolves once the response and its new batch arrived
  busy: boolean
  hudIcons?: ReactNode       // the shell's sound and settings buttons; a table that draws its own top bar renders them at its right
}
```
While a table is live the shell draws no HUD of its own: the table's top bar (bankroll pill on the left) is the only one, as in the mock.
There are two registries, one line per game each: apps/web/src/games.ts (an array of `GamePlugin`, the home screen lists them) and apps/worker/src/games.ts (an array of `GameRules`, keyed by `definition.id`). Only Blackjack exists in v1; Flip 7 is next.

Shared juice primitives in packages/ui (every game reuses them, so all games feel the same): deal (fly-in plus a squash on landing), flip (squash-and-stretch), shake (small or big), flash (color), numberPop (+$75), chipBurst, chipsToPot, chipsToPlayer, badgePulse. Durations stay short, following the brief. A blackjack-level moment is the only "big" one (a Flip 7 "flip 7" bonus is the same tier).

## Engine runtime (packages/engine)
The Worker never calls `setup`/`apply`/policies directly; it drives a `Match` through the engine, so turn order, the CPU loop, `turn` events, the CPU RNG stream, and settlement work the same for every game and are proven once in engine tests.
```ts
createRng(seed: string): Rng; restoreRng(state: string): Rng; cpuRng(seed: string, seq: number): Rng
shuffle<T>(items: readonly T[], rng: Rng): T[]
buildShoe<Face>(spec: DeckSpec<Face>, copies: number, rng: Rng, idPrefix?: string): Card<Face>[]
faceDown<Face>(card: Card<Face>): Card<null>     // same id, face hidden
parseSettings<C>(settings: SettingSpec[], defaults: C, input: unknown): C   // choice-list config parsing for parseConfig(); throws ConfigError (400)
standard52: DeckSpec<{ rank: Rank; suit: Suit }>; flip7Deck: DeckSpec<Flip7Face>

// Everything the server persists for a live session, as plain JSON.
interface Match<Config, State> {
  gameId: string; version: number; seed: string; config: Config; seats: Seat[]
  state: State; rng: string                      // rng is the deck Rng's state()
  seq: number                                    // next action seq, equal to the action log's length
}
interface ActionRecord<Action> { seq: number; seat: SeatId; action: Action }
interface Step<Config, State, Action> {
  match: Match<Config, State>
  events: GameEvent[]                            // the human's action's events, then per CPU action: TurnEvent + its events
  log: ActionRecord<Action>[]                    // every action applied in this step (human and CPU), to append to `actions`
  rounds: Settlement[][]                         // one entry per round that ended in this step, in order
}
startMatch(rules, config, seed): Step            // config already parsed; runs setup, then leading CPU turns
act(rules, match, seat, action): Step            // throws NotYourTurnError (409), IllegalActionError (400); then runs CPU turns
replay(rules, { seed, config, log, version? }): Step  // rebuilds the match from the log alone; never runs a policy
```
The CPU loop stops when `toAct` is null or not a `cpu` seat. It throws if a CPU seat has no policy for its difficulty or chooses an action outside `legalActions`.

The test-only multi-seat game ("high card", 1 human + 1 to 3 CPUs, a trivial policy per difficulty) ships from `@neon-cards/engine/testing` so Worker tests can register it next to the real games. It is never in a production registry. It is a dev game: the Worker's `devGames` list joins the registry only on requests with `DEV_RIG=1`, and the shell's `devGames` (with a small table built from packages/ui) make it routable at `/games/high-card` without listing it in the lobby, so e2e and the verify skill prove multi-seat play in the real app. A deployed Worker answers 404 for it.

## Table primitives (packages/ui)
One table composition scales from phone to desktop and from heads-up to a full table. Top to bottom:
- **Top zone:** either the `DealerTray` (house games like Blackjack) or `OpponentRows`, which lays out 1 to 3 opponent seats. Each opponent seat shows its name, a difficulty pip (Easy/Medium/Hard), a compact hand (cards scaled down, overlapping), its total or score badge, and a turn highlight. Phone stacks opponents as slim rows; desktop puts them side by side.
- **Middle zone:** pot or deck/discard, and the round's status badge.
- **Bottom zone:** the human's hand with its total badge, and the action buttons. Blackjack keeps the felt arc. The shared `fit` row is one straight line: no wrap, fan, rotation, or horizontal scroll. Cards scale down as the row grows so every card stays inside the width it is given. Exploding Kittens and Flip 7 both use it. Flip 7's round score sits centered above the hand, next to the progress marks, and nothing sits beside the cards. Desktop Flip 7 cards open at about 70% of the phone opening size, with about 12px between cards. Opponent hands stay compact and overlapping. A defuse placement row shrinks so every slot, including Top and Bottom, stays inside the viewport.
- The active seat (`toAct`) gets the same pulse glow whether it's a CPU or the human, so CPU turns read clearly while they play out.
- Opponent seats use `data-testid="seat-<seatId>"` so Playwright can assert on each one.

## Server model (apps/worker)
The server is authoritative. The shoe and hidden cards live only on the server.
- `POST /api/sessions {gameId, config}` parses config with `definition.parseConfig` (400 on invalid, 404 for an unknown game), builds seats with `seatsFor`, creates a session with a seed, runs any leading CPU turns, and returns `201 {sessionId, gameId, seats, events, view, seq, status, wallet?}`. For `economy: 'chips'` games the server closes the player's other active chips sessions, because a chips game's stack mirrors the wallet, then sets `config.bankroll` to the wallet balance (overriding any client value). Closing a session forfeits its unsettled round: if `staked(state, humanSeat)` is above 0, the server records that round as lost (a `rounds` row with `net = -staked` and `summary.forfeit: true`, and a `wallet_ledger` row with reason `forfeit`) before reading the wallet, so walking away from a dealt hand costs the same as losing it.
- `POST /api/sessions/:id/actions {action, seq}` runs the engine's `act()` (409 when the human seat is not `toAct` or the session is over, 400 when `apply()` rejects the action), which applies it and runs the CPU loop, settles every round in `Step.rounds`, persists every action (human and CPU) to `actions`, and returns `{events, view, seq, status, wallet?}`. `seq` is the action log's length (CPU actions included): every response carries the `seq` the next human action must send. A retried `seq` returns the stored response without re-running anything; a `seq` that is ahead, or that a CPU used, is a 409.
- `GET /api/sessions/:id` returns `{sessionId, gameId, seats, view, seq, status, wallet?}` (for resume after reload). Sessions are visible only to their player (404 otherwise).
- `GET /api/history?gameId=` returns `{rounds: [{id, sessionId, gameId, roundNo, net, summary, createdAt}]}`, this player's finished rounds, newest first (50 max). `summary` is `{settlements, view?, forfeit?}`; `view` is the human's view when the step that ended the round finished (for a forfeit, when the session was closed).
- `view` is always `definition.view(state, humanSeat)`; events are public (see Core data shapes). `wallet` is present only for `'chips'` games. Timestamps are epoch milliseconds.
- A `{type: 'refill', seat}` event on the human seat of a chips game refills the wallet the same way `GET /api/wallet` does (only if broke), so the wallet and the game's stack refill together exactly once.
- `GET /api/wallet` returns the balance. A broke player (balance below 5, the smallest chip) is refilled to the starting bankroll (1,250), and the refill is recorded. Only `economy: 'chips'` games read or write the wallet; `rounds.net` is 0 for score games and their result lives in `summary_json`.
- Identity is an anonymous player id in an httpOnly cookie. There are no accounts in v1.
- D1 tables: `players`, `wallets`, `sessions(id, player_id, game_id, game_version, seed, config, state_json, status, created_at)`, `actions(session_id, seq, seat, action_json, response_json, created_at)` (`response_json` is stored on human actions so a retried `seq` replays it), `rounds(id, session_id, round_no, summary_json, net, created_at)`, `wallet_ledger(player_id, delta, reason, ref, created_at)`.
- Dev-only rigging: when `env.DEV_RIG === "1"`, `config.rig` stacks the shoe (e.g. "blackjack", "bust", "split", "dealerbj"), matching the prototype's `?rig=` param, and `POST /api/sessions` accepts a `seed` string. Without it both are a 400. The local scripts (`pnpm dev`, `pnpm start`, e2e, verify) pass `--var DEV_RIG:1`; `wrangler deploy` never does.

## Verification bar
- Rules: every rule and payout has a Vitest case with a literal expected result.
- Multi-seat: the engine and worker are proven with a tiny test-only game (for example "high card", 1 human + 1 to 3 CPUs) that exercises turn order, the CPU loop, `turn` events, config parsing, and replay. No Flip 7 rules are needed to prove the platform is ready.
- API: each route is tested against a local D1.
- UI: Playwright runs a full rigged round for each moment (betting, deal, hit, stand, double, split, bust, blackjack, push, dealer blackjack, refill) on phone 390x844 and desktop 1440x900, asserts on DOM state and bankroll, and saves screenshots as CI artifacts.
- The verify-neon-cards skill documents the exact commands so any agent can prove a change before merging.
