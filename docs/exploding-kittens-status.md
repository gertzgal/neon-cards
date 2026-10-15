# Exploding Kittens status

Spec only. Nothing is playable. `docs/architecture.md` did not change.

The contract is [`docs/exploding-kittens-spec.md`](exploding-kittens-spec.md) (2026-10-15). Later agents implement that file and do not invent rules. The decision log is the 2026-10-15 section of [`docs/decisions.md`](decisions.md).

## State

| Piece | State |
| --- | --- |
| Spec, edge cases E1–E68, CPU policies, Nope window, information boundary, module map | Written, this PR |
| `docs/architecture.md` | Unchanged. Nope is a `pending` cursor. No contract change. |
| Rules package `@neon-cards/game-exploding-kittens/rules` | Not started |
| Easy / Medium / Hard policies and the strength floors | Not started |
| Table, juice, the two registry lines, e2e, verify feature | Not started |

## What's next

1. Rules package and E1–E68. Pure `/rules` entry. No React.
2. Policies, including the 200-seed strength floors (Hard beats Medium beats Easy).
3. Table, registry lines in `apps/worker/src/games.ts` and `apps/web/src/games.ts`, e2e, verify feature file.

## Nope window

One `pending` cursor, the same pause Flip 7 uses for a target. The queue is living seats who hold a Nope, clockwise after the seat who played the current top card, with the human moved to index 0 whenever they hold a Nope and are not that top. The engine CPU loop stops on the human, so a person can Nope a CPU card and can Nope a Nope. Seats without a Nope are skipped. Pass increments the index. A Nope rebuilds the queue. An empty queue resolves inside the same `apply`. Odd `nopes` cancels. Even, including zero, resolves. A draw, a drawn kitten, and a defuse cannot be Noped. Hands stay on the server. The client sees who must answer, the public effect, and the Nope count, not the queue's hands.

## Client / server boundary

The server deals, shuffles, draws, steals, and inserts. The HTTP payload is the human `view` plus public events. Opponent seats are `{ alive, count }` only. `knownTop` and `plantedIndex` exist only for `me`. `Defused` has both faces and no index. `Gave` and `Stole` have no face. A face-down `Drew` may carry an id with `face: null`. Two defuses that differ only in index produce equal events and equal human views. The index stays on the action log so replay rebuilds the draw. No hidden card, insert index, or other player's hand is in a client payload.

## Module map

```
packages/games/exploding-kittens/
  package.json          # exports "." and "./rules"
  tsconfig.json
  src/rules/index.ts    # rules, ekDeck, HUMAN, TITLE_ORDER, RIGS, policies, types
  src/rules/types.ts
  src/rules/deck.ts     # DeckSpec lives here, not in packages/engine
  src/rules/definition.ts
  src/rules/nope.ts     # not exported
  src/rules/policies/{easy,medium,hard,index,count}.ts
  src/rules/rigs.ts
  src/rules/*.test.ts
  src/index.ts          # definePlugin
  src/view/{Table,face,juice,playback}.tsx
```

Registry lines are the table PR. `meta.economy` is `score`. Seats are `{ min: 2, max: 4 }`. One human (`you`) and 1–3 CPUs. `defaultConfig` is `{ opponents: 2, difficulty: 'medium' }`.

## Act On fixes in the spec

1. One ordered own-insert procedure. E25 asserts one view. E67 covers a second insert shifting `planted`.
2. E54 checks structure (no `draw` array, no field named `index`, no other hand) and allows the public `DrewKitten` and `Defused` faces.
3. Strength harness is three seats, a human script, and win-margin floors a faithful run can fail.
4. `legalActions` lists at most one five. `apply` still accepts any legal five. E68.
5. Attack juice is an `Attacked` event. `Cancelled` dims cards already discarded. No opening deal fly-in.
6. `view.owed` is the raw value. The badge is display-only.
7. Easy's turn procedure drops favor, five, and three. Give-rank ties are ordered. Hard returns objects from `legal` only.

## Landing

PR URL and the fast-forward SHA are filled in this file before the merge.
