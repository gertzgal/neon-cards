# Neon Cards: decisions

Append-only log. Every PR adds the decisions it made, dated, with who made the call.

## Setup
- pstack budget stays medium (high reasoning). Every role uses inherit-parent. Confirmed by Gal on 2026-10-11.

## 1. Look and feel (in progress)
- Art direction is chunky pixel art with a mild CRT glow (light scanlines) and a soft card wobble, close to Balatro. Gal picked this on 2026-10-11.
- Palette is a dark neon casino: near-black table with hot pink and cyan glow. Gal picked this over classic green felt on 2026-10-11.
- Cards have dark faces with neon-outlined pips and ranks. Gal picked this over cream faces on 2026-10-11. Note that ranks must stay large and high-contrast so they read on a phone.
- Game feel is juicy but tight: snappy deals with a flip squash, a small screen shake on a bust, and a big payout number pop with a chip burst on blackjack. Big effects are saved for blackjacks and big wins. Gal picked this on 2026-10-11.
- Audio is a lo-fi synthwave background loop with crunchy chiptune sound effects (card snaps, chip clinks, a rising arpeggio on blackjack). There's a mute button with separate music and effects toggles. Gal picked this on 2026-10-11.
- Layout is two dedicated layouts with equal priority: phone portrait and desktop wide. Gal picked this on 2026-10-11, accepting roughly double the layout work.
- Chips are chunky pixel coins with neon rims, one color per value (5, 25, 100, 500). I chose this since it follows from the art and palette picks.
- The full brief is in look-and-feel-brief.md. Gal approved it on 2026-10-11 and asked for two throwaway table sketches.

