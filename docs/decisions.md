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

## 6. UI kit (Platform UI agent, 2026-10-11)
- `@neon-cards/ui` owns the browser-side plugin types (`GamePlugin`, `TableProps`, `CardFaceRenderer`, `JuiceMap`, `SettingSpec`), because game packages must import them and `packages/engine` stays React-free. `GamePlugin.rules` is typed structurally (`{definition, policies?}`), so it accepts the engine's `GameRules` without the UI depending on a type the Engine PR has not landed. `definePlugin()` erases generics for the registry array instead of using `any`.
- `TableProps` was not in the contract; added to architecture.md. The Table gets the human's final `view` plus the response's `EventBatch` and plays the batch itself with `usePlayback()`, so the UI animates from events and never diffs state.
- Theme tokens follow the prototype: background `#050409`, table `#0b0b12`, pink `#ff2e88`, cyan `#2ef2ff`, violet `#a64dff`, gold `#ffd23f`, bust `#ff2e5a`. Chips are 5 cyan, 25 pink, 100 violet, 500 gold. The phone composition applies below 700px, as in the prototype.
- The pixel font is Jersey 10, self-hosted through `@fontsource/jersey-10` so the app and e2e screenshots never depend on Google Fonts.
- Juice targets are an element or a `data-testid`, so game juice handlers address the same handles Playwright uses.
