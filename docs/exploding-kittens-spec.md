# Exploding Kittens

The contract for the base game on Neon Cards. No expansions. A later agent implements this file and does not invent rules. If this file and a rulebook disagree, this file wins, and the reason is in `docs/decisions.md` (2026-10-15).

This is not a contract change. `docs/architecture.md` stays as it is. The game is a `GameDefinition` plus policies plus a table, the same shape as Flip 7. The Nope window is a `pending` decision, the same pause Flip 7 uses for a target. `toAct` is the seat who must answer. The engine CPU loop already stops when that seat is the human.

## 1. Package

`@neon-cards/game-exploding-kittens`. Rules id `exploding-kittens`, `version: 1`.

```
packages/games/exploding-kittens/
  package.json          # exports "." and "./rules"
  tsconfig.json         # extends the repo base, DOM libs, jsx react-jsx
  src/rules/index.ts    # the public barrel
  src/rules/types.ts
  src/rules/deck.ts     # DeckSpec, lives here, not in packages/engine
  src/rules/definition.ts
  src/rules/nope.ts     # NOT exported. Imported only by definition.ts
  src/rules/policies/easy.ts
  src/rules/policies/medium.ts
  src/rules/policies/hard.ts
  src/rules/policies/index.ts
  src/rules/policies/count.ts
  src/rules/rigs.ts
  src/rules/*.test.ts
  src/index.ts          # definePlugin
  src/view/Table.tsx
  src/view/face.tsx
  src/view/juice.ts
  src/view/playback.ts
```

`src/rules/index.ts` exports `rules`, `ekDeck`, `HUMAN` (`'you'`), `TITLE_ORDER`, `RIGS`, the policy object, and the types `EkConfig`, `EkState`, `EkAction`, `EkView`, `EkEvent`, `EkFace`, `Title`, `Effect`, `Pending`. It does not export `nope.ts`. Tests drive `apply`. They do not call the stepper.

Register one line in `apps/worker/src/games.ts` (the `/rules` entry) and one in `apps/web/src/games.ts` (the plugin). Add the workspace dependency to both apps. Those lines are the table PR's job. This spec does not add them.

`meta`:

```ts
{
  title: 'Exploding Kittens',
  description: 'Draw cards. Do not explode. Last one alive wins.',
  economy: 'score',
  settings: [opponents 1 | 2 | 3, difficulty easy | medium | hard],
}
```

`defaultConfig` is `{ opponents: 2, difficulty: 'medium' }`. No `minBet`. No `staked`. `parseConfig` is `parseSettings` plus an optional `rig` string. A `rig` that is present and not a known name throws `ConfigError`. The Worker already rejects `rig` unless `DEV_RIG=1`.

`seats` is `{ min: 2, max: 4 }`. `seatsFor` is the human `you` (name `You`) then `cpu-1` .. `cpu-n` at `config.difficulty`. Turn order is that array, clockwise. The human goes first.

`phase` is `'playing'` while `pending !== null`, and `'over'` when `pending === null`. It is never `'betting'` or `'settling'`. The action that leaves one living player moves `playing` to `over`, so the engine calls `settle` once. `settle` returns `{ seat, delta: 0 }` for every seat in `order`. The winner is `state.winner` and `view.winner`. History `net` stays 0.

`setup` deals and emits no events. `startMatch` therefore returns an empty event list and a view whose human hand has 8 cards. The table plays a local intro from that view (section 11). There is no `start` action.

## 2. Deck

`ekDeck` is a `DeckSpec<EkFace>` with id `exploding-kittens`. `EkFace` is `{ title: Title }`. `build()` returns these 56 faces, in `TITLE_ORDER`, each title repeated `count` times:

| Title | Count | Solo play on your turn |
| --- | --- | --- |
| `kitten` | 4 | No. Explodes when drawn. A kitten taken from the discard sits in the hand and does not explode. |
| `defuse` | 6 | No. Only the answer to a drawn kitten, or a combo. |
| `nope` | 5 | No. Only a response inside a Nope window, or a combo. |
| `attack` | 4 | Yes. |
| `skip` | 4 | Yes. |
| `favor` | 4 | Yes, and it names a target. |
| `shuffle` | 4 | Yes. |
| `future` | 5 | Yes. See the Future. |
| `tacocat` | 4 | Combo only. |
| `hairyPotato` | 4 | Combo only. |
| `rainbowRalphing` | 4 | Combo only. |
| `beard` | 4 | Combo only. |
| `cattermelon` | 4 | Combo only. |

`TITLE_ORDER` is the order of that table, top to bottom.

Face labels, for aria and tests: `EXPLODING KITTEN`, `DEFUSE`, `NOPE`, `ATTACK`, `SKIP`, `FAVOR`, `SHUFFLE`, `SEE THE FUTURE`, `TACOCAT`, `HAIRY POTATO CAT`, `RAINBOW-RALPHING CAT`, `BEARD CAT`, `CATTERMELON`.

Card ids come from one `buildShoe(ekDeck, 1, rng)` inside `setup`. Later shuffles permute those same card objects. An id is `exploding-kittens-<shoe index>`. The deck id contains the letters of `kitten`; the index does not name a title.

## 3. Setup

`setup(config, seats, rng)`:

1. Build the shoe. Index 0 is the top. Pull every kitten and every defuse out, preserving the relative order of what remains (the 46).
2. Deal 7 from that pile to each seat in `order`: all 7 to `order[0]`, then all 7 to `order[1]`, and so on. Append in the order dealt.
3. Append one defuse to each hand, defuses in the order they were pulled.
4. Extra defuses still in hand-order of the pulled pile:
   - 2 or 3 seats: put the next **2** onto the pile. The rest go to `removed`.
   - 4 seats: put all remaining defuses onto the pile (there are 2). `removed` gets no defuse.
5. Put `seats.length - 1` kittens onto the pile. The other kittens go to `removed`.
6. Shuffle the pile with `rng` into `draw`. Index 0 is the next draw.
7. `turn` is the human seat. `owed` is `0`. `pending` is `{ kind: 'turn', seat: human }`. `winner` is `null`. `known` is empty for every seat. `discard` is `[]`.

