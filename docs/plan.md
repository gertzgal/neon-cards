# Neon Cards: build plan (full autopilot)

Gal approved full autopilot on 2026-10-11. Agents open small PRs, wait for green CI, self-review against docs, and squash-merge their own PRs with no human in the loop. Never merge red. Never force-push main. Every PR also appends any decision it made to docs/decisions.md.

For any on-the-fly product or feel decision, use Balatro as the rule of thumb, inside the approved look-and-feel brief and Gal's mock (docs/reference/gal-minimal-mock.png). The live prototype at docs/reference/prototype-reference.html is the feel reference: match or beat it.

## Project 1: Platform (owns apps/worker, apps/web shell, packages/engine, packages/ui, CI, docs, the verify skill)
1. Foundation PR (must land first, fast): the monorepo, TS, lint, Vitest, Playwright, the GitHub Actions CI, a Worker serving a hello page from apps/web with a working local D1, AGENTS.md with the autopilot rules, docs/ imported from the handoff files, and .cursor/skills/verify-neon-cards (generate it with pstack's /create-verification-skill if available, otherwise write it by hand).
2. Engine: the core types (including `toAct`, `seatsFor`, `parseConfig`, `Difficulty`, `Policies`), seeded RNG, DeckSpec, shoe building, replay helper, a standard-52 deck, AND a Flip 7 DeckSpec with tests (deck only, no Flip 7 rules) to prove the card model is generic. Includes a test-only multi-seat game (1 human + 1 to 3 CPUs) with a trivial policy per difficulty, used by the engine and worker tests.
3. Worker API: sessions, actions, history, wallet, D1 schema and migrations, idempotent seq, dev rigging, the worker game registry, and the server-side CPU loop (turn events, CPU actions in the action log, separate CPU RNG stream). Tests against local D1, including a multi-seat session with CPU turns.
4. UI kit: theme tokens from the brief, the edge swirl + CRT overlay, the table primitives (dealer tray, opponent rows for 1 to 3 CPU seats, felt arc, total badge, pot, chip rack, HUD pill and icons, buttons, active-seat glow), the juice system with a paced event queue for CPU turns, and the audio manager (a lo-fi synthwave loop plus chiptune sfx, with mute and separate music and effects toggles).
5. Shell: the game registry, a home screen listing games, routing, settings, a pre-game settings sheet rendered from `meta.settings` (opponents, difficulty), and a minimal history view, all in the mock's minimalist style.
6. docs/adding-a-game.md: a step-by-step guide an agent can follow to add Flip 7 or poker.

## Project 2: Blackjack (owns packages/games/blackjack, and the blackjack e2e specs)
Until the Foundation PR is on main, only create files inside packages/games/blackjack.
1. Rules as a pure GameDefinition: a 6-deck shoe, dealer stands on all 17s, blackjack pays 3:2, Hit, Stand, Double, and Split (one split, split aces get one card each, 21 after a split pays 1:1, double after split allowed), dealer peeks for blackjack under an ace or ten, no insurance or surrender, reshuffle below 25% of the shoe left. Exhaustive Vitest coverage.
2. Table view built from packages/ui to match the mock and the prototype: betting with chips 5, 25, 100, and 500 (cyan, pink, violet, gold), rebet last bet, clear, deal, the round, and every result moment. Fixes from prototype review: no empty-box dealer tray during betting, the blackjack chip burst must not cover the dealer's cards, the desktop HUD sized up, one chip color per value.
3. Wiring to the server API (server-authoritative), resume after reload, history entries, wallet refill.
4. Polish to Balatro level: timing, easing, sound, mobile performance (60fps on a mid phone, static swirl when reduced motion is on), with Playwright screenshots for each moment.

Blackjack implements the full contract: `parseConfig`, `seatsFor` (one human + the house), `toAct`, and the two entrypoints (`/rules` and the plugin). It has no CPU seats and no settings in v1.

## Next: Flip 7 (a later project, not tonight)
Single player against 1 to 3 CPU opponents with Easy, Medium, and Hard policies; real-time multiplayer later. Tonight the platform must be ready for it (see Definition of done); no Flip 7 rules get built.

## Project 3: Quality (starts once a playable Blackjack is on main)
Plays the real game end to end in a browser on phone and desktop, compares it against the reference mock and prototype, files and fixes bugs and UX rough spots in small PRs, and keeps the e2e suite and the verify skill trustworthy.

## Definition of done (by morning)
Platform status against this list, with evidence: [platform-status.md](platform-status.md).
- main is green, and `pnpm i && pnpm dev` runs the full stack locally (Worker + local D1 + web).
- Blackjack is fully playable with the approved design, every juice moment, sound, and saved history, verified by Playwright on phone and desktop with screenshots.
- A new game can be added by following docs/adding-a-game.md.
- The platform is ready for Flip 7 (single player vs 1 to 3 CPU opponents, Easy/Medium/Hard), proven without Flip 7 rules:
  - engine and worker run multi-seat games with turn order (`seatsFor`, `toAct`), proven by the test-only multi-seat game;
  - CPU seats run server-side through `Policy.choose(view, legal, rng)`, their actions land in the action log and come back as normal events, and the UI plays them with paced timing;
  - packages/ui lays out 1 to 3 opponent rows as well as dealer vs player, on phone and desktop;
  - card faces are fully game-defined, proven by the Flip 7 DeckSpec (number 0 to 12, +2 to +10 and x2 modifiers, Freeze, Flip Three, Second Chance);
  - game settings (opponent count, difficulty) flow from the pre-game sheet through `config` to `seatsFor` and `setup`.
- If a Cloudflare API token is available as the CLOUDFLARE_API_TOKEN secret, deploy to Workers. Otherwise, leave deploy as a documented one-command step.
