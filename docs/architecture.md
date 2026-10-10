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
type Rng = { next(): number; int(maxExclusive: number): number; state(): string }  // seeded, serializable (e.g. PCG32 or sfc32)

// A card instance. `id` is unique per physical card in the shoe so animations can track it.
// `face` is game-defined; the theme's face renderer for this deck draws it.
interface Card<Face = unknown> { id: string; deck: string; face: Face }

// Decks are data, not code. Standard 52 and Flip 7 are both just DeckSpecs.
interface DeckSpec<Face> { id: string; build(): Face[] }          // one copy of the deck
// helpers: buildShoe(spec, copies, rng) -> Card<Face>[], shuffle(cards, rng)

type SeatId = string
type Difficulty = 'easy' | 'medium' | 'hard'
// 'house' seats (the blackjack dealer) are played by the rules themselves inside apply(), never by a Policy.
interface Seat { id: SeatId; kind: 'human' | 'cpu' | 'house'; name: string; difficulty?: Difficulty }  // difficulty only on 'cpu'

// Everything the UI animates comes from typed events. The UI never diffs state to guess what happened.
type GameEvent = { type: string; seat?: SeatId; [k: string]: unknown }

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
  toAct(state: State): SeatId | null             // whose turn it is; null while nobody can act (settling, over). Never a 'house' seat.
  legalActions(state: State, seat: SeatId): Action[]   // [] for any seat that is not toAct(state)
  apply(state: State, seat: SeatId, action: Action, rng: Rng): { state: State; events: GameEvent[] }
  view(state: State, seat: SeatId): View         // MUST hide hidden information (hole card, shoe order, other seats' hidden cards)
  phase(state: State): GamePhase
  settle(state: State): Settlement[]             // valid once phase is 'settling'
}

// CPU seats run a Policy. Policies are pure and see only what that seat's view() exposes, never full state.
interface Policy<View, Action> { choose(view: View, legal: Action[], rng: Rng): Action }
type Policies<View, Action> = Record<Difficulty, Policy<View, Action>>
```
Rules are pure: same state + action + rng state gives the same result. A full round can be replayed from `seed + action log`. That powers history, debugging, and deterministic e2e tests. CPU actions go into the action log exactly like human actions, so replay never re-runs a policy.

## Multi-seat turn order
- `seatsFor(config)` returns seats in turn order. `toAct(state)` is the single source of truth for whose turn it is; the rules advance it inside `apply()`.
- One seat acts at a time. An action that targets another seat (Flip 7's Freeze, Flip Three) carries the target inside the Action; the acting seat is still `toAct`.
- Only `human` and `cpu` seats are ever returned by `toAct`. Dealer play (house seats) happens inside `apply()` and shows up as events with `seat` set to the house seat.

## CPU seats
- CPU seats run on the server, never in the browser. After every human action, the server loops: while `toAct(state)` is a `cpu` seat, it calls `policies[seat.difficulty].choose(view(state, seat), legalActions(state, seat), cpuRng)`, applies the chosen action, and appends it to the action log with that seat.
- `cpuRng` is a separate stream seeded from `seed + seq`, so CPU randomness never shifts the deck's RNG.
- Each CPU action's events are wrapped as `{type: 'turn', seat}` followed by the events `apply()` returned, all in the same response. The response ends when it's the human's turn again or the round reaches `settling`/`over`.
- The UI plays CPU turns as a paced queue: a short "thinking" beat (about 500 ms) on the seat, then the action's juice, then the next turn. Tapping skips to the end of the queue. Pacing is purely client-side; the server returns everything at once.
- If CPU seats come before the human in turn order, the `POST /api/sessions` response resolves their turns the same way.

## Game settings
- Settings live in `Config` and travel `POST /api/sessions {gameId, config}` → `definition.parseConfig(config)` → `seatsFor(config)` and `setup(config, ...)`. Nothing about seats or difficulty is hard-coded in the platform.
- The plugin declares which settings the shell should show in `meta.settings` (choice lists only, rendered as segmented pixel buttons on a pre-game sheet). Flip 7's are `opponents: 1 | 2 | 3` and `difficulty: easy | medium | hard`. Blackjack has none in v1.
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
interface GameRules {
  definition: GameDefinition<any, any, any, any, any>
  policies?: Policies<any, any>                  // required when seatsFor() can return 'cpu' seats
}

interface SettingSpec { key: string; label: string; options: { value: string | number; label: string }[] }

interface GamePlugin {
  rules: GameRules
  Table: React.ComponentType<TableProps>        // composed from packages/ui primitives only
  faceRenderer: CardFaceRenderer                 // how this deck's faces draw in the shared card frame
  juice: JuiceMap                                // maps this game's GameEvent types to shared juice primitives
  meta: {
    title: string; description: string
    economy: 'chips' | 'score'                   // 'chips' games bet from and settle into the wallet; 'score' games never touch it
    minBet?: number                              // 'chips' games only
    settings?: SettingSpec[]                     // shown on the pre-game sheet; values land in config[key]
  }
}
```
There are two registries, one line per game each: apps/web/src/games.ts (an array of `GamePlugin`, the home screen lists them) and apps/worker/src/games.ts (an array of `GameRules`, keyed by `definition.id`). Only Blackjack exists in v1; Flip 7 is next.