Exactly one human. `setup` throws `Error` otherwise. The seat count is `seats.length`, so a test may pass a seat list whose difficulties differ from `config`. `config.opponents` is what `seatsFor` reads; `setup` does not read it again.

| Seats | Draw pile | Each hand | Removed |
| --- | --- | --- | --- |
| 2 | 35 | 8, exactly one of them a defuse | 3 kittens + 2 defuses |
| 3 | 29 | 8, exactly one defuse | 2 kittens + 1 defuse |
| 4 | 23 | 8, exactly one defuse | 1 kitten |

No hand contains a kitten. Kittens in the draw pile equal `seats.length - 1`.

Conservation, after `setup` and after every `apply`: the cards in hands, `draw`, `discard`, `removed`, and the kitten on a `defuse` pending, are 56 distinct ids. `removed` does not change after `setup`.

### Rigs

A rig runs after step 6 and only swaps existing card objects. It mints nothing. `parseConfig` rejects an unknown name.

| Name | Result |
| --- | --- |
| `kitten` | `draw[0]` is a kitten and `you` holds a defuse. |
| `explode` | `draw[0]` is a kitten and `you` holds no defuse (that defuse is on `cpu-1`). |
| `nope` | `you` holds a nope. `cpu-1` holds an attack and a nope. `draw[0]` is a `tacocat`. |
| `favor` | `you` holds a favor. `cpu-1`'s hand has at least two cards and no defuse moved off `you`. |
| `five` | The discard is empty at setup, so the rig also moves one defuse from `cpu-1`'s hand onto the discard, and `you` holds five cards of five different titles, none of them that defuse. |

Swaps exchange with a card that is not the last defuse in `you`'s hand, except `explode`, which moves `you`'s only defuse to `cpu-1`.

## 4. State

Plain JSON. No `Map`, no `undefined`, no functions. `apply` deep-clones with `JSON.parse(JSON.stringify(state))` before it writes, and throws `IllegalActionError` without the caller observing a change.

```ts
interface SeatState {
  hand: Card<EkFace>[] // append on gain; remove the first matching id on loss
  alive: boolean
}

type Effect =
  | { type: 'attack' | 'skip' | 'shuffle' | 'future' }
  | { type: 'favor'; target: SeatId }
  | { type: 'pair'; target: SeatId; title: Title }
  | { type: 'three'; target: SeatId; title: Title; name: Title }
  | { type: 'five'; titles: Title[]; takeId: string }

type Pending =
  | { kind: 'turn'; seat: SeatId }
  | {
      kind: 'nope'
      queue: SeatId[]
      index: number // queue[index] is the seat who must answer
      actor: SeatId
      effect: Effect
      nopes: number
      top: SeatId // who played the card currently being answered
    }
  | { kind: 'give'; seat: SeatId; to: SeatId }
  | { kind: 'defuse'; seat: SeatId; kitten: Card<EkFace> }

interface EkState {
  order: SeatId[]
  human: SeatId
  seats: Record<SeatId, SeatState>
  draw: Card<EkFace>[] // SECRET. [0] is the top.
  discard: Card<EkFace>[] // public. The last element is the top.
  removed: Card<EkFace>[]
  turn: SeatId | null
  owed: number // 0 means one ordinary turn. See section 5.
  pending: Pending | null // null only when the game is over
  known: Record<SeatId, { top: string[]; planted: number | null }>
  winner: SeatId | null
}
```

`turn` is whose turn is open. `pending` is who must decide. They match on `turn` and `defuse`. They differ on `nope` (a responder) and `give` (the victim; `to` is the player who played the favor).

`known[seat].top` is a prefix of `draw` ids that seat knows, from the top. `planted` is an index that seat knows a kitten occupies, or `null`. Both are server state. Section 9 says what a view is allowed to copy.

## 5. Turns and Attack

`owed` is the attack stack. A fresh turn stores `0`, and that `0` means one ordinary turn still to play. It is not "zero turns."

A turn is any number of plays (including zero), then a draw. Skip and Attack end a turn without drawing. See the Future, Shuffle, Favor, and every combo return to the same turn.

```ts
function finishTurn(owed: number): { advance: boolean; owed: number } {
  const left = owed === 0 ? 1 : owed
  const remaining = left - 1
  if (remaining === 0) return { advance: true, owed: 0 }
  return { advance: false, owed: remaining }
}
```

`advance` moves `turn` to the next living seat and sets `owed` to `0`. Otherwise the same player continues with the new `owed`, and `pending` becomes `{ kind: 'turn', seat }` again.

Attack, when it resolves:

```ts
const nextOwed = owed === 0 ? 2 : owed + 2
```

The next living seat becomes `turn`, receives `nextOwed`, and `pending` becomes their turn. The attacker does not draw.

| `owed` before the effect | What resolves | After |
| --- | --- | --- |
| 0 | Attack | next living seat at **2** |
| 4 | Attack, before any of those turns complete | next living seat at **6** |
| 2, then one completed turn | now **1**, same player | a following Attack sets the next seat to **3** |
| 0 | Skip, safe draw, or a finished defuse | next living seat at **0** |
| 2 | Skip, safe draw, or a finished defuse | same player at **1** |
| 1 | Skip, safe draw, or a finished defuse | next living seat at **0** |
| any | Explosion, or the draw of a kitten with no defuse | next living seat at **0** |

A cancelled Attack or Skip changes nothing about `turn` or `owed`.

The printed Defuse line "your turn is over" means you do not play more cards in the turn you just spent by drawing. It does not cancel turns you still owe. A defuse consumes one turn through `finishTurn`.

The badge shows `owed === 0 ? 1 : owed` for `state.turn`. Policies read the raw `owed`.

`nextLiving(from)` walks `order` after `from`, wrapping, and skips seats with `alive: false`.

## 6. Actions

`toAct` is `null` when `pending` is `null`. On a nope pending it is `queue[index]`. Otherwise it is `pending.seat`.

`legalActions(state, seat)` is `[]` when `seat` is not `toAct`. When it is, the menu is non-empty:

