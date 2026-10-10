# Neon Cards verification map

The maintained source for verifying what a Neon Cards player can see and do. Read this index, then the matching feature file.

| Feature | File | Status |
| --- | --- | --- |
| App shell boots and reads D1 | [app-shell.md](app-shell.md) | live (Foundation) |
| Health API | [health-api.md](health-api.md) | live (Foundation) |
| Home screen and game list | | planned (Shell PR) |
| Blackjack round | | planned (Blackjack project) |
| Game settings sheet (opponents, difficulty) | | planned (Shell PR) |

## Baseline preconditions

- `pnpm i` done; Chromium installed.
- A stack started by `scripts/verify.sh start`, and `scripts/verify.sh doctor` passes.
- Fresh D1 per start. Never drive a stack this run didn't start.

## Driving conventions

- Handles are `data-testid`. Don't select by CSS class, position, or copy that a designer may change.
- Check both viewports, phone 390x844 and desktop 1440x900, unless the feature file says otherwise.

## Proof and skip reporting

- Report the feature, the entry point, and the evidence folder for each proof.
- If a path can't be reached, report the attempted command and the unmet precondition. Don't report it as verified through another path.

## Feature entry contract

Each feature file has an H1, one paragraph on the user-visible behavior, then four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify.sh`, `Gotchas`.