## Standing rules
- Every cloud agent must run Opus 5.5 at medium effort (Gal, 2026-10-11).
- 2026-10-11: Gal rejected both of my sketches (the desktop versions were cluttered with panels and extra text) and drafted a minimal mock, saved at refs/gal-minimal-mock.png. It's now the visual reference. It has just the bankroll at the top left, sound and settings icons, a dealer tray, the pot, the player hand with a total badge, and the buttons on a pink felt arc, with swirling pink and cyan pixel noise at the edges. Desktop is the same composition with more breathing room.
- 2026-10-11: Gal adopted their minimal mock with my fixes: a dimmed face-down card back, slow or static edge swirl on phones, buttons kept fully tappable where the cards overlap the arc, and a betting step plus result moments still to design. This replaces the earlier "two separate layouts" decision with ONE layout that scales from phone to desktop.
- Version one leaves out insurance and surrender (I proposed this; Gal hasn't objected). Actions are Hit, Stand, Double, and Split.
- Next step is a live clickable throwaway prototype of betting, deal, bust, and blackjack, built from the mock.
- 2026-10-11: Live prototype 2 is done at prototype2/index.html, with screenshots in prototype2/shots/. It's playable and its bankroll math checked out. Known weak spots: the empty dealer tray during betting, the blackjack burst covering the tray, a small desktop HUD, and chip colors (the brief says one color per value: 5 cyan, 25 pink, 100 violet, 500 gold).

## 1. Look and feel: LOCKED (Gal, 2026-10-11, "look and feel is perfect")

## 2 + 3. Tech and agent stack (Gal, 2026-10-11)
- Gal asked for a card-game PLATFORM (plugins, theming, a shared UX across games), with Blackjack as game one, Flip 7 and others later, and CPU players later.
- The backend is Hono on Cloudflare Workers with D1 (SQLite) through Drizzle. Gal asked for whatever DB Workers work best with that's easy for agents to self-verify; local D1 through wrangler dev covers that.
- The frontend is Vite + React with DOM-animated cards plus a canvas only for the CRT and swirl. I chose this so Playwright can verify the UI through the DOM.
- The repo is a new private GitHub repo. Work runs as multiple Cursor Projects on full autopilot: agents merge their own PRs after green CI, with no human in the loop. Gal's only stop condition is failing to create the private repo.
- Full contract is in architecture.md, and the plan is in plan.md.

## 4. Flip 7 readiness (Gal, 2026-10-11)
- Gal added Flip 7 to the morning Definition of Done: single player against 1 to 3 CPU opponents with selectable difficulty (Easy, Medium, Hard), multiplayer later. No Flip 7 rules get built tonight; the platform must be ready for them. Recorded as contract sections in architecture.md (Multi-seat turn order, CPU seats, Game settings, Card faces, Table primitives) and as DoD items in plan.md.
- Contract conflicts found and resolved the simple way (Platform agent, 2026-10-11):
  - The contract had no notion of whose turn it is. Added `toAct(state)` and `seatsFor(config)` to `GameDefinition`; turn order is the seat order, and only `human`/`cpu` seats are ever to act. The blackjack dealer stays a `house` seat played inside `apply()`.
  - `Policy` existed but nothing ran it. CPU seats run on the server after each human action; their actions are logged like human actions, so replay never re-runs a policy. A separate CPU RNG stream (seed + seq) keeps the deck order independent of CPU choices.
  - "The UI never diffs state" plus "CPU turns animate" means the server must say who acted. Each CPU action comes back as a `{type: 'turn', seat}` event followed by its normal events, all in one response; the UI paces them (about 500 ms thinking beat, tap to skip), like Balatro scoring a hand step by step.
  - The plugin bundled React with the rules, but the Worker must run rules and policies. Each game package now has a pure `/rules` entrypoint plus the React plugin entrypoint, and there are two one-line registries (web and worker).
  - Settlement deltas and the wallet assumed chips. Flip 7 is score-based, so `meta.economy` is `'chips' | 'score'` and only chip games touch the wallet. Flip 7 vs CPU does not wager chips in v1.
  - Phases assumed betting. Games without betting start in `'playing'`.
  - Config came from the client unvalidated. Added `parseConfig(input)` at the API boundary (400 on invalid). Settings shown to the player are declared as choice lists in `meta.settings` and remembered per game in localStorage.
  - The multi-seat proof uses a tiny test-only game instead of Flip 7 rules, so the Engine and Worker PRs can prove turn order and the CPU loop without building Flip 7.

## 5. Foundation (Platform agent, 2026-10-11)
- Migrations live in `apps/worker/migrations` (architecture.md said `apps/api/migrations`, which contradicted its own layout). Fixed the contract.
- `@cloudflare/vitest-pool-workers` is deprecated and renamed to `@cloudflare/vitest-plugin`; the API tests use the new name.
- TypeScript is pinned to 6.0 (typescript-eslint does not support 7 yet) and Vitest to 4.1 (required by the Workers Vitest plugin).
- Workspace packages are consumed as TypeScript source (`exports` points at `src/index.ts`); there is no per-package build step. Vite and Wrangler bundle them.
- Game packages are named `@neon-cards/game-<id>` (for example `@neon-cards/game-blackjack`), with `@neon-cards/game-<id>/rules` as the pure entrypoint.
- The Foundation migration only creates a `meta` table that `/api/health` reads. The Worker API PR owns the real schema (and Drizzle).
- `packages/engine` exports the contract types as type declarations only, so the Blackjack project can build against them now. The Engine PR adds the runtime code.
- Deploy is a documented one-command step (`pnpm run deploy`). Agents can't read repo secrets, so there's no automatic deploy workflow yet.
- Merge mechanism: Platform agents have git push but no GitHub merge API (the GitHub MCP server was down and the `gh` CLI is read-only). PRs land by fast-forwarding `main` to the exact head that CI tested (`git push origin HEAD:main`), which keeps "never merge red" exact and makes GitHub mark the PR merged. Squash-merge is used whenever a merge tool is available. Steps are in AGENTS.md.

## 6. Blackjack rules (Blackjack agent, 2026-10-11)
- The round is a three-phase state machine: `betting` → `playing` → `settling`. The `bet` action places the wager and deals in one step; the next `bet` from `settling` starts the next round, so a round enters `settling` exactly once.
- `toAct` is always the player. In blackjack the player can act in every phase (bet, refill, or play the hand), so `settling` is not a "nobody can act" phase here. The dealer is the `house` seat `dealer`, played inside `apply()`.
- The seat's chip stack lives in game state (`config.bankroll` seeds it; the server should pass the wallet balance). Bets, doubles, and splits debit it immediately; settlement credits the payout. `settle()` returns the round's net, so wallet += delta keeps the wallet equal to the stack after every round.
- Refill is a game action, legal only when the stack is below the 5 minimum bet. It restores the stack to 1,250 and emits a `refill` event with the amount, which the server ledgers. It also returns the phase to `betting`. Keeping it inside the rules keeps replay pure.
- Blackjack pays 3:2 rounded down to whole chips ($5 pays $7, $25 pays $37). Chips are 5/25/100/500, so the economy stays integer.
- Any two ten-value cards can split (K+10), one split only, split aces get one card each and can't be hit, 21 after a split pays 1:1, and double after split is allowed. Splitting deals the second card to both hands at once, which reads better on screen and doesn't change the odds.
- A hand that reaches 21 stands automatically.
- The dealer peeks under an ace or a ten-value card. On a dealer blackjack the round ends at once and only the original bet is lost (no doubles or splits have happened yet).
- `legalActions` returns one suggested `bet` (the last bet, capped by the stack); `apply` validates the actual amount (whole number, at least 5, a multiple of 5, at most the stack) and throws `IllegalActionError` otherwise.
- Hidden information: the hole card appears as `{id: 'hole', face: null}` in both `view()` and the `deal` event, so its real card id never reaches the client before the `reveal` event. The view exposes only the shoe's size and remaining count.
- `config.rig` takes a named rig (the prototype's names plus `splitaces`, `bjpush`, `dealerbust`, `soft17`) or a literal card list such as `"AH,9C,KS,7D"`. It restacks the shoe at the start of every round, pulling those exact cards out of the shoe so card ids stay unique.
- Blackjack uses the engine's `buildShoe`, `standard52`, `createRng`, `IllegalActionError`, and `ConfigError` (bad config, including an unknown rig card, is a 400). A mid-session reshuffle uses the id prefix `standard52.r<round>`, so new card ids never repeat ones the table has already animated.
- `rules.meta`: title "Blackjack", economy `chips`, minBet 5, no settings.

## Worker API (Platform agent, 2026-10-11)
- The D1 schema is hand-written SQL in `apps/worker/migrations` (wrangler applies it, tests apply it), with a Drizzle mirror in `apps/worker/src/db/schema.ts` used for every query. No drizzle-kit: its generated file names and `meta/` journal don't match the `NNNN_name.sql` convention, and one hand-kept mirror is simpler to review.
- Timestamps are Unix epoch milliseconds (`INTEGER`).
- `actions` gains a nullable `response_json` column holding the stored response of each human action, so a retried `seq` returns it byte-for-byte without re-running anything. Contract updated.
- "Broke" means a balance below 5, the smallest chip, because a player with 1 to 4 chips can't place any bet. Contract updated.
- A new player starts with a `wallet_ledger` row `(+1250, 'start')`, so the ledger always sums to the balance.
- The identity cookie is `nc_player` (httpOnly, SameSite=Lax, one year, `Secure` only over https so local http dev works). A cookie naming an unknown player (for example after a local D1 wipe) is replaced with a new player.
- The `meta` schema marker stays `foundation`, so the shell's health line and the smoke e2e don't churn with every migration.

## Engine contract (Engine agent, 2026-10-11)
- `meta` (title, description, economy, minBet, settings) moves from the React `GamePlugin` to the pure `GameRules`. The Worker registry only sees `GameRules` and must know `economy` to decide whether to touch the wallet. `GamePlugin` keeps `rules`, `Table`, `faceRenderer`, and `juice`, and lives in packages/ui because it needs React types.
- `apply()` is the authority on legality and throws the engine's `IllegalActionError` (400). `legalActions()` is a menu with a representative value for parameterized actions (Blackjack's bet amount), so "validate against legalActions" by equality could never accept a custom bet. The engine checks `toAct` first and throws `NotYourTurnError` (409).
- Face-down cards are `CardView<Face> = Card<Face | null>` with `face: null`, the convention the Blackjack branch already uses. Card ids never encode the face (they are shoe positions), so a hidden card can keep its real id and flip in place. Blackjack's placeholder `hole` id is also fine.
- Events are public and never leak hidden information; private information reaches a seat only through `view()`. Per-seat event redaction is deferred to real-time multiplayer, where poker hole cards will need it.
- `toAct` may return a seat during `'settling'` so it can start the next round (Blackjack's next bet). A round ends when an action moves the phase into `'settling'`, or into `'over'` from any other phase; the engine calls `settle()` exactly then and reports it in `Step.rounds`.
- The CPU loop does not stop at the end of a round. It runs until no CPU seat is to act, so a CPU that ends a round can never deadlock the session. Every finished round in the step is reported, in order.
- The engine owns the session loop (`startMatch`, `act`, `replay` over a JSON `Match`), not the Worker. Turn order, `turn` events, the CPU RNG stream, and settlement then work the same for every game and are proven once in engine tests.
- RNG is sfc32 seeded from a string. The deck RNG is one stream per session whose `state()` is persisted in the `Match`; `cpuRng(seed, seq)` is `createRng(`${seed}:cpu:${seq}`)` with `seq` the CPU action's log index.
- Config, State, Action, View, and events must be plain JSON, since D1 stores them and HTTP carries them.
- The test-only "high card" game ships from `@neon-cards/engine/testing` so Worker tests can register it.
- `parseSettings` takes only exact option values (no `"2"` → `2` coercion) and ignores undeclared keys, so a game can parse extras such as the dev `rig` next to it. Invalid config throws `ConfigError`, which the server maps to 400. (Engine agent, 2026-10-11)
- `standard52` uses Blackjack's face shape (`{rank: 'A'|'2'..'10'|'J'|'Q'|'K', suit: 'H'|'D'|'S'|'C'}`) so the Blackjack package can import it unchanged. (Engine agent, 2026-10-11)

## Blackjack table (Blackjack agent, 2026-10-11)
- The table takes the UI kit's `TableProps` shape (`view`, `events: {id, events}`, `act`, `busy`), mirrored locally in `packages/games/blackjack/src/view/contract.ts` until the UI PR lands. It plays each event batch one event at a time through a display reducer, so every card, flip, chip, and result gets its own beat. A test replays every rig and checks that the reduced display ends equal to the server's final view.
- The UI kit's primitives are API-only right now, so the table draws its own cards, chips, HUD, and action bar with the prototype's styles (prefixed `bj-`). It moves onto `@neon-cards/ui` components once they exist.
- One chip color per value: 5 cyan, 25 pink, 100 violet, 500 gold (prototype review).
- No dealer tray during betting; it appears with the first dealt card (prototype review).
- The blackjack chip burst sprays sideways and down from the player's hand, capped below the dealer row and drawn under it, so it never covers the dealer cards (prototype review).
- The desktop HUD is larger: 40px bankroll, 34px icons (prototype review).
- After a round the last bet goes back on the felt automatically (Balatro-style "one tap to go again"). When the stack drops below 5 the table sends `refill` by itself.
- Keyboard: H hit, S stand, D double, P split, Space deal, Backspace clear.
- Stable test ids for e2e: `blackjack-table` (`data-stage`, `data-busy`), `hud-bankroll`, `dealer-hand`, `dealer-total`, `hand-N` (`data-status`, `data-outcome`, `data-active`), `hand-N-total`, `bet-amount`, `chip-<value>`, `action-<clear|deal|hit|stand|double|split>`, `result-pop`.
- `pnpm --filter @neon-cards/game-blackjack dev` serves a standalone harness on :5199 that runs the rules in the browser (`?rig=split`, `?bankroll=10`, `?seed=7`, `?mute`). It's for development only; the real game talks to the Worker.


## Web shell (Platform agent, 2026-10-11)
- Routing is a 40-line History API router over a pure `parseRoute`/`hrefFor` pair (`apps/web/src/routes.ts`), not react-router. The shell has four routes (`/`, `/games/:id`, `/history?game=`, not found), and the Worker already serves the SPA fallback.
- Settings is a sheet over the current screen, opened from the HUD gear, not a route. Leaving the table to change the music would unmount the game; Balatro's options menu overlays the run the same way.
- Shell settings are `muted`, `music`, `sfx`, and `motion: 'system' | 'full' | 'reduced'` (shown as Auto / Full / Calm), stored in localStorage under `neon-cards:settings`. The HUD speaker is the master mute; the sheet has the separate music and effects toggles from the brief. The resolved motion level lands on `<html data-motion>` so CSS and the UI kit can read one attribute.
- Per-game settings resolve per key: the remembered choice if it's still offered, else the game's `defaultConfig` value if offered, else the first option. Values are never coerced (`"3"` is not `3`). The shell sends only the chosen settings as `config`; the game's `parseConfig` fills the rest.
- Games without settings skip the pre-game sheet and deal straight in, like opening a Balatro run. Games with settings always show the sheet before a new session.
- The shell owns the session: it stores the session id per game in localStorage, resumes it with `GET /api/sessions/:id` after a reload, and hands the Table `act()`. The HUD back arrow keeps the session (come back and resume); "New game" in the in-game settings sheet drops it.
- The wallet pill shows on the lobby and in `chips` games and hides in `score` games. It shows `$—` when the wallet API can't be reached rather than a fake number.
- The lobby shows an empty state until a game is registered, so the shell can land before Blackjack.
- `docs/decisions.md` is marked `merge=union` in `.gitattributes`. Every PR appends to it, so parallel PRs always conflicted on rebase; union keeps both sides' new lines.
## Engine runtime (Engine agent, 2026-10-11)
- A round ends on every action whose result is `'settling'`, not only on a phase change into it. Blackjack's `bet` from `'settling'` deals and resolves a natural in one action (settling to settling), and that round must still settle. (Engine agent, 2026-10-11)
- `setup()` stays event-free, so the merged Blackjack rules don't change. A game that deals in `setup()` gets its opening deal animated from the first view. (Engine agent, 2026-10-11)
- `act()` only accepts `human` seats, so a client can never drive a CPU seat even if the server forwards a bad seat id. A match whose `version` differs from the rules' throws instead of running old state through new rules. (Engine agent, 2026-10-11)
- Policies receive JSON copies of their view and legal actions, so a policy that mutates its input can't corrupt state or replay. A CPU loop past 1,000 actions throws as a rules bug. (Engine agent, 2026-10-11)
- The test game is "high card": each seat keeps or swaps one face-down card, the highest rank scores a point, ties all score, three rounds. The human starts each next round from `'settling'`, and the last round ends straight in `'over'`, so it covers both settle paths. A `position: 'first' | 'last'` setting puts CPU turns before the human. Policies: easy picks at random from `cpuRng`, medium swaps below 8, hard swaps below 10. (Engine agent, 2026-10-11)
- Error mapping for the Worker: `ConfigError` and `IllegalActionError` are 400, and `NotYourTurnError` is 409 (including acting on a finished match, where nobody is to act). Any other throw from `startMatch`, `act`, or `replay` (wrong seat kind, version mismatch, a policy bug) is a server bug and stays a 500. `replay` takes an optional `version` and rejects a log from other rules. (Engine agent, 2026-10-11)
## Flip 7 deck (Engine agent, 2026-10-11)
- The Flip 7 DeckSpec lives in `packages/engine` (`flip7Deck`, deck id `flip7`) per the plan, with its `Flip7Face` type, so the future Flip 7 package imports it the way Blackjack imports `standard52`. It builds one 0, n copies of each number n from 1 to 12, one each of +2, +4, +6, +8, +10, and x2, and three each of Freeze, Flip Three, and Second Chance: 94 cards. No Flip 7 rules. (Engine agent, 2026-10-11)

## UI kit (Platform UI agent, 2026-10-11)
- `@neon-cards/ui` exports the browser-side plugin types: `GamePlugin` (`rules: GameRules` from the engine, `Table`, `faceRenderer`, `juice`), `TableProps`, `EventBatch`, `CardFaceRenderer`, and `JuiceMap`. `SettingSpec` and `GameMeta` stay in the engine and are re-exported. `definePlugin()` erases a plugin's generics for the registry array instead of using `any`.
- `TableProps` was not in the contract; added to architecture.md in the shape the Blackjack table already mirrors. The Table gets the human's final `view` plus the response's `EventBatch` and plays the batch itself, so the UI animates from events and never diffs state.
- Table primitives take the engine's `CardView<Face>` (`face: null` is face-down) directly, so a view's cards render without mapping. The card component is `PlayingCard`, because the engine already exports a type named `CardView`.
- Theme tokens follow the prototype: background `#050409`, table `#0b0b12`, pink `#ff2e88`, cyan `#2ef2ff`, violet `#a64dff`, gold `#ffd23f`, bust `#ff2e5a`. Chips are 5 cyan, 25 pink, 100 violet, 500 gold. The phone composition applies below 700px, as in the prototype.
- The pixel font is Jersey 10, self-hosted through `@fontsource/jersey-10` so the app and e2e screenshots never depend on Google Fonts.
- Juice targets are an element or a `data-testid`, so game juice handlers address the same handles Playwright uses.
- The UI kit's dev gallery is a second Vite entry, `apps/web/ui-gallery.html`, whose code lives in `@neon-cards/ui/gallery`. It ships in every build as a static page with no API calls, so the verify skill and Playwright can prove primitives on the production-shaped stack. The shell's own entry stays `index` so the verify doctor's bundle check is unchanged. (Platform UI agent, 2026-10-11)
- One table composition (`TableLayout`: HUD, top, middle, bottom, controls on the felt arc) for every game. On phone the total badge drops its left spacer, as in the prototype, so the hand and badge fit 390px. (Platform UI agent, 2026-10-11)
- Long hands shrink their cards (down to 60%) once each covered card would show less than 45% of itself, so Flip 7 runs of 7+ cards stay readable on a phone. Opponent (compact) cards never shrink. (Platform UI agent, 2026-10-11)
- Opponent seats show name, a three-pip difficulty meter (easy cyan, medium violet, hard pink), a compact overlapping hand, a small cyan total badge, and a status word. The active seat gets the same pink pulse as the human's active hand; a reduced-motion user gets a steady glow. (Platform UI agent, 2026-10-11)
- The empty dealer tray during betting shows a faint "BLACKJACK PAYS 3:2"-style print (`placeholder`) instead of an empty box. Games may also omit the tray until the first deal, as Blackjack does. (Platform UI agent, 2026-10-11)
- The desktop HUD uses the Blackjack table's sizes (40px bankroll, 34px icons), so moving that table onto the kit is a visual no-op. (Platform UI agent, 2026-10-11)
- The UI kit ships `standardFaceRenderer` for the engine's standard 52 faces, so Blackjack and later poker share one card look. Flip 7's renderer stays in the gallery as the proof that faces are game-defined; the Flip 7 package owns its real one. (Platform UI agent, 2026-10-11)
## Blackjack on the engine runtime (Blackjack agent, 2026-10-11)
- `definition.seats` is `{min: 2, max: 2}`: the engine counts every seat `seatsFor` returns, including the `house` dealer. The old `{1, 1}` made `startMatch` refuse Blackjack.
- `match.test.ts` drives Blackjack through the engine's `startMatch`, `act`, and `replay`: one settlement per finished round, a natural settling inside the bet action, refill not counted as a round, and replay of a six-round session matching the live match, events, and rounds exactly.
## Blackjack polish (Blackjack agent, 2026-10-11)
- The table follows the shell's motion setting (`<html data-motion="reduced|full">`) and falls back to the OS `prefers-reduced-motion` when it runs standalone. Reduced motion stops the card sway, skips deal fly-ins, and trims the chip burst to 8 chips.
- On desktop (hover plus a fine pointer), the player's cards tilt up to 9° toward the pointer, strongest near the card, as the brief asks. Phones and reduced motion get no tilt.
- Chips render as cached `<img>` data URLs instead of inline SVG. The blackjack burst used to put about 6,000 SVG rects on screen and caused a 150 ms frame on a 4x-throttled phone; now the worst frame is about 50 ms and idle stays at 60 fps.
## Blackjack seat count fix (Platform worker agent, 2026-10-11)
- Blackjack declared `seats: {min: 1, max: 1}`, but `seatsFor` returns the player and the house dealer, and the contract counts house seats in `seats.min`/`seats.max`. The engine's `startMatch` rejects that mismatch, so every Blackjack session start failed in the Worker. Changed it to `{min: 2, max: 2}` with a test, the smallest change that unblocks the Worker API (an edit in the Blackjack project's path, logged here per AGENTS.md).

## Worker sessions API (Platform worker agent, 2026-10-11)
- The Worker drives every game through the engine's `startMatch`/`act` and stores the whole `Match` JSON in `sessions.state_json`; `seed` and `config` are also kept in their own columns for history and replay. Each step is one D1 batch (a transaction): session update, every logged action, rounds, wallet rows. Two requests racing on the same `seq` collide on the `actions` primary key; the loser returns the winner's stored response.
- `seq` is the engine's `Match.seq` (the action log's length, CPU actions included), and every session and action response returns the next one. The shell sent `seq + 1` from a client-side counter, which breaks as soon as a CPU acts; `apps/web/src/session.ts` now sends back the server's `seq` (a three-line change in the shell's path).
- Chips games get `config.bankroll` from the wallet, server-side. A player has at most one active chips session: starting one closes the others (`status = 'over'`), because two live stacks over one wallet could drive it negative. Abandoning a round mid-hand costs nothing in v1, since the wallet only moves at settlement.
- Round nets settle into the wallet as `wallet_ledger(reason 'round', ref '<sessionId>:<roundNo>')`. A `refill` event on the human seat refills a broke wallet exactly like `GET /api/wallet`, and is a no-op if the wallet was already refilled, so the two refill paths can't double-credit.
- A round's `summary_json` is `{settlements, view?}`. Only the last round finished in a step gets the closing `view`, because a CPU loop can run past one round's end into the next.
- Registry injection: `createApp(games)` builds the API over a registry. `src/index.ts` passes the production registry (`src/games.ts`); Worker tests add the engine's test-only `highCard`, so it never reaches production.
- Errors map by `name`: `IllegalActionError` is 400 and `NotYourTurnError` is 409 (also matched when a game throws its own subclass); a `parseConfig` throw is 400; anything else is a logged 500 `{error: 'internal error'}`. Error bodies are `{error: string}`.
- Sessions created by an older `definition.version` answer 409 on new actions instead of running new rules over old state.
- Local stacks set `DEV_RIG=1` through `wrangler dev --var` in `apps/worker` scripts, so rigged e2e rounds work in `pnpm dev`, `pnpm start`, Playwright, and the verify skill, and production never has it. The dev-only `seed` request field rides the same switch.