| Pending | Menu, in this order |
| --- | --- |
| `turn` | `{ type: 'draw' }`, then the plays below |
| `nope` | `{ type: 'pass' }`, then `{ type: 'nope' }` |
| `give` | `{ type: 'give', cardId }` for each card in that hand, hand order |
| `defuse` | `{ type: 'defuse', index }` for every integer from 0 through `draw.length` inclusive |

Turn plays, after `draw`:

1. `{ type: 'play', title }` for `attack`, then `skip`, then `shuffle`, then `future`, when the hand holds that title. One action per title. `apply` removes the first matching card in hand order.
2. `{ type: 'favor', target }` for each other living seat, in `order`, when the hand holds a favor.
3. `{ type: 'pair', title, target }` for each title with count at least 2, titles in `TITLE_ORDER`, and for each of those each other living seat in `order`.
4. `{ type: 'three', title, target, name }` for each title with count at least 3 (`TITLE_ORDER`), each other living seat, each `name` in `TITLE_ORDER` (all 13, including `defuse` and `kitten`).
5. At most one `{ type: 'five', titles, takeId }`. Include it only when the hand holds no defuse and the discard already holds a defuse. `titles` is the lexicographically first five-title combination (by `TITLE_ORDER`) that does not itself contain `defuse`. `takeId` is the defuse nearest the top of the discard. If no such combination exists, the menu has no five.

`apply` still accepts every structurally legal five, including ones that are not in the menu, the same way Blackjack's `apply` accepts a bet that is not the one suggested amount in `legalActions`. A CPU policy can only return the listed five, because the engine deep-equals the choice against the menu. The table sends a human five from the card selection, not from that single menu entry. `apply` accepts `titles` in any order and stores the effect with `titles` sorted in `TITLE_ORDER`. The action log keeps the object the caller sent.

There is no `{ type: 'die' }`. A seat who holds a defuse and draws a kitten must defuse. A seat who holds none dies. A lone nope, a lone defuse, and a lone kitten are not turn plays. Those titles are legal inside a pair, a three, or a five.

`view.actions` is `legalActions(state, me)`. Policies return an element of the `legal` argument they were given, the same object, so the engine's deep-equal check holds. They ignore `view.actions`.

`apply` throws `IllegalActionError` when `seat` is not `toAct`, the pending kind does not match the action, or:

- `play` of a title outside `attack | skip | shuffle | future`, or the hand has none.
- `favor` with no favor in hand, or a target who is not another living seat.
- `pair` with fewer than two of `title`, or a bad target.
- `three` with fewer than three of `title`, a bad target, or a `name` outside `TITLE_ORDER`.
- `five` whose `titles` are not five distinct titles the hand holds, or whose `takeId` is not legal.
- `nope` when the hand has no nope.
- `give` of a `cardId` that is not in the giver's hand.
- `defuse` when that pending is absent, the hand has no defuse, or `index` is not an integer from 0 through `draw.length`.

The engine does not check a human action against `legalActions`. `apply` is the check.

## 7. Nope window

A Nope stops any play or combo. It does not stop a draw, a drawn kitten, or a defuse. A Nope on a Nope is a Nope. `nopes` is the count of Nope cards on this effect. Odd cancels. Even resolves. Zero is even.

The cards of a cancelled play stay in the discard. "The card never happened" means the effect does not run. It does not return the cards to the hand.

`nope.ts` owns the queue. `definition.ts` is the only caller.

A queue is a snapshot. A pass only increments `index`. A Nope builds a new queue and replaces the old one. Hands do not change on a pass, so the snapshot cannot go stale.

```ts
function nopeQueue(s: EkState, top: SeatId): SeatId[] {
  const eligible = clockwiseFrom(nextSeat(s, top)).filter(
    (id) => id !== top && s.seats[id].alive && holdsNope(s, id),
  )
  const human = eligible.filter((id) => id === s.human)
  const rest = eligible.filter((id) => id !== s.human)
  return [...human, ...rest]
}
```

`clockwiseFrom` is seat order starting at that seat and wrapping. The human, if eligible, is moved to index 0. Everyone else keeps clockwise order. The seat who played the current top card is absent, so they cannot Nope their own card. After someone else Nopes, `top` is the noper, and the original actor is eligible again if they still hold a Nope.

`openNope(actor, effect)` builds that queue with `top = actor`. An empty queue resolves the effect inside the same `apply`. Otherwise `pending` becomes the nope object with `index: 0` and `nopes: 0`.

`pass` emits `{ type: 'Passed', seat }`, increments `index`, and closes the window when `index === queue.length`.

`nope` moves the first nope in that seat's hand onto the discard, increments `nopes`, sets `top` to that seat, emits `{ type: 'Noped', seat, card, nopes }`, and rebuilds the queue. An empty rebuild closes the window. Otherwise `index` returns to 0.

`closeNope`: odd emits `{ type: 'Cancelled', seat: actor, nopes }` and sets `pending` back to `{ kind: 'turn', seat: actor }` with `turn` and `owed` unchanged. Even calls `resolve` (section 8).

Seats with no Nope are not in the queue. They get no action and no `turn` event.

### Why the human can answer

The engine runs CPU turns until `toAct` is the human or `null`. Putting the human at index 0, whenever they hold a Nope and are not `top`, makes the loop stop before the effect resolves and before any CPU answers that same top card.

Worked trace, heads-up. `you` holds a nope. `cpu-1` plays Attack inside the CPU loop. `openNope` with `top = cpu-1` builds `['you']`. The loop stops. The response contains the Attack's `Played` and a view whose nope seat is `you`. The Attack has not resolved.

- Human passes. `nopes` is 0. Attack resolves. `you` is now `turn` at `owed` 2.
- Human nopes. `nopes` is 1, `top` is `you`. The rebuild is `['cpu-1']` if `cpu-1` still holds a nope. The loop runs `cpu-1`. If they nope, `nopes` is 2 and the Attack resolves (even) unless `you` still holds another nope, in which case the rebuild puts `you` first again and the loop stops.

