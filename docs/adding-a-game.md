# Adding a game

How to add a game to Neon Cards, written for Flip 7 but true for any game. `docs/architecture.md` is the contract; this guide is the order to do it in and the files to touch. Blackjack (`packages/games/blackjack`) is the worked example for a house game, and the test-only High Card game (`packages/engine/src/testing/high-card.ts`) is the worked example for CPU seats and settings. Its dev table (`apps/web/src/dev/high-card.tsx`, playable at `/games/high-card` on local stacks) and `e2e/shell-multiseat.spec.ts` show a multi-seat table on `OpponentRows` with paced CPU turns, and the e2e to copy.

The examples use `flip7` as the id. Replace it with yours.

## 0. What you are building

A game is one package with two entrypoints:

| Entrypoint | Who imports it | May use |
| --- | --- | --- |
| `@neon-cards/game-flip7/rules` | the Worker and the browser | `@neon-cards/engine` only: no React, no DOM |
| `@neon-cards/game-flip7` | the browser shell | the rules plus React and `@neon-cards/ui` |

The Worker runs the rules and the CPU seats; the browser only renders views and plays events. Nothing about seats, difficulty, or turn order is hard-coded in the platform, so a new game needs no platform changes beyond one registry line in each app.

## 1. Create the package

```
packages/games/flip7/
  package.json
  tsconfig.json
  src/
    rules/index.ts      # exports `rules: GameRules`
    rules/*.test.ts     # Vitest picks up packages/**/src/**/*.test.ts
    index.ts            # exports the browser plugin
    view/...            # Table, face renderer, juice map
```

