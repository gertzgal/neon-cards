# Neon Cards verification map

The maintained source for verifying what a Neon Cards player can see and do. Read this index, then the matching feature file.

| Feature | File | Status |
| --- | --- | --- |
| App shell: lobby, HUD, settings, history, routing | [app-shell.md](app-shell.md) | live (Shell) |
| Health API | [health-api.md](health-api.md) | live (Foundation) |
| Wallet API and player identity | [wallet-api.md](wallet-api.md) | live (Worker API) |
| UI kit gallery (table primitives, opponent rows) | [ui-gallery.md](ui-gallery.md) | live (UI kit) |
| Sessions, actions, CPU seats, history API | [sessions-api.md](sessions-api.md) | live (Worker API) |
| Blackjack round in the shell | [app-shell.md](app-shell.md) (`shell-play`) | live (Shell); table moments owned by the Blackjack project |
| Multi-seat play: settings sheet, CPU seats, paced turns, opponent rows | [multi-seat.md](multi-seat.md) | live (dev game `/games/high-card`, needs `DEV_RIG=1`) |
| Flip 7: setup, rounds, actions, FLIP 7!, scoring, win | [flip7.md](flip7.md) | live (Flip 7) |
| Exploding Kittens: setup, draw, Nope window, defuse | [exploding-kittens.md](exploding-kittens.md) | live (Exploding Kittens) |

## Baseline preconditions

- `pnpm i` done; Chromium installed.
- A stack started by `pnpm verify start`, and `pnpm verify doctor` passes.
- Fresh D1 per start. Never drive a stack this run didn't start.

## Driving conventions

- Handles are `data-testid`. Don't select by CSS class, position, or copy that a designer may change.
- Check both viewports, phone 390x844 and desktop 1440x900, unless the feature file says otherwise.

## Proof and skip reporting

- Report the feature, the entry point, and the evidence folder for each proof.
- If a path can't be reached, report the attempted command and the unmet precondition. Don't report it as verified through another path.

## Feature entry contract

Each feature file has an H1, one paragraph on the user-visible behavior, then four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify.sh`, `Gotchas`.
