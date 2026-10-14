# Agents working on Neon Cards

Read `docs/architecture.md` (the contract), `docs/plan.md` (build plan, ownership, Definition of done), and `docs/decisions.md` (the log) before you change anything.

## Autopilot rules

Gal (the owner) approved full autopilot. There is no human in the loop.

- Open small PRs. One logical change per PR.
- Wait for green CI. Never merge red. Main must always be green.
- Self-review your diff against the docs, then squash-merge your own PR.
- Never force-push `main`. Never rewrite its history.
- Don't ask questions. Make the call and keep moving. For product and feel calls, use Balatro as the rule of thumb, inside the approved brief (`docs/look-and-feel-brief.md`) and Gal's mock (`docs/reference/gal-minimal-mock.png`). The prototype (`docs/reference/prototype-reference.html`) is the feel bar: match or beat it.
- Record every decision you make in `docs/decisions.md`, dated, in the same PR.
- Change the contract only through a PR that updates `docs/architecture.md` first and logs why in `docs/decisions.md`.
- Prove a change on the real app before you merge it. Use the `verify-neon-cards` skill (`.cursor/skills/verify-neon-cards/SKILL.md`).

## Merging

Agents can push with git but may not have a GitHub merge API (the `gh` CLI can be read-only). The house merge is a fast-forward of `main` to the PR head that CI tested:

```sh
git fetch origin main
git merge-base --is-ancestor origin/main HEAD || { git rebase origin/main && git push; }  # then wait for green again
gh pr checks <pr>                     # both `checks` and `e2e` must pass on this exact head
git push origin HEAD:main             # fast-forward only; GitHub marks the PR merged
```

If the push is rejected because `main` moved, rebase, push the branch, wait for green, and try again. Never use `--force` on `main`. Keep each PR small and its commits tidy, because they land on `main` as they are. If a GitHub merge tool is available, squash-merge instead.

## Ownership

| Project | Owns |
| --- | --- |
| Neon Cards: Platform | `apps/worker`, the `apps/web` shell, `packages/engine`, `packages/ui`, CI, `docs/`, the verify skill |
| Neon Cards: Blackjack | `packages/games/blackjack` and the blackjack e2e specs (`e2e/blackjack*.spec.ts`) |

Don't edit another project's paths. If you need a change there, make the smallest change that unblocks you and log it in `docs/decisions.md`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm i` | Install the workspace (Node 22, pnpm 10) |
| `pnpm dev` | Build the web app, migrate local D1, run `wrangler dev` (:8787) and Vite (:5173, proxies `/api`) |
| `pnpm start` | Build and serve the production-shaped stack from `wrangler dev` only (:8787, override with `PORT`) |
| `pnpm typecheck` | `tsc` in every workspace package |
| `pnpm lint` | ESLint over the repo |
| `pnpm test` | Vitest: the `worker` project (Workers runtime + migrated local D1) and the `unit` project (`packages/**/src/**/*.test.ts(x)`) |
| `pnpm build` | Vite build of `apps/web` into `apps/web/dist` (the Worker serves it) |
| `pnpm e2e` | Playwright on `phone` (390x844) and `desktop` (1440x900) against one `wrangler dev` and a fresh local D1 per worker |
| `pnpm verify` | The verify skill's script: start, doctor, drive, screenshot, stop |

CI (`.github/workflows/ci.yml`) runs four jobs in parallel on every PR and on `main`: `lint`, `typecheck`, `unit` (Vitest worker + unit projects), and `e2e` (Playwright, several workers, screenshots uploaded as the `playwright` artifact). A job whose inputs the PR did not touch is skipped, and a task whose input hash already passed is not run again. `deploy` runs after those four.

## Conventions

- Workspace packages are TypeScript source. `exports` points at `src/index.ts`; there is no per-package build.
- Package names are `@neon-cards/<name>`. Game packages are `@neon-cards/game-<id>` with a pure `@neon-cards/game-<id>/rules` entrypoint.
- Every workspace package needs a `typecheck` script. Put unit tests next to the code as `*.test.ts`.
- D1 migrations live in `apps/worker/migrations`, numbered `NNNN_name.sql`. Worker tests get them applied automatically.
- UI elements that tests touch get a `data-testid`.
