# Platform status against the Definition of done

Audit of `main` against every Platform item of the Definition of done in `docs/plan.md`, by the Platform agent on 2026-10-11. Every check below ran on `main` (local `pnpm typecheck`, `lint`, `test`, `build`, `e2e`, the verify skill at phone 390x844 and desktop 1440x900) and in CI.

| # | Definition of done item (Platform part) | Status |
| --- | --- | --- |
| 1 | main is green; `pnpm i && pnpm dev` runs Worker + local D1 + web | Met |
| 2 | Blackjack fully playable with design, juice, sound, saved history, Playwright on phone and desktop | Met on the Platform side; moment-by-moment e2e is the Blackjack project's |
| 3 | A new game can be added by following `docs/adding-a-game.md` | Met |
| 4a | Multi-seat turn order (`seatsFor`, `toAct`), proven by the test-only game | Met |
| 4b | CPU seats run server-side via `Policy.choose`, land in the action log, return as normal events, UI plays them paced | Met |
| 4c | packages/ui lays out 1 to 3 opponent rows and dealer vs player, on phone and desktop | Met |
| 4d | Card faces are game-defined, proven by the Flip 7 DeckSpec | Met |
| 4e | Settings flow from the pre-game sheet through `config` to `seatsFor` and `setup` | Met |
| 5 | Deploy if `CLOUDFLARE_API_TOKEN` exists, else a documented one-command step | Met on 2026-10-11 as a documented step. As of 2026-10-14, Workers Builds deploys `main` and Actions does not (see decisions). |

## Evidence

**1. Green main, one-command local stack.** CI runs `lint`, `typecheck`, `unit` (Vitest worker + unit projects), and `e2e` (Playwright on phone and desktop against `wrangler dev`, one fresh local D1 per worker) in parallel on every PR and on `main`. Locally on `main` after this audit's PRs ([#26](https://github.com/gertzgal/neon-cards/pull/26), [#29](https://github.com/gertzgal/neon-cards/pull/29)), 22 Vitest files with 209 tests pass, and the Playwright suite (48 tests over both viewports, including the new multi-seat spec) passes; CI was green on both merged heads. `pnpm i && pnpm dev` built the app, migrated local D1, and served Vite on :5173, which proxies `/api` to the Worker on :8787. `GET /api/health` through the proxy answered `{"ok":true,"db":{"schema":"foundation"}}`, and `POST /api/sessions` for Blackjack answered 201. The README has "Run it" and "Deploy" sections.