Worked trace, the human plays Attack and holds no nope. `cpu-1` and `cpu-2` each hold a nope. The queue is `['cpu-1', 'cpu-2']`. Both answer inside this response. If both pass, the Attack resolves before the response returns. If `cpu-1` nopes and `cpu-2` passes, `nopes` is 1, the Attack is cancelled, and `pending` is the human's turn again.

Worked trace, the human plays Attack and also holds a nope. They are `top`, so the first queue excludes them. A CPU nope rebuilds with `you` at index 0. The loop stops on that rebuild. The human may Nope the Nope. They are not asked to confirm their own Attack when nobody Nopes it.

A pass is a logged action. Replay applies the log and does not run a policy. The window survives a request because `pending` is on the stored state.

## 8. Resolving a play

Every turn play moves its cards from the hand onto the discard first (append, so the last card is the top), emits `Played`, then `openNope`. The effect runs only when the window closes even, or when the queue was empty.

| Effect | On resolve |
| --- | --- |
| `skip` | `finishTurn` on the actor. |
| `attack` | Next living seat gets `owed === 0 ? 2 : owed + 2`, via a new turn. Emit `{ type: 'Attacked', from, to, owed }` with that new raw value. |
| `shuffle` | `draw = shuffle(draw, rng)` with the apply rng. Same ids. Clear every seat's `known`. Emit `{ type: 'Shuffled', count: draw.length }`. Back to the actor's turn. |
| `future` | Let `n = min(3, draw.length)`. Set that seat's `known.top` to those ids and `known.planted` to `null`. Emit `{ type: 'Peeked', seat, count: n }`. No faces. A later peek replaces `known.top`. Back to the actor's turn. |
| `favor` | Target alive and hand empty: emit `{ type: 'Whiff', seat: actor }` and return to the actor's turn. Hand length 1: move that card (no decision, no extra action) and emit `{ type: 'Gave', from, to }` with no card face, then return to the actor's turn. Hand length 2 or more: `pending = { kind: 'give', seat: target, to: actor }`. |
| `pair` | Empty hand: `Whiff`, back to the actor. Otherwise `rng.int(hand.length)` on the apply rng picks the card, it moves to the actor's hand, emit `{ type: 'Stole', from, to }` with no face. Back to the actor's turn. |
| `three` | If the target has no card of `name`, emit `{ type: 'Asked', from, to, title: name, hit: false }`. If they have one or more, move the first in hand order and emit `{ type: 'Asked', from, to, title: name, hit: true, card }` with the face. The name was spoken, so the face is public. No give prompt. Back to the actor's turn. |
| `five` | Remove `takeId` from the discard (it is there; section 6 put the five on the discard before the window, and `takeId` was legal). Put that card in the actor's hand. Emit `{ type: 'Took', seat, card }` with the face. A kitten taken this way enters the hand and does not explode. Back to the actor's turn. |

`{ type: 'give', cardId }` moves that card, emits `Gave` with no face, and returns to `{ kind: 'turn', seat: to }`.

A combo ignores the instructions on the cards. Two Skips are a steal, not two turns ended. Three Nopes are a named demand, not a Nope chain. A defuse spent in a combo is discarded and does not defuse anything.

Legal `takeId` for a five: any card id that is in the discard now, plus the id of each of the five cards the combination will play (the first card of that title in hand order). The player may take a card that was already discarded, or one of the five they are about to play. An empty discard still allows a five, and every legal `takeId` is one of those five.

### Draw

`{ type: 'draw' }` is legal on a turn even when both piles are empty.

1. If `draw` is empty and `discard` is not, move the discard into the draw, shuffle it with the apply rng, set `discard` to `[]`, clear every `known`, and emit `{ type: 'Reshuffled', count }`.
2. If both are empty, emit `{ type: 'Drew', seat, card: null }` and `finishTurn`. Nobody dies. No card is created.
3. Take `draw[0]`. Update `known` for the draw (section 9).
4. If it is not a kitten: append it to the actor's hand, emit `{ type: 'Drew', seat, card: faceDown(card) }`, then `finishTurn`.
5. If it is a kitten: emit `{ type: 'DrewKitten', seat, card }` with the face. This cannot be Noped. If the hand holds a defuse, set `pending` to `{ kind: 'defuse', seat, kitten }` and return. The kitten object lives only on that pending. `owed` is not consumed yet. If the hand holds no defuse, the seat explodes.

### Defuse

`{ type: 'defuse', index }` discards the first defuse in the hand, `splice`s the pending kitten into `draw` at `index`, updates `known` (section 9), emits `{ type: 'Defused', seat, defuse, kitten }` with both faces and **no index**, clears the pending, then `finishTurn`.

Index 0 is the new top. Index `draw.length` (the length before the splice) is the new bottom. An empty draw lists only index 0.

### Explosion

Discard the whole hand face up, then the kitten, and set that seat `alive: false`. Emit `{ type: 'Exploded', seat, kitten, hand }` with faces. Those cards are the public discard now. If one living seat remains, set `winner`, `pending` to `null`, `turn` to `null`, and emit `{ type: 'Won', seat }`. Otherwise start the next living seat at `owed` 0. A dead seat's leftover `owed` does not transfer. Clearing `known[seat]` for the dead seat is enough; other seats keep theirs.

A kitten already in the hand (taken from the discard) is part of the discarded hand. The drawn kitten is the one that killed them. Drawing a kitten while holding one explodes the drawn kitten only. The held one stays unless they die.

## 9. Information boundary

The HTTP payload is the human's `view` plus the public events of that step. A CPU policy receives `view(state, cpu)`, `legalActions`, and `cpuRng`. It never receives `EkState`. The apply rng is the only rng that deals, shuffles, draws, and steals. `cpuRng` never moves the deck.

### View

```ts
interface EkView {
  me: SeatId
  order: SeatId[]
  seats: Record<SeatId, { alive: boolean; count: number }>
  hand: Card<EkFace>[] // full faces. This seat only.
  drawCount: number
  discard: Card<EkFace>[] // full faces, last is top
  turn: SeatId | null
  owed: number // raw, same as state.owed. 0 is one ordinary turn. Policies compare this. The table badge is `owed === 0 ? 1 : owed`.
  pending: PendingView | null
  knownTop: Card<EkFace>[] // this seat's prefix, faces. Empty for everyone else.
  plantedIndex: number | null // this seat only. Always null in every other view.
  winner: SeatId | null
  actions: EkAction[]
}
```