Shared juice primitives in packages/ui (every game reuses them, so all games feel the same): deal (fly-in plus a squash on landing), flip (squash-and-stretch), shake (small or big), flash (color), numberPop (+$75), chipBurst, chipsToPot, chipsToPlayer, badgePulse. Durations stay short, following the brief. A blackjack-level moment is the only "big" one (a Flip 7 "flip 7" bonus is the same tier).

## Table primitives (packages/ui)
One table composition scales from phone to desktop and from heads-up to a full table. Top to bottom:
- **Top zone:** either the `DealerTray` (house games like Blackjack) or `OpponentRows`, which lays out 1 to 3 opponent seats. Each opponent seat shows its name, a difficulty pip (Easy/Medium/Hard), a compact hand (cards scaled down, overlapping), its total or score badge, and a turn highlight. Phone stacks opponents as slim rows; desktop puts them side by side.
- **Middle zone:** pot or deck/discard, and the round's status badge.
- **Bottom zone:** the human's hand with its total badge, on the felt arc, with the action buttons.
- The active seat (`toAct`) gets the same pulse glow whether it's a CPU or the human, so CPU turns read clearly while they play out.
- Opponent seats use `data-testid="seat-<seatId>"` so Playwright can assert on each one.

## Server model (apps/worker)
The server is authoritative. The shoe and hidden cards live only on the server.
- `POST /api/sessions {gameId, config}` parses config with `definition.parseConfig` (400 on invalid), builds seats with `seatsFor`, creates a session with a seed, runs any leading CPU turns, and returns `{sessionId, seats, events, view}`.
- `POST /api/sessions/:id/actions {action, seq}` checks that the human seat is `toAct` (409 otherwise), validates against legalActions, applies, runs the CPU loop, persists every action (human and CPU) to `actions`, and returns `{events, view, wallet}`. `seq` makes retries idempotent: a retried `seq` returns the stored response without re-running anything.
- `GET /api/sessions/:id` returns the current view (for resume after reload).
- `GET /api/history?gameId=` returns finished rounds for this player.
- `GET /api/wallet` returns the balance. A broke player is refilled to the starting bankroll (1,250), and the refill is recorded. Only `economy: 'chips'` games read or write the wallet; `rounds.net` is 0 for score games and their result lives in `summary_json`.
- Identity is an anonymous player id in an httpOnly cookie. There are no accounts in v1.
- D1 tables: `players`, `wallets`, `sessions(id, player_id, game_id, game_version, seed, config, state_json, status, created_at)`, `actions(session_id, seq, seat, action_json, created_at)`, `rounds(id, session_id, round_no, summary_json, net, created_at)`, `wallet_ledger(player_id, delta, reason, ref, created_at)`.
- Dev-only rigging: when `env.DEV_RIG === "1"`, `config.rig` stacks the shoe (e.g. "blackjack", "bust", "split", "dealerbj"), matching the prototype's `?rig=` param. It's never enabled in production.

## Verification bar
- Rules: every rule and payout has a Vitest case with a literal expected result.
- Multi-seat: the engine and worker are proven with a tiny test-only game (for example "high card", 1 human + 1 to 3 CPUs) that exercises turn order, the CPU loop, `turn` events, config parsing, and replay. No Flip 7 rules are needed to prove the platform is ready.
- API: each route is tested against a local D1.
- UI: Playwright runs a full rigged round for each moment (betting, deal, hit, stand, double, split, bust, blackjack, push, dealer blackjack, refill) on phone 390x844 and desktop 1440x900, asserts on DOM state and bankroll, and saves screenshots as CI artifacts.
- The verify-neon-cards skill documents the exact commands so any agent can prove a change before merging.
