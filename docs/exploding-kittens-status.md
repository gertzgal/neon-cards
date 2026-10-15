# Exploding Kittens status

Rules package only. Nothing is registered, so nothing is playable. `docs/architecture.md` did not change.

The contract is [`docs/exploding-kittens-spec.md`](exploding-kittens-spec.md) (2026-10-15). The decision log for this package is the 2026-10-15 rules section of [`docs/decisions.md`](decisions.md).

## State

| Piece | State |
| --- | --- |
| Spec, edge cases E1–E68, Nope window, information boundary | Written. One sentence on shoe ids was clarified in the rules PR. |
| `docs/architecture.md` | Unchanged. Nope is a `pending` cursor. No contract change. |
| Rules package `@neon-cards/game-exploding-kittens` | This PR. `src/index.ts` re-exports `rules`. No `src/view`. |
| Easy / Medium / Hard policies and the strength floors | Done. `src/rules/policies/`. Floors passed at `HARD_P` 0.15 and Easy draw weight 2. Record is in the CPU section below. |
| Table, juice, the two registry lines, e2e, verify feature | Not started. `apps/worker` and `apps/web` do not import this package. |

## What's next

1. Policies, including the 200-seed strength floors. Done in the CPU section below.
2. Table, registry lines in `apps/worker/src/games.ts` and `apps/web/src/games.ts`, e2e, verify feature file. `src/index.ts` becomes `definePlugin`. The tsconfig already has DOM and `jsx: react-jsx`.

## Rules package

`src/rules/` is types, deck, definition, nope (not exported), and rigs. Tests sit next to the source. Full games in tests use rigs and a seeded legal actor. That actor is not a policy.

`EkPolicy` is the engine `Policy` over `EkView` and `EkAction`, so the policies PR can add the five policy files without rewriting the rules. `definition.ts` does not import policies. The three placeholders exist because the engine refuses a CPU seat with no policy, and setup starts on the human, so `choose` is not called. Each `choose` throws `Exploding Kittens ${difficulty} policy is not in the rules package`.

## Nope window

One `pending` cursor, the same pause Flip 7 uses for a target. The queue is living seats who hold a Nope, clockwise after the seat who played the current top card, with the human moved to index 0 whenever they hold a Nope and are not that top. The engine CPU loop stops on the human. Seats without a Nope are skipped. Pass increments the index. A Nope rebuilds the queue. An empty queue resolves inside the same `apply`. Odd `nopes` cancels. Even, including zero, resolves. A draw, a drawn kitten, and a defuse cannot be Noped.

## Client / server boundary

The server deals, shuffles, draws, steals, and inserts. A view's opponent seats are `{ alive, count }` only. `knownTop` and `plantedIndex` exist only for `me`. `Defused` has both faces and no index. `Gave` and `Stole` have no face. A face-down `Drew` may carry an id with `face: null`. Two defuses that differ only in index produce equal events and equal human views. The index stays on the action log so replay rebuilds the draw.

## Tests

82 unit tests. One test for each of E1–E68. Twelve fuzzed games, seeds `ek-fuzz-0` through `ek-fuzz-11`, at 2, 3, and 4 players, including the nope, kitten, explode, favor, and five rigs. The same seed replays the same public event log. E41 scans `e41-0` through `e41-399`. E64 scans `e64-0` through `e64-2499`.

TDD on this package: `pnpm exec vitest run packages/games/exploding-kittens --project unit` failed first with `Error: not implemented` (79 failed, 3 passed), then passed (82 passed) after the engine.

## Module map

```
packages/games/exploding-kittens/
  package.json          # exports "." and "./rules"
  tsconfig.json         # DOM libs, jsx react-jsx, for the table PR
  src/rules/index.ts    # rules, ekDeck, HUMAN, TITLE_ORDER, RIGS, throwing policies, types
  src/rules/types.ts    # EkPolicy lives here
  src/rules/deck.ts
  src/rules/definition.ts
  src/rules/nope.ts     # not exported
  src/rules/rigs.ts
  src/rules/*.test.ts
  src/index.ts          # re-exports rules. definePlugin is the table PR
```

Not in this PR: `src/rules/policies/`, `src/view/`. Registry lines stay the table PR. `meta.economy` is `score`. Seats are `{ min: 2, max: 4 }`. One human (`you`) and 1–3 CPUs. `defaultConfig` is `{ opponents: 2, difficulty: 'medium' }`.

## Landing

- PR: https://github.com/gertzgal/neon-cards/pull/57
- Branch: `cursor/exploding-kittens-rules-402a`
- Rules commit: `619f942427c81d37ea4a7fa9633920848da026a4`
- `docs/architecture.md`: unchanged
- Merge: fast-forward `main` to the PR head that CI tested. That head is the commit that adds this landing note. The main SHA is that head after the push.

## CPU policies

Easy, Medium, and Hard are `rules.policies`. `src/rules/index.ts` re-exports that object. `definition.ts` does not import it. `src/index.ts` still re-exports `rules`. No `src/view`, no registry line, no change to `docs/architecture.md`.

`src/rules/policies/{easy,medium,hard,index,count}.ts`. Tests are `policies.test.ts` and `strength.test.ts` next to that code. The rules-package test that asserted the placeholder throw now asserts the three `choose` functions exist.

Policies return a member of the legal menu. Easy is the only one that reads `cpuRng`. Medium and Hard do not. None of them read the deck. `HARD_P` is 0.15. `EASY_DRAW_WEIGHT` is 2. The floors passed at those constants, so neither constant moved.

Strength harness: 200 seeds `ek-strength-0` through `ek-strength-199`, three seats from `setup`, even seeds put the stronger policy on `cpu-1`. The human passes a Nope window, draws on a turn, defuses to `drawCount`, and gives the first card.

| Matchup | Wins | Human | Margin | Floors |
| --- | --- | --- | --- | --- |
| Hard vs Medium | Hard 127, Medium 57 | 16 | 70 | Hard at least 70, margin at least 15 |
| Medium vs Easy | Medium 124, Easy 44 | 32 | 80 | Medium at least 70, margin at least 15 |
| Hard vs Easy | Hard 163, Easy 24 | 13 | 139 | Hard at least 80, margin at least 25 |

TDD: the new choice and strength tests failed first on `Exploding Kittens ${difficulty} policy is not in the rules package`, and the `pTop` test failed because `count.ts` was missing. They passed after the policies.

## CPU landing

- PR: https://github.com/gertzgal/neon-cards/pull/58
- Branch: `cursor/exploding-kittens-cpu-34f9`
- `docs/architecture.md`: unchanged
- Merge: fast-forward `main` to the PR head that CI tested. That head is the commit that adds this landing note.

## Table (Exploding Kittens agent, 2026-10-15)

`src/view` is the table, the face renderer, juice, and playback. `src/index.ts` exports `plugin` and still exports `rules`. Worker and web each register one line, the same way Flip 7 does. The verify map has `features/exploding-kittens.md`. There is no `e2e/exploding-kittens*.spec.ts` in this PR.

Easy, Medium, and Hard are the policies from the CPU section above. The opening deal does not call them, because the human is first. A later turn does.