`PendingView` is `Pending` with the nope variant replaced by `{ kind: 'nope', seat, actor, effect, nopes, top }`. `seat` is `queue[index]`. The queue, the index, `state.draw`, `state.removed`, and `state.known` are not on the view.

`seats[id]` is a count. It is never a list of card ids or faces. A resumed `GET` cannot rebuild an opponent's hand.

`knownTop` and `plantedIndex` are copies of `known[me]` only. Every other view gets `knownTop: []` and `plantedIndex: null`.

### Events

The game does not emit `{ type: 'turn' }`. The engine does, before each CPU action.

| Event | Faces |
| --- | --- |
| `Played` `{ seat, cards, effect }` | Faces up. The cards are on the discard. |
| `Attacked` `{ from, to, owed }` | No cards. `owed` is the raw value just given to `to`. Only when the Attack resolves. |
| `Passed` `{ seat }` | None. |
| `Noped` `{ seat, card, nopes }` | The Nope, face up. |
| `Cancelled` `{ seat, nopes }` | None. `seat` is the actor of the effect. |
| `Drew` `{ seat, card }` | `face: null`, or `card: null` when both piles were empty. |
| `DrewKitten` `{ seat, card }` | Face up. |
| `Peeked` `{ seat, count }` | No faces. `count` is 0..3. |
| `Shuffled` `{ count }` | No order. |
| `Reshuffled` `{ count }` | No order. |
| `Whiff` `{ seat }` | None. Empty favor or empty pair. |
| `Gave` `{ from, to }` | No card. |
| `Stole` `{ from, to }` | No card. |
| `Asked` `{ from, to, title, hit, card? }` | The card's face only when `hit` is true. |
| `Took` `{ seat, card }` | Face up. It was in the discard. |
| `Defused` `{ seat, defuse, kitten }` | Both faces. No index. |
| `Exploded` `{ seat, kitten, hand }` | Faces up. |
| `Won` `{ seat }` | None. |

Never in an event, and never in a view for a seat who does not own it: the `draw` array, a defuse `index` field, `plantedIndex`, another seat's `knownTop`, an unrevealed hand (ids or faces), and the title of a card moved by `Gave` or `Stole`.

Faces the event table already lists are public and are not a leak: `DrewKitten`, `Defused` (the defuse and the kitten), `Exploded` (the dead hand), `Asked` when `hit` is true, `Played`, `Noped`, `Took`. A face-down `Drew` carries the card id and `face: null`. That id is not a face. After a card has been public, a later face-down `Drew` of the same id does not repeat the face.

Two CPU defuses that differ only in `index` produce equal events and equal `view(state, human)`, and unequal `draw` arrays. The index survives on the action record, so `replay` rebuilds the same `draw`.

### Knowledge

Index 0 is the top. Rebuild rules, applied inside `apply`:

- **Peek.** That seat's `top` becomes the peeked ids. `planted` becomes `null`. Other seats are unchanged.
- **Draw.** Every seat drops a leading id that equals the drawn card, and decrements `planted` when it is not `null`. A `planted` of 0 is cleared (that card was drawn). If `planted` would become negative, clear it.
- **Own insert at `index`.** One procedure. Let `before` be the draw length before the splice.
  1. If `planted` is not null and `planted >= index`, add 1 to `planted` (the previously buried kitten moved down).
  2. If `index <= top.length`, insert the kitten id into `top` at `index`. A prefix that already reached the old cards still reaches them, with the kitten in between.
  3. Otherwise set `planted` to `index`. This replaces an older buried index. Only the latest buried kitten is tracked. The older one joins the unseen pool.
  4. If `planted` is not null and `planted < top.length`, set `planted` to null. The prefix already contains that position.
  Index 0 into an empty prefix yields `top = [kitten]` and `planted = null`. A later insert at 0 while `planted` is 5 yields `top = [kitten, …previous prefix]` and `planted` 6.
- **Anyone else's insert.** That seat's `top` becomes `[]` and `planted` becomes `null`. They do not learn the index.
- **Shuffle, reshuffle, or death of that seat.** `top` is `[]` and `planted` is `null`. A shuffle of a pile of length 0 or 1 still clears `known`. The single card is no longer claimed as peeked knowledge; the seat may learn it again only by peeking.

Playing, stealing, giving, and taking from the discard do not clear `known`.

## 10. CPU policies

`choose(view, legal, rng)` returns a member of `legal`. Easy is the only policy that reads `rng`. Medium and Hard are pure functions of `view` and `legal`. `cpuRng` is that `rng`. None of them read the deck.

Shared words:

- `onto(view)` is the next living seat after `view.turn`, computed from `view.order` and `view.seats[].alive`.
- A top kitten means `view.plantedIndex === 0` or `view.knownTop[0]?.face.title === 'kitten'`.
- Largest other hand: among living seats other than `me`, the greatest `count`. Ties walk `order` from the seat after `me` and take the first.
- Give rank, lowest given first: the five cats in `TITLE_ORDER`, then `kitten`, `future`, `shuffle`, `favor`, `skip`, `attack`, `nope`, `defuse`. Same title: earlier in `view.hand`.

All three, on `give`: the card with the lowest give rank.

All three, on `defuse`:

- Easy: `legal[rng.int(legal.length)]`.
- Medium: `{ type: 'defuse', index: view.drawCount }` (the bottom).
- Hard: index `0` when `view.owed <= 1` (this defuse ends the turn, so the next player draws the kitten). Index `view.drawCount` when `view.owed >= 2` (you still have a turn and must not draw it yourself).

### Easy

On a nope window: if `rng.int(4) === 0` and `nope` is in `legal`, return `nope`. Otherwise `pass`. Easy does not look at the effect.

