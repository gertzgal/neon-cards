# Exploding Kittens

`/games/exploding-kittens` opens the pre-game sheet. Opponents are 1, 2, or 3 CPUs, default 2. Difficulty is Easy, Medium, or Hard. Play shows your eight cards face up and a count of backs for each CPU. Draw, or play a card. A Nope window stops on you when you hold a Nope and the card is not yours, so you can Nope a CPU card and Nope a Nope. Opponents are a count only. See the Future and a planted kitten index show only for you. You choose where a defuse puts the kitten. A CPU's slot never reaches the client. NOPE and BOOM stay the big juice words. A played card also pops a short line on the juice layer, for you and for a CPU. Each face shows its title, a pixel scene, and that card's color. The rule is in the popup, not on the face. Hover or the first tap on a hand card opens it and does not play. A second tap, or Play in the popup, plays. The panel sits under the draw pile, or beside it when that gap is taken, and it stays off the pile, the hand, and the buttons. A card that lands under a still cursor stays closed until the pointer moves. Last one alive wins. There is no wallet.

## Sub-features

- `ek-table` carries `data-state` (`playing` or `over`), `data-busy` (true while a batch plays or a request is in flight), `data-pending` (`turn`, `nope`, `give`, `defuse`, or empty), `data-nopes`, `data-effect`, and `data-picking`.
- You: `seat-you` (`data-alive`, `data-count`, `data-owed`), `you-hand`, `action-card-<title>` on the next unselected card of that title, and `owed` (the digit `owed === 0 ? 1 : owed` while it is your turn). On a phone that digit sits in the top bar, so the fan stays on the screen. On desktop it stays beside the hand.
- CPUs: `seat-cpu-N` from the kit, plus `data-alive`, `data-count`, `data-owed`, and `data-pick`. A dead seat is an empty row.
- Middle: `draw` (`data-count`), `discard` (`data-count`), `known-top` (`data-count`), `planted` (`data-index`), and `defuse-kitten` while you are burying one.
- Controls: `action-draw`, `action-nope`, `action-pass`, `insert-<index>` (`data-end` `top` or `bottom`), `give-<cardId>`, `ask-<title>` after a three picks a seat, and `game-over` (`data-winner`).
- Keyboard: `D` draws, `N` nopes, `Escape` or `P` passes, digits `1` through `9` pick a defuse index when that index is legal. Digit `k` is index `k - 1`.
- Rigs (`?rig=`, DEV_RIG=1): `kitten`, `explode`, `nope`, `favor`, `five`. See `packages/games/exploding-kittens/src/rules/rigs.ts`.

## How to get to it (user POV)

- Lobby, then the Exploding Kittens tile, or open `/games/exploding-kittens`. Pick opponents and difficulty, then Play.
- Mid-game, reopening `/games/exploding-kittens` resumes the open game. A `?rig=` URL starts fresh.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes.

- **Setup.** `scripts/verify.sh drive --path /games/exploding-kittens --click pregame-opponents-3 --click pregame-difficulty-hard --click pregame-play --expect seat-cpu-3 --expect action-draw --expect ek-table`.
- **Defuse prompt.** `scripts/verify.sh drive --path "/games/exploding-kittens?rig=kitten" --click pregame-play --click action-draw --expect insert-0 --expect defuse-kitten`. Stop there. The next click hands the turn to a CPU.

## Gotchas

- Wait for `ek-table[data-busy=false]` before asserting. CPU beats play back before the server view snaps in.
- A pass-only CPU beat thinks 120 ms. Any other CPU beat thinks 500 ms. A tap skips the rest. Reduced motion skips the waits.
- Opening the table does not call a CPU policy. The human is first. A turn that reaches a CPU does, and Easy, Medium, and Hard answer it.
- `?rig=` needs `DEV_RIG=1`. A Workers preview does not set it, so a rig URL is rejected.
- `action-card-<title>` is one element, the next card of that title that is not selected. A second copy is `card-pick-<cardId>`.
- Seat names are hidden. Identify seats by `data-testid`.
- See the Future cards and `planted` are absent from a CPU's result. Do not look for an insert index on a `Defused` event.