`package.json` (copy Blackjack's and rename):

```json
{
  "name": "@neon-cards/game-flip7",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./rules": "./src/rules/index.ts"
  },
  "scripts": { "typecheck": "tsc -p tsconfig.json" },
  "dependencies": {
    "@neon-cards/engine": "workspace:*",
    "@neon-cards/ui": "workspace:*",
    "react": "^19.3.0"
  }
}
```

`tsconfig.json` is Blackjack's (`extends ../../../tsconfig.base.json`, DOM libs, `jsx: react-jsx`). `pnpm-workspace.yaml` already globs `packages/games/*`. Run `pnpm i`.

## 2. The rules entrypoint (`src/rules/index.ts`)

Export one `GameRules` object. It is three things: the pure `definition`, the CPU `policies`, and the `meta` both registries read.

```ts
import type { GameRules } from '@neon-cards/engine'

export const rules: GameRules<Flip7Config, Flip7State, Flip7Action, Flip7View, Flip7Face> = {
  definition,                 // GameDefinition, step 3
  policies,                   // easy / medium / hard, step 5
  meta: {
    title: 'Flip 7',
    description: 'Flip cards, bank points, and don\'t bust on a repeat. First to 200 wins.',
    economy: 'score',         // never touches the wallet; 'chips' games bet from it
    settings,                 // step 6
  },
}
```

The `definition` is the `GameDefinition` interface in architecture.md (Core data shapes). The rules every game follows:

- **Pure and JSON.** `apply()` never mutates its input, and the same state + action + RNG state gives the same result. `Config`, `State`, `Action`, `View`, and events are plain JSON: no classes, `Map`s, `undefined` values, or functions. The server stores them in D1 and replays rounds from `seed + action log`.
- **`toAct(state)` is the only source of turn order.** Advance it inside `apply()`. It never returns a `house` seat, and returns `null` while nobody can act.
- **`legalActions(state, seat)` is the menu** the Table renders and policies pick from. Return `[]` for any seat that isn't `toAct`. An action that targets another seat (Freeze, Flip Three) carries the target inside the action.
- **`apply()` is the authority.** Throw `IllegalActionError` (from the engine) for anything it rejects; the Worker answers 400.
- **`view(state, seat)` hides everything that seat can't see:** the shoe order, and other seats' hidden cards. Events are public too: deal a hidden card as `faceDown(card)` (same id, `face: null`) and reveal it with a later event.
- **Phases and rounds.** `phase()` is `'betting' | 'playing' | 'settling' | 'over'`; score games start in `'playing'`. Every action that leaves the game in `'settling'` (or moves it into `'over'`) ends exactly one round, and the platform calls `settle()` right then. `settle()` returns one `{seat, delta}` per seat, in points for score games. While nobody can act, `opening()` may return the action that starts the next round (Flip 7's `nextRound`). Blackjack leaves `opening` unset and `toAct` stays on the player for the next bet.
- **`setup()` emits no events.** A game that deals inside `setup` shows that deal as the first view. Flip 7 starts `ready` with an empty table, and the opening action deals.
- **`seats: {min, max}`** counts every seat the roster can return, house seats included (Flip 7: 2 to 4). `house` is the dealer seats the roster appends. Score games use `house: []`.

Test every rule and scoring case with a literal expected result in `src/rules/*.test.ts`, and run a whole round through the engine's `startMatch` / `act` / `replay` the way `packages/games/blackjack/src/rules/match.test.ts` does. Replay must rebuild the same state from the log without running a policy.

## 3. The DeckSpec

Decks are data. A `DeckSpec<Face>` is `{ id, build(): Face[] }`, one copy of the deck, and `Face` is entirely yours: the engine never looks inside it.

- Flip 7's deck already exists: `flip7Deck` and the `Flip7Face` type from `@neon-cards/engine` (94 cards, tested in `packages/engine/src/decks/flip7.test.ts`). Set `definition.deck = flip7Deck`.
- A game with a new deck adds it the same way: a `DeckSpec` with a test that counts every card.
- In `setup()`, build the shoe with `buildShoe(spec, copies, rng)`. Card ids are `${spec.id}-${index}` and never encode the face, so a face-down card keeps its id and the UI can flip it in place. If you reshuffle mid-session, pass a fresh `idPrefix` so ids stay unique.
- Use only the `rng` you are given (`rng.int(n)`, `shuffle(items, rng)`), never `Math.random()`, or replay breaks.

Optional, for e2e: accept a dev-only `config.rig` in `parseConfig` that stacks the top of the shoe, like Blackjack's `rules/rigs.ts`. The Worker rejects `rig` unless `DEV_RIG=1`, which every local script and e2e run sets. Give rigs names that describe a moment (`bust`, `flip7`, `freeze`).

## 4. Seats

The roster builds the seat list. A game does not. `soloSeats(definition, config)` in `@neon-cards/engine` is the solo builder. It reads `opponents`, `difficulty`, and `position` from the parsed config.

Score games get one human `you` (name `You`), then `cpu-1` onward at that difficulty. `position: 'last'` puts the human after the CPUs. A definition with `house` seats (Blackjack) gets human `player` plus those house seats, and ignores `opponents`.

There is exactly one `human` seat in a solo game. The shell finds it by `kind`. `difficulty` appears only on `cpu` seats. House seats are played by the rules inside `apply()` and never get a policy. `setup(config, seats, rng)` receives the list. It does not build it.

## 5. CPU Policy

Every difficulty a `cpu` seat can have needs a policy:

```ts
import type { Policies, Policy } from '@neon-cards/engine'

const policies: Policies<Flip7View, Flip7Action> = {
  easy: { choose: (view, legal, rng) => legal[rng.int(legal.length)]! },
  medium: stayAt(20),
  hard: stayAt(27),
}
```

- **Pure, and sees only the view.** `choose(view, legal, rng)` gets `view(state, seat)` for that CPU seat, never full state, so a policy can't cheat. It must return one of `legal`. The engine throws if it doesn't, or if a seat's difficulty has no policy.
- **The server runs CPU seats.** After each human action the engine loops while `toAct` is a CPU seat. It applies each choice, logs it like a human action, and prefixes its events with `{type: 'turn', seat}`. CPU randomness comes from a separate stream (`cpuRng(seed, seq)`), so policies never shift the deck.
- **Test each difficulty** on fixed views with literal choices, plus one test that a hard CPU beats an easy one over seeded rounds. High Card's `swapBelow` is the minimal pattern.

## 6. Settings

Settings are choice lists declared in `meta.settings`. The shell draws them as segmented pixel buttons on a pre-game sheet, remembers the last choice per game, and sends them as `config`:

```ts
import { parseSettings, type SettingSpec } from '@neon-cards/engine'

const settings: SettingSpec[] = [
  { key: 'opponents', label: 'Opponents', options: [1, 2, 3].map((n) => ({ value: n, label: String(n) })) },
  { key: 'difficulty', label: 'Difficulty', options: [
    { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' },
  ] },
]

const defaultConfig: Flip7Config = { opponents: 2, difficulty: 'medium' }
const parseConfig = (input: unknown) => parseSettings(settings, defaultConfig, input)
```

- The flow is `POST /api/sessions {gameId, config}`, then `parseConfig` (a `ConfigError` is a 400), then `soloSeats(definition, config)` and `setup(config, seats, rng)`.
- `parseSettings` takes missing keys from the defaults and rejects values not on the list. It never coerces (`"3"` is not `3`). Parse your extras, such as `rig`, next to it.
- The pre-game sheet pre-selects, per key, the remembered choice if it's still offered, else `defaultConfig`, else the first option. Pick a `defaultConfig` that is a good first game.
- A game with no `settings` skips the sheet and deals straight in (Blackjack).

## 7. The React entrypoint (`src/index.ts`)

Export a `GamePlugin`: the same `rules`, plus a `Table`, a `faceRenderer`, a `juice` map, and a `guide`. The types come from `@neon-cards/ui`. `guide` is a `GameGuide` built with `defineGuide`. The shell paints that document. It does not import your sentences or your faces.

```ts
import { definePlugin } from '@neon-cards/ui'
import { rules } from './rules'
import { Flip7Table } from './view/Table'
import { flip7Face } from './view/face'
import { guide } from './view/guide'
import { juice } from './view/juice'

export { rules }
export const plugin = definePlugin({ rules, Table: Flip7Table, faceRenderer: flip7Face, juice, guide })
```

**The Table** receives `TableProps<Flip7View, Flip7Action>`:

- `seats`, `humanSeat`, `view` (the human's view after the batch), and `events` (an `EventBatch`, one per server response).
- `act(action)` resolves once the next batch arrives. `busy` is true while a request is in flight.
- `wallet` is always `null` for score games.
- `hudIcons` holds the shell's sound and settings buttons. The shell draws no HUD over a live table, so put `hudIcons` at the right of your top bar.

Compose the Table only from `@neon-cards/ui` primitives so every game feels the same: `TableLayout` (hud / top / middle / bottom / controls), `OpponentRows` for the CPU seats (it sets `seat-<id>` test ids), `Hand` and `PlayingCard`, `PlayerSpot`, `ScoreBadge` / `StatusBadge`, `ActionBar`, and `NeonButton`. Look at the kit gallery (`/ui-gallery.html?scene=opponents&n=3`, `scene=juice`, and `scene=sheet` on any running stack) before inventing anything. If a primitive is missing, add it to the kit in its own PR rather than in the game.

Play events with `useBatchPlayback(events, { juice, seats, apply })`. `apply(event)` advances your displayed model one event at a time, and the hook adds the CPU thinking beat on `turn` events and lets a tap skip to the end. Show `view` once playback finishes. Never diff views to guess what happened; that's what events are for.

**The face renderer** is a `CardFaceRenderer<Face>`: `deck` (the DeckSpec id), `tone(face)`, `label(face)` (used for aria labels and test assertions, e.g. `"7"`, `"+4"`, `"FREEZE"`), and `render(face, ctx)`. The kit owns the frame, back, and flip. A starting Flip 7 renderer is in `packages/ui/src/gallery/flip7-face.tsx`, and standard cards use `standardFaceRenderer`.

**The juice map** goes from your event `type` to kit primitives (`deal`, `flip`, `shake`, `flash`, `numberPop`, `badgePulse`, and the chip moves). Unmapped events apply without effect. Keep effects short; a Flip 7 "flip 7" bonus is the one big moment, the same tier as a blackjack.

## 8. Register it (one line per app)

Add the dependency to both apps, then one line per registry:

```ts
// apps/worker/src/games.ts: rules only, never the React entrypoint
import { rules as flip7 } from '@neon-cards/game-flip7/rules'
export const games: GameRules[] = [blackjack, flip7]
```

```ts
// apps/web/src/games.ts: lobby order is array order
import { plugin as flip7 } from '@neon-cards/game-flip7'
export const games: GamePlugin[] = [/* blackjack */, flip7]
```

Add `"@neon-cards/game-flip7": "workspace:*"` to `apps/web/package.json` and `apps/worker/package.json`, then `pnpm i`. That's all the platform wiring:

- The lobby tile, `/games/flip7`, the pre-game sheet, and the history filter come from `meta`.
- Session create, resume, and actions with the server `seq` are handled by the shell.
- `economy: 'score'` keeps the wallet pill hidden on your table and `net` at 0 in history.

## 9. e2e

Write `e2e/flip7*.spec.ts` against the real Worker and run it at phone 390x844 and desktop 1440x900 (`pnpm e2e` runs both projects). Assert on `data-testid` and `data-*` state, never CSS classes or copy. Cover:

- **Settings and setup.** On `/games/flip7`, `pregame` shows `pregame-opponents` and `pregame-difficulty` (each with `data-value` and buttons `pregame-<key>-<value>`). Pick values, tap `pregame-play`, and expect `game-screen` with `data-state="playing"` and one `seat-cpu-<n>` per opponent. Reload `/games/flip7` and the session resumes. In the settings sheet (`hud-settings`), `new-game` drops it and brings the sheet back with your last choices pre-selected.
- **Every moment, rigged.** Use `/games/flip7?rig=<name>` (rigged URLs always start fresh; `&seed=<s>` pins the CPU stream). Cover a bust on a repeat, bank, Freeze, Flip Three, Second Chance, the x2 and +N modifiers, the flip-7 bonus, and game over. Wait for playback to settle before asserting, e.g. on a `data-busy="false"` attribute on your table root.
- **History.** After a round, `hud-settings` then `table-history` lands on `/history?game=flip7`, where `history-round` shows the round.

Then prove it with the verify skill: add `.cursor/skills/verify-neon-cards/features/flip7.md` (test ids, rigs, `verify.sh drive` commands, gotchas), add its row to `features/README.md`, and run `pnpm verify drive --path "/games/flip7?rig=…" …` at both viewports before merging.

## Checklist

- [ ] `packages/games/flip7` with `./rules` (no React) and `.` entrypoints
- [ ] `definition` is pure JSON in and out, `view` hides hidden info, `apply` throws `IllegalActionError`
- [ ] `definition.deck = flip7Deck`, shoe from `buildShoe`, only the given `rng`
- [ ] `house` on the definition; a policy for each of easy, medium, and hard, tested, when the roster can return CPU seats
- [ ] `meta.settings` plus `parseConfig` via `parseSettings`, with a sensible `defaultConfig`
- [ ] `plugin` with Table from kit primitives, `useBatchPlayback`, face renderer, juice map, and `hudIcons` in the top bar
- [ ] One line in `apps/worker/src/games.ts` and one in `apps/web/src/games.ts`, plus both `package.json` deps
- [ ] Rules unit tests, `e2e/flip7*.spec.ts` at phone and desktop, verify feature file, decisions in `docs/decisions.md`
