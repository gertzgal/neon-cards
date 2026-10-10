# Game plugins

Each game is its own workspace package under `packages/games/<id>` and exports a `GamePlugin` (see `docs/architecture.md`). Register it with one line in `apps/web/src/games.ts`.

`packages/games/blackjack` is owned by the Neon Cards: Blackjack project.