On a turn: with probability 1/2 (`rng.int(2) === 0`) return the `draw` element of `legal`. Otherwise take the distinct action `type` values in menu order, drop `favor`, `five`, and `three`, and drop `play` of `attack` when `view.owed !== 0`. Pick a remaining type with `rng.int`, then pick uniformly among actions of that type. `draw` stays in that pool. Easy ignores `knownTop` and will draw a known kitten.

The half-weight on `draw`, and the ban on Attack while `owed !== 0`, are what keep two Easy CPUs from stacking Attacks or skipping until the engine's 1,000-action cap.

### Medium

Nope window. Let the effect be **bad** when it is `favor`, `pair`, or `three` targeted at `me`, or `attack` or `skip` whose actor's next living seat is `me`. Let it be **good** when `actor === me` and it is not bad. `nopes` even and bad, or `nopes` odd and good: return `nope`. Otherwise `pass`. Medium does not nope a five, a shuffle, or a peek.

Turn, first match:

1. Top kitten, `owed === 0`, attack is legal: that attack.
2. Top kitten, shuffle is legal: that shuffle.
3. Top kitten, skip is legal: that skip.
4. Top kitten: `draw`.
5. `knownTop` is empty, `drawCount >= 1`, future is legal: that future.
6. A pair whose `title` is not `defuse` and not `kitten`, at the largest other hand: the first such pair in the menu.
7. `draw`.

Medium does not play a favor, a three, or a five. Medium does not play Attack unless `owed === 0` and the top card is a known kitten.

### Hard

`pTop` is the chance the next draw is a kitten. `HARD_P` is `0.15`. `players` is `view.order.length`.

```ts
function pTop(view: EkView): number {
  if (view.plantedIndex === 0) return 1
  const top = view.knownTop[0]
  if (top) return top.face.title === 'kitten' ? 1 : 0
  if (view.drawCount === 0) return 0
  const pool = unseen(view)
  // A kitten this seat planted below the top is in the deck, not on top, and not in `pool`.
  return pool.kitten / sum(pool)
}

function unseen(view: EkView): Record<Title, number> {
  // Start from ekDeck's counts.
  // Drop setup removals: kittens removed = 4 - (players - 1);
  //   defuses removed = 2, 1, or 0 for 2, 3, or 4 players. Nothing else is removed.
  // Drop view.hand and view.discard.
  // Drop view.knownTop (those cards are not candidates for an unknown top).
  // If plantedIndex > 0, drop one kitten (it is buried; it is not the top).
  // What remains is opponent hands plus the unknown part of the deck.
  // Any of it can be the top card. Do not try to split hands from the deck.
}
```

Nope window, same even/odd rule as Medium, with two extra **bad** cases: a `five` whose `takeId` is a defuse or a nope and whose actor is not `me`, and a `shuffle` when `knownTop[0]` exists and is not a kitten (they are about to erase a safe top). A `future` is never bad and never good.

Turn, first match. Every return is an element of `legal`, not a freshly built object.

1. The listed five, when `legal` contains a `five`. That entry exists only when the hand has no defuse and it takes a defuse already in the discard (section 6).
2. Top kitten and `owed === 0`: the `play` of `attack` in `legal`, if present.
3. Top kitten: the `play` of `shuffle` in `legal`, if present.
4. Top kitten: the `play` of `skip` in `legal`, if present.
5. Top kitten: `draw`.
6. `pTop >= 0.15`, the hand has no defuse, and `knownTop` is empty: the first of these that appears in `legal` — `play` of `shuffle`, `play` of `future`, a `three` whose `name` is `defuse` and whose `title` is not `defuse` or `kitten` aimed at the largest other hand, a `pair` whose `title` is not `defuse` or `kitten` at that hand, `play` of `skip`, `play` of `attack` when `owed === 0` — otherwise `draw`.
7. `draw`.

Attack is never chosen when `owed !== 0`. That is the anti-stall: a victim does not pass a growing stack back and forth. `view.owed` is the raw value from section 5, so `owed === 0` is a fresh turn. The table paints `view.owed === 0 ? 1 : view.owed` and does not write that display number back onto the view.

### Strength

The harness is three seats from `setup`: `you`, `cpu-1`, `cpu-2`. It is not a two-CPU game. `setup` requires the human, and `turn` starts on the human. Alternate which difficulty sits in `cpu-1` across the 200 seeds `ek-strength-0` .. `ek-strength-199` (even seeds: the stronger policy is `cpu-1`).

The human's script, which is not a policy on `rules.policies`: on a nope window, `pass`; on a turn, `draw`; on a defuse, index `drawCount`; on a give, the first card. They will draw Nopes and they still pass.

A win is `state.winner`. Over those 200 games:

| Matchup | Floor |
| --- | --- |
| Hard vs Medium | Hard's wins exceed Medium's by at least 15, and Hard has at least 70 |
| Medium vs Easy | Medium's wins exceed Easy's by at least 15, and Medium has at least 70 |
| Hard vs Easy | Hard's wins exceed Easy's by at least 25, and Hard has at least 80 |

Human wins count in the 200 and count for neither CPU. If a faithful run misses a floor, change the named constants (`HARD_P`, the Easy draw weight) and log it. Do not rewrite the harness so the human cannot win, and do not lower a margin below 15.

Also assert literal choices on fixed views: Easy draws a known top kitten when `rng` says draw; Medium shuffles that view when it has a shuffle and `owed` is 2; Hard's `pTop` equals a hand-counted unseen multiset; Hard nopes an Attack aimed at them when `nopes` is 0 and passes when `nopes` is 1.

## 11. Table and juice

The table is `TableLayout`, `OpponentRows`, `Hand`, `PlayingCard`, `ActionBar`, `NeonButton`. No dealer tray, no chips, no wallet. `hudIcons` sits on the right of the top bar. `OpponentRows` gets counts of face-down backs, a turn glow, and the owed badge as a digit. Dead seats show an empty row.

Middle: the draw pile (`draw`, `data-count`) and the discard (top face). Bottom: the human hand. Buttons are icons with aria-labels. `NOPE` and `BOOM` stay the big juice words. A played card also pops a short line on the juice layer, for you and for a CPU.

