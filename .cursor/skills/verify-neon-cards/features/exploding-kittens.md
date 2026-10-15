# Exploding Kittens

`/games/exploding-kittens` opens the pre-game sheet. Opponents are 1, 2, or 3 CPUs, default 2. Difficulty is Easy, Medium, or Hard. Play shows your eight cards face up and a count of backs for each CPU. Draw, or play a card. A Nope window stops on you when you hold a Nope and the card is not yours, so you can Nope a CPU card and Nope a Nope. Opponents are a count only. See the Future and a planted kitten index show only for you. You choose where a defuse puts the kitten. A CPU's slot never reaches the client. NOPE and BOOM stay the big juice words. A played card also pops a short line on the juice layer, for you and for a CPU. Each face shows its title, a pixel scene, and that card's color. The rule stays off the face. A tap raises that card in place and shows its one-sentence rule just above the hand. A second tap lowers it and does not play. Play is a button on the right. It sends the one menu action the raised cards match, and it stays disabled with one line when they do not. A Nope is the same two taps while a Nope window is open. Pass stays a button. The hand is a straight row. On a phone the cards overlap slightly and the row scrolls. When a kitten is drawn, that strip scrolls so the Defuse card is on screen. The row leaves room for Play. Last one alive wins. There is no wallet.

## Sub-features

- `ek-table` carries `data-state` (`playing` or `over`), `data-busy` (true while a batch plays or a request is in flight), `data-pending` (`turn`, `nope`, `give`, `defuse`, or empty), `data-nopes`, `data-effect`, and `data-picking`.
- You: `seat-you` (`data-alive`, `data-count`, `data-owed`), `you-hand` (`data-layout="strip"`), `action-card-<title>` on the next unselected card of that title, `card-rule` while a card is raised, `play-card`, `play-reason` when Play is disabled, and `owed` (the digit `owed === 0 ? 1 : owed` while it is your turn). On a phone that digit sits in the top bar. On desktop it stays beside the hand. `play-dock` keeps a column on the right so the row does not run under Play.
- CPUs: `seat-cpu-N` from the kit, plus `data-alive`, `data-count`, `data-owed`, and `data-pick`. A dead seat is an empty row.
- Middle: `draw` (`data-count`), `discard` (`data-count`), `known-top` (`data-count`), `planted` (`data-index`), and `defuse-kitten` while you are burying one.
- Controls: `action-draw`, `action-pass`, `play-card`, `insert-<index>` (`data-end` `top` or `bottom`), `give-<cardId>`, `ask-<title>` after a three needs a name, and `game-over` (`data-winner`). Nope is `action-card-nope` then `play-card`.
- Keyboard: `D` draws, `N` nopes, `Escape` or `P` passes, digits `1` through `9` pick a defuse index when that index is legal. Digit `k` is index `k - 1`.
- Rigs (`?rig=`, DEV_RIG=1): `kitten`, `explode`, `nope`, `favor`, `five`. See `packages/games/exploding-kittens/src/rules/rigs.ts`.

## How to get to it (user POV)

- Lobby, then the Exploding Kittens tile, or open `/games/exploding-kittens`. Pick opponents and difficulty, then Play.
- Mid-game, reopening `/games/exploding-kittens` resumes the open game. A `?rig=` URL starts fresh.

## Driving it with verify.sh

Preconditions:

- `pnpm verify doctor` passes.

- **Setup.** `pnpm verify drive --path /games/exploding-kittens --click pregame-opponents-3 --click pregame-difficulty-hard --click pregame-play --expect seat-cpu-3 --expect action-draw --expect ek-table`.
- **Defuse prompt.** `pnpm verify drive --path "/games/exploding-kittens?rig=kitten" --click pregame-play --click action-draw --expect insert-0 --expect defuse-kitten`. Stop there. The next click hands the turn to a CPU.

## Gotchas

- Wait for `ek-table[data-busy=false]` before asserting. CPU beats play back before the server view snaps in.
- A pass-only CPU beat thinks 120 ms. Any other CPU beat thinks 500 ms. A tap skips the rest. Reduced motion skips the waits.
- Opening the table does not call a CPU policy. The human is first. A turn that reaches a CPU does, and Easy, Medium, and Hard answer it.
- `?rig=` needs `DEV_RIG=1`. A Workers preview does not set it, so a rig URL is rejected.
- `action-card-<title>` is one element, the next card of that title that is not selected. A second copy is `card-pick-<cardId>`.
- Seat names are hidden. Identify seats by `data-testid`.
- See the Future cards and `planted` are absent from a CPU's result. Do not look for an insert index on a `Defused` event.
