# Flip 7

`/games/flip7` opens the pre-game sheet: opponents (1, 2 or 3 CPUs, default 2) and difficulty (Easy, Medium, Hard). Play deals the first round as animated events: one card each from the dealer's left, then turns. You hit (plus icon, `H`) or stay (palm icon, `S`). A repeated number busts you unless a Second Chance absorbs it. Freeze and Flip Three make you tap a target seat, which pulses gold. Seven unique numbers end the round with FLIP 7! (the biggest juice in the game) and +15. Between rounds a numbers-only tally shows the round score and a play icon starts the next round. The first to 200 at the end of a round wins, and a crown replaces the controls. The server deals and runs every CPU seat. There is no wallet: `economy` is `score` and every round settles 0. The only words on the table are FLIP 7! and BUST. Number cards are a large numeral in that number's color. Action and modifier cards fill the card in their own color. Action names are pixel art, so they add no words. Hover or a tap on a hand card opens its rule and does not hit. The panel sits under the draw pile, or beside it when that gap is taken, and it stays off the pile, the hand, and the buttons. A card that lands under a still cursor stays closed until the pointer moves. A dealt card pops a short line on the juice layer, for you and for each CPU. That line is outside the table.

## Sub-features

- `flip7-table` carries `data-stage` (`ready|playing|roundOver|gameOver`), `data-round`, `data-busy` (true while a batch plays back or a request is in flight), `data-pending` (your decision: `hitOrStay|target|passSecondChance|assign`, or empty), `data-picking`, and `data-tiebreak`.
- You: `seat-you` (`data-status` `active|stayed|busted|frozen`, `data-total`, `data-pick`), `you-hand`, `you-extras` (modifiers, Second Chance, Freeze), `round-value` (your live round score), and `slots` with `slot-0..6` (`data-filled`, `data-gold` once you flip 7).
- CPUs: `seat-cpu-N` (the kit opponent row, plus `data-status`, `data-total`, `data-pick`, `data-tied`). The status line shows `+N` or BUST.
- Middle: `draw-pile` (`data-count`), `flip3-pips` (`data-remaining`), `held` (an action card waiting for a target), `set-aside`, and `tally` (`data-round`).
- Controls: `action-hit`, `action-stay`, `action-next`, and `game-over` (`data-winner`). HUD: `hud-total` (`data-value`, your score out of 200).
- Rigs (`?rig=`, DEV_RIG=1): `flip7`, `bust`, `freeze`, `flip3`, `second`, `mods`, `win`, or a literal like `you=5,5;cpu=12,11,10`. See `packages/games/flip7/src/rules/rigs.ts`.

## How to get to it (user POV)

- Lobby, then the Flip 7 tile, or open `/games/flip7`. Pick opponents and difficulty, then Play.
- Mid-game, reopening `/games/flip7` resumes the open game.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes.

- **Setup.** `scripts/verify.sh drive --path /games/flip7 --click pregame-opponents-3 --click pregame-difficulty-hard --click pregame-play --expect seat-cpu-3 --expect action-hit`.
- **Bust.** `scripts/verify.sh drive --path "/games/flip7?rig=bust" --click pregame-play --click action-hit --expect "tally=BUST"`.
- **Full flows.** Every rig, resume, and the win are in `e2e/flip7.spec.ts`: `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/flip7.spec.ts`.

## Gotchas

- Wait for `flip7-table[data-busy=false]` before asserting: CPU turns and the opening deal play back as animation.
- A `?rig=` URL never resumes. Open `/games/flip7` without it to test resume.
- A rig sets the dealer last, so you're dealt first. CPUs run out of rigged cards after 12, 11, 10 and then draw from the shuffled pile. A Medium CPU stays on that line.
- Seat names are hidden on purpose (numbers only). Identify seats by `data-testid`.