| Control | test id | Sends |
| --- | --- | --- |
| Draw | `action-draw` | `{ type: 'draw' }` |
| Pass | `action-pass` | `{ type: 'pass' }` |
| A card | `action-card-<title>` | raises or lowers that card. It does not send. |
| Play | `play-card` | the one menu action the raised cards match. Disabled, with `play-reason`, when they match none. |
| Defuse slot | `insert-<index>` | `{ type: 'defuse', index }` |
| A gift | `give-<cardId>` | raises that card. `play-card` sends `{ type: 'give', cardId }`. |

A combo is the raised cards filtered against `view.actions`. A seat tap or a discard tap only fills in the target, the name, or the take. `play-card` sends the matching action. The table does not decide the rules. A Nope window uses the same raise-then-Play flow on the Nope card.

Root `ek-table` with `data-state` `playing` | `over` and `data-busy`. Opponent seats keep `seat-<id>`.

Playback does not use `usePlayback`. That hook waits `durations.thinkingBeat` (500) on every CPU `turn`. This table calls the exported `runPlayback` once per beat:

- Events before the first `turn` are the human's beat, thinking 0.
- Each later beat starts at a `turn`.
- Thinking is **120** when the beat contains `Passed` and does not contain `Noped` or `Played`.
- Every other CPU beat thinks **500**.

Tap skips the rest. Reduced motion skips waits. When the batch finishes, the display becomes the server view. The table does not diff views to invent a card.

Opening hand: `setup` emits nothing (`E66`). The first paint is the view. Your eight faces are up. Each opponent row is a count of backs. There is no deal animation, because there is no event to play. Later draws animate from `Drew`.

Juice, kit primitives only:

| Moment | What plays |
| --- | --- |
| `Exploded` | `sfx('bust')`, `shake('big')`, `flash('bust')`, the kitten flips onto the discard, one `BOOM`. This is the blackjack-sized moment. |
| `Defused` | `sfx('win')`, `flash('cyan')`, the defuse deals to the discard, the kitten slides onto the draw pile as a back. No digit for the index. |
| `Noped` | `sfx('push')`, `flash('pink')`, the card slams, one `NOPE`. |
| `Cancelled` | The cards are already on the discard from `Played`. Dim them. Do not deal them a second time. |
| `Attacked` `{ from, to, owed }` | `flash('violet')` on `to`, `numberPop` of that `owed` (2, 3, 4, 6, …), `badgePulse`. |
| `Won` | `sfx('blackjack')`, `flash('gold')`, `shake('big')`, a crown on the winner. Gold if the winner is `you`. |
| `Drew` | `deal` from the pile. The human's own face appears when the view snaps, because the event is face-down. |
| `Played` | The cards deal from the seat. A short callout names the play (Skip, Attack, Shuffle, Peek, Favor, Pair, Ask, Take) on that seat, including a CPU. |
| `Shuffled` / `Reshuffled` | `shake('small')` on the pile. |

`recap`: `{ outcome: 'WIN', tone: 'gold' }` when `view.winner === human`, otherwise `{ outcome: 'LOSE', tone: 'bust' }`.

Keyboard: `D` draws, `N` nopes, `Escape` or `P` passes, digits `1`–`9` pick a defuse index when that pending is open (digit `k` is index `k - 1`; no digit sends an index the menu does not list).

## 12. Edge cases

Each one is a unit test with a literal expected state or event. `apply` does not mutate its input on any of them.

### Nope

- **E1.** One Nope. `nopes` is 1. `Cancelled`. The play's cards are in the discard. `turn` and `owed` are unchanged.
- **E2.** Nope on a Nope. `nopes` is 2. The effect resolves.
- **E3.** Three Nopes. `nopes` is 3. `Cancelled`.
- **E4.** Nobody else holds a Nope. The effect resolves inside the play's `apply`. No `Passed`, no `Noped`.
- **E5.** A living seat with no Nope is not in the queue and produces no action.
- **E6.** The actor is not in the queue for their own play. After another seat Nopes, the actor is in the new queue if they hold a Nope.
- **E7.** A CPU plays Attack and the human holds a Nope. `toAct` is `you` before any CPU is offered that Attack, and the Attack is still the unresolved effect.
- **E8.** A drawn kitten does not open a window. A defuse does not open a window. `legalActions` on those states has no `nope`.
- **E9.** `{ type: 'play', title: 'nope' }` on a turn throws.
- **E10.** A Nope on a pair, a three, or a five cancels the steal, the demand, or the take. The combo cards stay in the discard. A cancelled five does not move `takeId`.

### Attack and Skip

- **E11.** Fresh Attack (`owed` 0) sets the next living seat to `owed` 2.
- **E12.** A seat at `owed` 4 who Attacks before completing one sets the next living seat to `owed` 6.
- **E13.** A seat at `owed` 2 who completes one turn (`owed` is now 1) and then Attacks sets the next living seat to `owed` 3.
- **E14.** Skip at `owed` 0 advances. The next seat is at `owed` 0.
- **E15.** Skip at `owed` 2 leaves the same seat at `owed` 1.
- **E16.** Skip at `owed` 1 advances.
- **E17.** Two Skips end both turns of an `owed` of 2.
- **E18.** A Noped Attack leaves `owed` and `turn` unchanged.
- **E19.** A Noped Skip does not consume a turn.
- **E20.** With `owed` 2, Skip then Skip ends the obligation. Attack instead of the first Skip hands the next seat `owed` 4.

### Defuse and explosion