**2. Blackjack in the real app.** Using the verify skill (`verify.sh start`, `doctor`, then a Playwright driver against `:8790`), the audit played one unrigged round plus rigged blackjack, split, and double rounds at both viewports, all through the UI. Every round settled (lose, blackjack, split, win). The HUD pill always equalled the wallet minus the bet waiting on the felt, history listed all 4 rounds, and there were no console errors. The live table matches Gal's mock composition at both sizes: bankroll pill top left, sound and settings icons top right, dealer tray with total, pot, the hand with its total badge, and buttons on the pink felt arc inside the edge swirl. `e2e/blackjack.spec.ts` proves every round moment end to end, including wallet, history (from the table's settings sheet), and resume after a reload. Sound comes from the kit's WebAudio manager, with the synthwave loop starting from the shell (PR #23), plus Blackjack's own sfx. Both obey the shell's mute, music, and effects settings (`e2e/audio.spec.ts`, `e2e/shell.spec.ts` mute test). No platform-side breakage was found. Each juice moment (betting, deal, hit, stand, double, split, bust, blackjack, push, dealer blackjack, refill) with screenshots is the Blackjack project's e2e, [PR #21](https://github.com/gertzgal/neon-cards/pull/21).

**3. Adding a game.** `docs/adding-a-game.md` walks package, rules, DeckSpec, seats, CPU policies, settings, plugin, the two registry lines, and e2e. It points at Blackjack (house game) and at High Card, including its dev table and multi-seat e2e (CPU seats, settings). The Flip 7 project is following it now ([PR #28](https://github.com/gertzgal/neon-cards/pull/28), pure rules).

**4a. Turn order.** `packages/engine/src/match.test.ts` covers `startMatch`/`act`/`replay` with High Card: human-first and CPU-first orders, `NotYourTurnError`, refusing to act for CPU seats, three rounds to `over`, and determinism per seed. `apps/worker/test/sessions.test.ts` does the same through the API: seats built from config, leading CPU turns, 409 out of turn.

**4b. Server-side CPU seats with paced playback.** Engine tests prove that policies see only their own view and the `cpuRng(seed, seq)` stream, that CPU randomness stays out of the deck stream, that out-of-menu choices throw, that each CPU action is wrapped as `turn` + events, and that replay never runs a policy. Worker tests prove the CPU actions are persisted in `actions` in seq order, a retried seq replays the stored response, a seq a CPU used is a 409, and a full game replays from seed + log. The UI side is proven by `packages/ui/src/juice/playback.test.ts` (thinking beat, then juice, skip), `e2e/ui-gallery.spec.ts` (reduced motion still reaches the end state), and, on the real path, `e2e/shell-multiseat.spec.ts`. There, the server's CPU turns play in order (cpu-1, cpu-2, cpu-3) with a THINKING beat each, taking over a second in total, before `YOUR TURN`.

**4c. Opponent rows.** `e2e/ui-gallery.spec.ts` lays out the Flip 7 table at 3 CPU seats (stacked on phone, side by side on desktop). `packages/ui/src/primitives/layout.test.ts` covers the compact-card math for shorter rows. In the real app, `e2e/shell-multiseat.spec.ts` renders 3 hard seats and 1 easy seat from server seats: slim stacked rows on phone, side by side on desktop. Each has a difficulty pip, compact hand, score badge, status word, and the shared active glow.

**4d. Game-defined faces.** `packages/engine/src/decks/flip7.test.ts` builds the 94-card Flip 7 deck (numbers 0 to 12, +2 to +10 and x2, Freeze, Flip Three, Second Chance) with literal counts. The gallery draws it through its own `CardFaceRenderer` in the shared card frame, next to the standard 52 (`e2e/ui-gallery.spec.ts`, Flip 7 table and the sheet).

**4e. Settings through config.** `e2e/shell-multiseat.spec.ts` picks 3 opponents, hard, and seat last on the pre-game sheet (rendered from `meta.settings`). It asserts that the `POST /api/sessions` body carries them as `config`, that three hard CPU seats come back from `seatsFor`, and that the CPUs act first. It also checks that the choice is remembered when "New game" reopens the sheet. Worker tests cover `parseConfig` → `seatsFor` and the 400 on invalid config; `apps/web/src/game-settings.test.ts` covers settings resolution.

**5. Deploy.** On 2026-10-11 CI's `deploy` job reported `CLOUDFLARE_API_TOKEN present: false`, so nothing deployed from Actions. As of 2026-10-14, Cloudflare Workers Builds deploys `main` and that Actions job is gone. `pnpm run deploy` (`scripts/deploy.sh`) is the same build, remote migrate, and deploy sequence by hand.

## What's left

- **Blackjack moment e2e** (Blackjack project): [PR #21](https://github.com/gertzgal/neon-cards/pull/21) adds a screenshot for every moment on both viewports. Until it merges, only win and bust rounds are covered by e2e on `main`. The other moments were played by hand in this audit.
- **Deploy**: Cloudflare Workers Builds deploys `main` (see decisions, 2026-10-14). The GitHub Actions deploy job was removed so it does not race that build.
- **Flip 7** (next project): rules are in progress in [PR #28](https://github.com/gertzgal/neon-cards/pull/28). Its table should copy the High Card dev table's pattern (`apps/web/src/dev/high-card.tsx`) and its e2e (`e2e/shell-multiseat.spec.ts`).