## Pixel font (Blackjack agent, 2026-10-11)
- The theme names `'Jersey 10'` everywhere, but the shell never loaded it (only `packages/ui`, which the shell doesn't import yet, pulls in `@fontsource/jersey-10`), so the built app fell back to the system monospace. `apps/web/src/main.tsx` now imports `@fontsource/jersey-10` too, the same package and version range as the UI kit, so the font is bundled and self-hosted with no CDN. Done as a small platform PR because the Blackjack screenshots need it.
## UI kit juice (Platform UI agent, 2026-10-11)
- Juice is a `JuiceMap` from event `type` to a handler `(event, kit) => void | Promise<void>`, and `usePlayback`/`useBatchPlayback` run the queue: apply the event to the display (inside `flushSync`, so the DOM is current), then await its juice. Unmapped types apply with no effect. Handlers are bivariant, so a game can type `event` as its own union.
- The kit addresses elements by `data-testid` within the NeonRoot stage, or by element. Games reuse the test ids the primitives already set (`card-<id>`, `seat-<id>`, `pot`, `player-total`) and need no refs.
- A `turn` event on a CPU seat (from `PlaybackOptions.seats`) gets a 500ms thinking beat with `actingSeat`/`thinking` set, so the Table can show the glow and a THINKING status. A human `turn` sets `actingSeat` with no beat.
- Flips happen after apply: the face is already in the DOM, a card-back cover scales out, and the face stretches in. Event application stays a pure model update, with no midpoint callback to coordinate.
- A tap anywhere while playing skips: running animations finish, waits resolve, the fx layer clears, and the remaining events apply with no juice. Playback never blocks input for longer than one tap.
- Under reduced motion, deal and flip become short fades, pops and flashes stay (they carry information), and shake, slide, and chip bursts are skipped.
- `chipBurst` takes a `ceiling` target, and its chips never rise above that element's bottom. That keeps the Blackjack win burst off the dealer tray.
- NeonRoot finds its stage and fx layer through a `useId` `data-nc-root` attribute instead of refs, which keeps the React compiler's ref rules clean and lets several roots coexist.

## UI kit audio (Platform UI agent, 2026-10-11)
- `getAudio()` returns one app-wide `AudioManager`, and the music loop and every sound effect are synthesized with WebAudio, so there are no audio assets to load. Effects port the prototype's `snd()` tones, plus `click` and a two-note `turn` chime. The loop is a 100 bpm synthwave bar cycle (Am, F, C, G): triangle bass, square arpeggio, low-passed saw pads, and a sine kick with noise snare and hats. It's scheduled 120ms ahead on a 25ms tick, so it doesn't drift with frame rate.
- Persistence stays with the shell (`apps/web/src/settings.ts` already stores `muted`/`music`/`sfx`). The manager holds `{muted, music, sfx, volume}` in memory, and the shell pushes changes with `update()`. One source of truth, no second localStorage key.
- No AudioContext exists before the first `pointerdown` or `keydown` (capture phase) or an explicit `unlock()`. That satisfies autoplay rules, and `play()` is a silent no-op until then. `startMusic()` before the unlock is remembered and starts once unlocked.
- Gains: master is `volume`, or 0 when muted; the music bus is 0.55 or 0; the sfx bus is 1 or 0. Changes ramp with `setTargetAtTime`, so toggles never click.
- NeonRoot routes juice `sfx` to the shared manager by default. `useSoundToggle()` gives the Hud's `sound` prop from the same manager.
- Tables own their top bar (the bankroll pill is a juice target: chips fly into it), so the shell doesn't draw a second HUD over a live table. It passes its sound and settings buttons as `TableProps.hudIcons`, which the table renders at the right of its bar, matching the mock's single top row. Blackjack already had the slot. (Web shell, 2026-10-11)
- Over a live table the settings sheet adds History, Lobby, and New game, so the in-game HUD stays as minimal as the mock: no back arrow on the felt. Lobby keeps the session for resume; New game drops it. (Web shell, 2026-10-11)
- Sheets are portaled to `<body>` at z-index 100, so a table's transforms (screen shake) and its fx layers can't trap or cover them. (Web shell, 2026-10-11)
- Blackjack is registered in `apps/web/src/games.ts` from its exports (`rules`, `BlackjackTable`) without touching its package. The registry entry injects an sfx muted by the shell's mute and effects settings until the UI kit's audio manager lands. (Web shell, 2026-10-11)
- `?rig=` and `?seed=` on a game URL flow into `config` (matching the prototype's `?rig=`), so e2e and manual testing rig real server sessions. A rigged URL always starts a fresh session instead of resuming. Production rejects both with 400. (Web shell, 2026-10-11)
- The API client serializes behind the very first request. On a fresh visit the lobby's wallet read and the game's session create raced cookieless, each minted a different anonymous player, and the session then 404'd as "session not found". Waiting for the first response (which sets the cookie) fixes it at the one place every call passes through. (Web shell, 2026-10-11)
- Resuming a stored session that is no longer `active` (closed when a newer chips session started) drops it and deals a new one. (Web shell, 2026-10-11)