- **E21.** Index 0 is the top. Index `draw.length` is the bottom. The next draw after index 0 is that kitten.
- **E22.** A kitten drawn as the last card. `draw.length` is 0. The only index is 0.
- **E23.** An index below 0 or above `draw.length` throws. State is unchanged.
- **E24.** Defuse at `owed` 2 leaves that seat at `owed` 1. Defuse at `owed` 0 advances to the next seat at `owed` 0.
- **E25.** `Defused` has no `index` field. Other seats' views have `knownTop: []` and `plantedIndex: null`. Insert at 0 with an empty prefix: the actor's `knownTop` is `[kitten]` and `plantedIndex` is null. Insert at 5 with an empty prefix: `knownTop` is `[]` and `plantedIndex` is 5. Replay rebuilds the same `draw`.
- **E26.** A kitten with no defuse discards the hand and the kitten, sets the seat dead, and starts the next living seat at `owed` 0.
- **E27.** A kitten with a defuse does not kill. The seat stays alive.
- **E28.** The second-to-last explosion sets `winner`, `pending` null, `phase` `over`, `toAct` null, and `settle` all zeros. Kittens may remain in `draw`.
- **E29.** A dead seat is skipped by `nextLiving`. Their leftover `owed` is not copied onto the next seat.
- **E30.** Four seats, three kittens in the opening deck. Two explosions leave two players. The third explosion ends the game. The test does not require the third kitten to be drawn if a defused kitten is the one that kills.

### Favor, peek, shuffle, combos

- **E31.** Favor against an empty hand emits `Whiff`. No `give` pending.
- **E32.** Favor against a one-card hand moves that card inside the resolving `apply`. No `give` action is logged. `Gave` has no face.
- **E33.** Favor against two or more cards sets `give` on the target. The giver does not choose the card.
- **E34.** Favor targeting yourself, a dead seat, or an unknown id throws.
- **E35.** See the Future with 0, 1, and 2 cards sets `knownTop` to that many and emits `count` 0, 1, or 2. The event JSON has no card face.
- **E36.** A second peek replaces `knownTop`.
- **E37.** After a peek, a draw of `knownTop[0]` shifts the prefix.
- **E38.** Shuffle of 0 cards and of 1 card is legal, emits `Shuffled`, and clears `known` for every seat.
- **E39.** Shuffle does not put the draw order on the event or the view. `drawCount` is unchanged.
- **E40.** A pair against an empty hand emits `Whiff`.
- **E41.** A pair's stolen card is chosen by the apply rng. The event has no face. The thief's view contains the card. Replay of the same log steals the same id.
- **E42.** Three naming `defuse`, target holds one: that defuse moves, `hit` is true, the event card's title is `defuse`.
- **E43.** Three naming `defuse`, target holds none: `hit` is false, no card moves.
- **E44.** Three naming `tacocat`, target holds one: that card moves.
- **E45.** Two Skip cards as a pair steal. They do not skip. `owed` is unchanged.
- **E46.** Five titles, `takeId` a discarded defuse: the defuse enters the hand.
- **E47.** Five titles, `takeId` a discarded kitten: the kitten enters the hand, the seat stays alive, and `{ type: 'play', title: 'kitten' }` is not legal.
- **E48.** Five with a repeated title throws.
- **E49.** Five whose `takeId` is not in the discard and not one of the five cards throws.
- **E50.** A Noped five leaves `takeId` in the discard.
- **E51.** Two `tacocat` as a pair is a steal.
- **E52.** Drawing a kitten while the hand already holds a kitten from E47 explodes the drawn one. With a defuse, the held kitten stays in the hand and the drawn one is reinserted.

### Conservation, privacy, illegal plays

- **E53.** After setup and after every action in a scripted full game at 2, 3, and 4 seats, the 56 ids are partitioned across hands, draw, discard, removed, and a defuse-pending kitten. `removed` is constant.
- **E54.** A CPU defuse's human payload has `DrewKitten` and `Defused` with those faces, and the human view has `plantedIndex: null` and `knownTop: []`. The payload has no `draw` array and no event or view field named `index`. It does not include the CPU's remaining hand. `Gave` and `Stole` in other tests still have no card face.
- **E55.** A CPU See the Future leaves the human's `knownTop` empty and the `Peeked` event faceless.
- **E56.** `{ type: 'draw' }` during a nope, give, or defuse pending throws.
- **E57.** `{ type: 'nope' }` with no nope in hand throws.
- **E58.** A play of a title the hand does not hold throws.
- **E59.** An action from a seat who is not `toAct` throws, and the state object is deep-equal to the input.
- **E60.** Both piles empty: `Drew` has `card: null`, the seat does not die, `finishTurn` runs.
- **E61.** Draw pile empty, discard not: the discard is shuffled into the draw, `known` clears, then the draw proceeds.
- **E62.** An empty hand may still draw. No penalty event.
- **E63.** The last living seat's `Won` fires on the killing `apply`. A following action throws.
- **E64.** `replay` of a log that includes a CPU pass, a CPU nope, a steal, and a defuse index matches `draw`, hands, and events. No policy runs.
- **E65.** Setup at 2, 3, and 4 seats matches the draw size, hand size, defuse-in-hand, and removed counts in section 3.
- **E66.** The human is `toAct` after `setup`. `startMatch` events are empty.
- **E67.** `planted` is 5 and `knownTop` is empty. A later own insert at 0 yields `knownTop` starting with the new kitten and `plantedIndex` 6. The older kitten is at index 6. `pTop` is 1 because `knownTop[0]` is a kitten, not because `plantedIndex` is 0.
- **E68.** `legalActions` on a turn lists at most one `five`, and only when the hand has no defuse and the discard already has one. `apply` still accepts a different legal five (a kitten `takeId`) and rejects a repeated title. The CPU policy returns the listed object.

## 13. What a later PR must not invent

- Expansions: Imploding, Streaking, Barking, Alter the Future, targeted attacks, and the cat-only pair rule from older printings. Pairs and threes are any same title, from the 2022 sheet.
- A second human, or a difficulty per seat, on the pre-game sheet. Mixed difficulties exist only inside the strength test's own seat list.
- A contract change for Nope. If `toAct` cannot express a window, the implementation is wrong, not the engine.
- Opponent hand ids "so the animation can track them." Counts, plus the public `Played` card, are the animation.
- A 500ms beat on every CPU pass. Section 11 is the beat.
- `Math.random`. The apply rng and `cpuRng` are the only streams.

## 14. Build order

Not this PR.

1. Rules package and E1–E68.
2. Policies, including the strength floors.
3. Table, registry lines, e2e, verify feature file.
