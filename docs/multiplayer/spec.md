# Multiplayer architecture

This document is a proposal. It does not change the contract in `docs/architecture.md`. No game, engine, worker, or web behavior changes in this pull request. The types in `docs/multiplayer/platform.ts` are signatures only. Later pull requests implement them one slice at a time.

The platform owns rooms, invite links, seat lists, presence, timers, CPU takeover, reconnect, spectators, and per-seat view delivery. A game keeps `GameDefinition` in `packages/engine/src/types.ts`. Adding multiplayer is a roster the game already accepts in `setup`, plus a few fields named below. Flip 7 is the worked example. Its files are not modified here.

## Goals

Friends play a score game from an invite link or a 4-character code. One Durable Object per room runs the existing engine and sends each seat only its redacted view. Solo play uses the same seat list and the same `setup` path, over today's HTTP session, with no Durable Object rows and no turn timer.

The public surface a game author touches stays the definition they already have. Codes, sockets, alarms, the host, takeover, and spectators stay in a room module a game cannot import.

## Non-goals

Public matchmaking, a lobby browser, accounts, chat, pass-and-play, kicking, host migration, and chips in multiplayer v1 are out. Blackjack stays a solo chips game. Exploding Kittens is not in the first room registry. Per-seat event redaction stays deferred, as the 2026-10-11 decision already says. A 30 minute idle expiry is not a product decision and is not part of this spec.

## How generic the platform is

`packages/room` (new, later) is the only module that knows what a room is. Games do not import it. The web shell does not import `./authority`. The worker does not call `startMatch` itself. `packages/room/src/begin.ts` is the only production caller of `startMatch`.

The module map for the implementation pull requests is this.

```
packages/room/src/authority.ts   beginMatch, command, alarm, frameFor, foldRows
packages/room/src/begin.ts       the only production caller of startMatch
packages/room/src/roster.ts      the only Seat[] builder
packages/room/src/machine.ts     empty, lobby, live, closed
packages/room/src/clock.ts       turn, quick window, host grace
packages/room/src/wire.ts        parse and encode, not exported
apps/worker/src/room-object.ts   hibernation, alarm, sqlite, D1 copy after ack
apps/worker/src/record.ts        the only writer of D1 session history
apps/web/src/room-client.ts      socket, frames, Deal, eye counter
```

Exports are `.` for the shell and `./authority` for the worker. A later lint rule forbids `@neon-cards/room` inside `packages/games/**`, forbids `@neon-cards/room/authority` inside `apps/web/**`, and forbids importing `startMatch` from `@neon-cards/engine` under `apps/worker/**`. `startMatch` stays exported. This pull request does not add that lint.

What a game still implements is `setup`, `toAct`, `legalActions`, `apply`, `view`, `phase`, and `settle` on `GameDefinition`. What it stops implementing is `seatsFor`. The roster builds `Seat[]`. `setup` already takes that list. Policies stay in the game package because they are rules, and the room calls them through the engine.

What the game never sees is the code, the host, sockets, alarms, misses, holds, spectators, D1, and sqlite. The shell sees `ClientCommand` and `Frame`. The worker sees `beginMatch`, `command`, `alarm`, `frameFor`, and `foldRows`.

## Flip 7 per-game cost

Today `packages/games/flip7/src/rules/definition.ts` builds one human in `seatsFor` (`HUMAN` is `you`, then `cpu-1` onward). `Flip7State.human` is that human. `toAct` returns `state.human` on `ready` and `roundOver`, and `pending.seat` while `stage` is `playing`. `legalActions` returns `[{ type: 'nextRound' }]` when `pending` is null. `version` is 1. `house` does not exist yet. `seats` is `{ min: 2, max: 4 }`. `view` hides `Flip7State.draw` (the field is marked order-is-secret) and differs between seats only by `me`. Lines are public. There is no hidden hand.

The implementation that registers Flip 7 for rooms changes only these spots. No file under `packages/games/flip7` imports the room.

- Delete `seatsFor` and `Flip7State.human`. Bump `version` to 2 so old JSON is rejected.
- `toAct` returns null unless `stage` is `playing`, then `pending.seat`. It does not return `order[0]` between rounds. If it did, a CPU at that index would deal inside `runCpuTurns`, because the policies in `packages/games/flip7/src/rules/policies/counting.ts` return `legal[0]`, and `legal[0]` is `nextRound` when both hit and stay are not the menu.
- Add `opening(state)`. It returns `{ type: 'nextRound' }` when `stage` is `ready` or `roundOver`, and null otherwise. In-round `apply` stays as it is.
- `setup` sets the opening dealer to the last seat for every game, not only rigs, in the same change that stops storing `human`. The first card still goes to `order[0]`. Later rounds still rotate the dealer inside `apply`.
- `house` is `[]`.
- `packages/games/flip7/src/rules/rigs.ts` expands the literal `you` onto the human seat's id, and `cpu` onto every `kind: 'cpu'` seat. It does not expand `you` onto `s0`.
- `packages/games/flip7/src/view/Table.tsx` gates the ready effect (it calls `act({ type: 'nextRound' })`), the spacebar path on `roundOver`, and the Next button (`action-next`) on a shell prop `canOpen`. The default is true, so solo is unchanged. A room passes false. The host's Deal button lives in the shell and sends `{ type: 'deal' }`. The server plays `opening()`. It does not trust action bytes from that button.
- `packages/games/flip7/src/rules/index.ts` exports no adapter.

Watcher frames for Flip 7 use `view(state, order[0])`. The shell forces the table busy and passes `canOpen` false. That is safe for Flip 7 only, because no seat has hidden cards. The registration rule for any later game is that a watcher view must not include any seat's hidden cards.

Exploding Kittens is not this cheap. `packages/games/exploding-kittens/src/rules/definition.ts` `setup` throws `setup needs exactly one human` when the human count is not 1, and `view` shows that seat's hand. It stays unregistered until `setup` accepts N humans and a watcher view hides every hand. A Nope window later sets `GameMeta.quick` to `{ types: ['pass', 'nope'], decline: 'pass' }`. Flip 7 sets nothing.

Blackjack stays solo. `packages/games/blackjack/src/rules/definition.ts` uses human id `player` and house id `dealer`. `beginMatch` rejects `economy: 'chips'` when `kind` is `room`. The blackjack table hardcodes `player`. The seat-list pull request points that table at the human seat or keeps the id `player`. It does not put blackjack in a room.

## Product decisions

Gal confirmed these. This spec does not reopen them.

- Game order does not matter. Flip 7 is first, then Exploding Kittens, then Blackjack.
- Friends join only by invite link or 4-character code. There is no public matchmaking and no lobby browser.
- The room creator is the host and presses Deal whenever they like. CPUs fill empty seats.
- The host can deal, change settings, and rematch. There is no kick. There is one host. If the host leaves, the room shuts down. There is no host migration in v1.
- The turn timer is 30 seconds, then an auto-move. A Nope window is about 5 seconds. Both are configurable.
- After 2 missed turns a CPU plays that seat until the player taps I am back.
- Someone joining mid-game can watch, or take a CPU seat at the next round.
- A nickname is picked once, with a random default. There are no accounts and no auth.
- Every seat has a name caption. Humans show their nickname. CPUs get a random name plus an 8-bit pixel bot icon.
- No chips in multiplayer v1. Score games only. Chips later.
- Max players is each game's own max. Flip 7's max is 4.
- No chat and no pass-and-play. Spectators show as a small eye counter.
- Rematch rotates who goes first.

## Technical decisions

These are confirmed, or they are calls this spec makes on top of the confirmed list. Confirmed items are marked. The rest are this spec's calls and are not a second product pass.

- Confirmed. One Cloudflare Durable Object per room, SQLite-backed, on the free tier. It is authoritative, runs the existing engine, uses WebSocket Hibernation, and sends each seat only its redacted view.
- Confirmed. Turn timers run on the server through Durable Object alarms.
- Confirmed. The platform hands each game the seat list (who sits where, human or CPU). Games do not assume one You plus N CPUs.
- Confirmed. D1 stays the system of record for players and history.
- Confirmed. Polling and peer-to-peer are rejected. See the section below.
- Confirmed. The planning wall is 100,000 Durable Object rows written per day, about 330 four-player games a day at 2 rows per action. Mitigation is one log row per action and a snapshot per round. The open CPU risk is specified under free-tier cost.
- This spec. Host grace is 15 seconds, stored as `dueAt`. A dropped host socket waits. An explicit host leave closes immediately. A refresh is not a leave. There is still no host migration.
- This spec. `GameDefinition.opening` is the only way a round starts. `toAct` is null between rounds.
- This spec. `seatsFor` is deleted. One roster builder serves solo and rooms.
- This spec. The code alphabet is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The worker returns 429 after 10 failed joins in a minute for that player.
- This spec. A room has no solo variant. Solo stays on HTTP.
- This spec. Timeout difficulty is the room's filler difficulty, not Easy.
- This spec. Retry rows store redacted frames. Seeds are server-generated. `config.rig` is stripped unless `DEV_RIG` is `1`.

### Why polling and peer-to-peer are rejected

A poll cannot fire a 5 second window unless some client is asking at that moment. The exploration notes put a 10 minute game near 2,400 worker requests if clients poll often enough to feel live. That budget is shared with solo play under the free request cap. A peer that holds the match can read `Flip7State.draw`, which `view` exists to hide. The object holds the match. Clients receive frames.

## Conflicts with the exploration notes and the contract

Where `internal/multiplayer-design.md` disagrees with the code on `origin/main`, the code is what exists today. Where it disagrees with the decisions above, the decisions win.

- The exploration notes recommend host migration to the longest-seated human. Gal said the room shuts down. This spec does not migrate the host.
- The notes use the Easy policy on timeout. This spec uses the room's filler difficulty for the first miss, then a kind flip on the second.
- The notes keep `seatsFor(config, roster)`. This spec deletes `seatsFor`.
- The notes add `spectatorView`. This spec does not, for Flip 7. Watchers use `view(state, order[0])` under the registration rule above.
- The notes quote a 20 to 1 WebSocket ratio as the free 100,000 request cap. The pricing page describes that ratio as compute-request billing only. See open questions.
- The notes treat per-object storage as 1 GB on the free plan. The limits page also says 10 GB, and the pricing page says 5 GB total. See open questions.
- The notes suggest a 30 minute idle expiry. That is not a confirmed decision. This spec does not add it.
- The notes say the blackjack human id is `you`. `PLAYER` in `packages/games/blackjack/src/rules/definition.ts` is `player`.
- The notes point the deploy-disconnect sentence at a best-practices page. The sentence is on the websockets API page cited below.

`docs/architecture.md` still says only Blackjack ships and Flip 7 is next. The repo has Flip 7 and Exploding Kittens. The contract says nothing may assume exactly one human and one house. `GameDefinition` obeys that. `humanSeat` in `apps/worker/src/sessions.ts`, `humanSeatOf` in `apps/web/src/session.ts`, and every `seatsFor` do not. The contract says the first view is the opening deal. Flip 7's first view is an empty `ready` state, and the deal is the client's `nextRound`. The contract reserves Durable Objects for later and does not use them in v1. This pull request leaves `docs/architecture.md` unchanged. A later pull request updates the contract when the code lands.

The 2026-10-11 decision defers per-seat event redaction. Events stay public. A face that must stay hidden is not placed on an event. The first multiplayer game pull request adds a test that a seeded Flip 7 run's events contain no draw order and no face a seat's view hides.

`docs/adding-a-game.md` still says one human and one registry line. A later pull request updates that guide. This one does not.

## UX flows

Create. The player already has an `nc_player` cookie. `POST /api/rooms` with a `gameId` ensures the player, assigns a nickname if `players.nickname` is empty, mints a code, and creates the object with `idFromName(code)`. The creator is the host. The response is the code and the lobby frame.

Share. The invite link is `/r/:code`. The 4-character code is the same string. The directory row makes a closed code visible without scanning objects.

Join. The WebSocket upgrade carries the cookie. Join is not a command. An unknown code or a closed room rejects. A full human roster rejects. The new player gets an open chair, or becomes a watcher if they ask to watch. Failed guesses count toward the 10-per-minute limit.

Lobby. Seats show nicknames. Open seats are empty. The eye counter is `watching.length`. Only the host sees Deal and settings. Settings call `parseConfig` after unknown keys are rejected and after `rig` is stripped. CPUs are not seated until Deal.

Deal. One host press. If the room is in the lobby, the object builds the seat list, calls `beginMatch`, and if `opening()` is non-null applies it in the same transaction. Empty chairs become CPUs with random names. House seats append. The first frame for each human is that seat's view. Watchers get the public view, `you: null`, `canAct` false, and `canOpen` false.

Play. A human whose chair is `toAct` sends `act` with `seq` and `commandId`. The object checks the chair, runs `act` from `packages/engine/src/match.ts`, plays CPUs, writes one step, and fans out redacted frames. The table plays one `EventBatch`, as it does today.

Disconnect. A socket close decrements that player's count. The match and the turn clock stay. A non-host at zero sockets is a drop. The host at zero arms the 15 second grace.

Reconnect. A new socket for the same `PlayerId` increments the count and clears host grace if this is the host. The object sends one frame with `snap: true` and no event backlog, matching today's `GET /api/sessions/:id`.

Takeover. The first missed turn plays `autoAct` at the room difficulty while the chair is still human, then stores misses as 1. The second missed turn flips the chair to `cpu` with `away` set, then `continueMatch`. The name caption stays the nickname. The bot mark appears. `difficulty` is omitted on the display seat.

I am back. `back` is legal only for the player in `chair.away`, including mid-hand. The chair becomes human, misses return to 0, and if they are `toAct` the next deadline is a human turn.

Host leaves. An explicit `leave` from the host closes the room now. Grace firing closes it the same way. Everyone receives a closed frame. Object storage is deleted after the history copy is acknowledged.

Rematch. Only the host, and only when `phase` is `over`. New `historyId`, new server seed, same code, same host. Playing seats rotate left by one. House stays at the end. Holds take their reserved CPU seats. The new match does not apply `opening` until the host deals again.

Spectate. Watchers are the eye counter (`data-testid` `spectator-count` on the shell, not inside the table). They cannot act or deal. `sit` names a `seatId`. The seat must be a CPU with `away` null, and the player must not already hold a seat. The hold applies at the next round boundary (`phase` `between` or `over`). One hold per seat.

## Room state machine

`Room` in `docs/multiplayer/platform.ts` is `empty`, `lobby`, `live`, or `closed`. There is no solo variant.

`empty` is the object before the first join. `lobby` holds `LobbyChair` values, which are humans or open seats, plus watchers and presence. `live` holds `LiveChair` values (human with misses `0 | 1`, CPU with `away`, or house), the `StoredMatch`, deadlines, holds, and remembered frames. `phase` is `playing`, `between`, or `over`. `closed` accepts nothing.

Legal pairs, enforced by `command`.

- Lobby accepts `deal` and `settings` from the host, `sit` onto an open chair, `leave`, and `watch`.
- Live `playing` accepts `act` only from the human chair who is `toAct`, `back` only from the away player, `leave`, and `watch`. `deal` is rejected while `opening()` is null.
- Live `between` accepts host `deal` when `opening()` is non-null, `sit` as a hold on a free CPU seat, `back`, `leave`, and `watch`. `settings` is rejected.
- Live `over` accepts host `rematch`, `leave`, and `watch`. `deal` is rejected. Rematch mints a new match. It does not call `beginMatch` on the old one.
- `closed` rejects every command.
- A guest cannot close the room with `back`.

`deal` never calls `beginMatch` on a live room. A second deal mid-hand is `illegal`.

## Wire protocol

The upgrade is the join. After that the client sends `ClientCommand` and the object sends `Frame`. Both are parsed in `wire.ts`. A bad parse rejects and writes nothing.

Commands are `act`, `deal`, `settings`, `rematch`, `back`, `sit`, `leave`, and `watch`. Each carries `commandId`. `act` also carries `seq` and `action`. `sit` carries `seatId`. `settings` carries `config`. There is no kick, chat, or chip command.

Frames are `lobby`, `live`, `closed`, and `rejected`. A live frame carries `you` (`SeatId` or null), `canAct`, `canOpen`, display seats, `eyes`, `seq`, `view`, `events`, `snap`, `host`, and `deadline` as epoch milliseconds or null. `view` stays `unknown` until the shell parses it as that game's view. `canOpen` is true only for the host when a deal is legal. The table prop of the same name is a different switch. Rooms pass false into `Table.tsx` so the ready effect stays quiet. The shell button is what sends `deal`.

Socket attachment is `{ playerId, connId }`, stored with `serializeAttachment`, so a hibernation wake can still address sockets.

## Generic platform interface

The sketch is `docs/multiplayer/platform.ts`. Brands are `PlayerId`, `SeatId`, `RoomCode`, `CommandId`, and `RoomGeneration`, checked once at the cookie and at the code parser.

`seatList` is the only `EngineSeat[]` builder. `beginMatch` starts a match from that list. For `kind: 'room'` and `economy: 'chips'` it returns `chips-room` and does not start. `command` and `alarm` take the generation they read. A stale generation does not commit. `frameFor` is the only function that turns `StoredMatch.private` into a `view`. `foldRows` rebuilds a `Room` from step and snapshot rows whose payloads are frames, so a wake does not need the match to have stayed in memory.

`Chair` is a sum. A covered human is a `CpuChair` with `away` set, not a boolean beside `kind: 'human'`. Misses on a live human are `0 | 1`. The value 2 is not stored. It is the flip. Open chairs exist only in the lobby.

`GameMeta` may set `quick`, the action types that are a short window and the decline action a timeout plays. Durations stay on the room, default 30,000 ms and 5,000 ms, host-configurable inside the ranges the settings sheet already uses. A window timeout does not increment misses and does not call the policy. Flip 7 leaves `quick` unset.

Seat ids are `s0`, `s1`, `s2`, `s3` in list order after rotation. House ids stay whatever the game already uses (`dealer` for blackjack).

## Engine contract changes

Specified here. Not edited in this pull request.

`GameDefinition` loses `seatsFor` and gains `house` (dealer seats the roster appends) and `opening(state): Action | null`. `GameMeta` gains optional `quick`.

`startMatch` and `replay` in `packages/engine/src/match.ts` take `{ config, seats, seed }` instead of calling `seatsFor`. `applyOpening` applies `opening()`, logs it as `seats[0].id` with `kind: 'human'`, then runs the CPU cascade. It throws if `opening` is null. `autoAct` plays one policy action for the seat who is to act, even when that chair is still human, then runs the cascade. `continueMatch` runs CPUs until a human or nobody, and does not play `opening()`. `replayTail` applies a log onto an existing match and does not call `setup` or a policy.

`ActionRecord` gains `kind: 'human' | 'cpu'`. Live play and replay both use the recorded kind. `act` still rejects a caller whose seat kind is not `human`.

`runCpuTurns` stops when `toAct` is null or the seat is not `cpu`, as it does today. Because `toAct` is null between rounds, the cascade cannot deal.

Solo HTTP, when `toAct` is null and the posted action deep-equals `opening()`, calls `applyOpening` for the solo human. A mismatch is 400. The table still calls `act({ type: 'nextRound' })` when its `canOpen` prop is true.

### Single-player migration

Solo and a room share `seatList`. Solo reads the known keys `opponents`, `difficulty`, and `position`. `assertKnownSettings` fails unknown keys. The builder makes `[human, ...cpus]`, rotates left by `seed % length`, then appends `house`. A CPU can be dealt first. The room's first deal uses rotate 0, so the host is index 0. Rematch uses rotate 1 across the playing seats.

`createSession` calls the roster and then `startMatch`. It does not ask `humanSeat` which seat may see the view once the roster has recorded the human. `humanSeat` can remain only while a session is still known to contain one human, and it goes away for room frames. Room frames already name `you`.

Requested CPU count is the solo `opponents` value, or the room's empty chairs at Deal. It is clamped so humans plus CPUs plus house sit inside `seats.min` and `seats.max`. Four humans and zero CPUs is legal for Flip 7. A fifth human is rejected. The room does not add `config.opponents` on top of seated humans. That sum is what throws `checkSeats` today if someone naively stacks them.

Deleting `seatsFor` is one wave, after a single bridge pull request that still calls it and then passes the list. The bridge dies in the next pull request, before any room object exists. Two roster builders are how a second start path survives.

Name captions already use `Seat.name`. `packages/ui/src/primitives/opponent-rows.tsx` renders it. A later pull request draws one shared 8-bit bot mark when `kind` is `cpu`. `data-testid` `seat-<seatId>` already exists. Selectors in `e2e/flip7.spec.ts` move from `seat-you` and `seat-cpu-1` to `seat-s0` and `seat-s1` in the roster pull request, not in this one.

## Persistence

D1 stays the system of record. The schema below is specified and not migrated here.

`players` gains `nickname` (text) and `nickname_locked` (integer, 0 or 1). The nickname is set once. Later room joins read it. They do not trust a nickname on the command.

`room_directory` has `code` as primary key, `game_id`, `host_player_id`, `created_at`, and `closed_at`. The object id is `idFromName(code)`. The directory is how a closed code is visible without listing objects.

`session_members` has `session_id`, `player_id`, and `seat_id`. `sessions.player_id` remains the solo owner for solo rows. A four-player match does not pretend one of those columns is the whole table. Each match, including a rematch, inserts a new `sessions` row (`historyId`). `actions` keeps primary key `(session_id, seq)`. A new session is how `seq` restarts without a collision.

`rounds.summary_json` for a multiplayer match stores settlements and public totals. It does not store one human's private view. Solo history can keep today's summary.

The object stores step rows and one snapshot per round. A step row holds the logged action and the redacted frame per player. It does not hold `Match`, the seed, `rng`, or `Flip7State.draw`. The snapshot holds the match the object needs to continue, inside the object only. `foldRows` on wake rebuilds from those rows.

The D1 copy runs after the object commit, from the payload already in memory. It retries until the insert lands. A duplicate `(session_id, seq)` is a no-op. The object drops step rows only after that ack, then keeps the snapshot. On room close it deletes object storage so the bytes do not sit in the free-plan stored-data cap. D1 may lag during the retry. It does not correct the object, and the object does not forget the rows early.

`apps/worker/src/record.ts` is the only writer of that history. The object does not speak D1 itself beyond calling `record`.

## Free-tier cost

Gal's planning numbers stay. 100,000 rows written per day is the first wall, about 330 four-player games a day at 2 rows per action. That 330 figure is an illustration. It is not this design's measured capacity.

This design writes one step row per human action or alarm. The CPU cascade sits inside that row, so a Flip 7 deal that plays three CPUs is one step, not one row per engine action. `setAlarm()` is an extra row write. Replacing the snapshot and deleting older step rows at round end are extra writes, and deletes count. Index maintenance counts as further writes. Compaction waits for the D1 ack, so the peak is higher than the steady state.

Sources opened for this spec.

- Pricing, updated 30 September 2026. `https://developers.cloudflare.com/durable-objects/platform/pricing/`
  Free plan is SQLite-backed Durable Objects only. Exceeding a free limit fails that operation. Daily reset is 00:00 UTC. Requests are 100,000 per day. Duration is 13,000 GB-s per day. Hibernation-eligible idle time is not billed. A request creates the WebSocket. Outgoing WebSocket messages and protocol pings are free. The page says that for compute-request billing only, a 20 to 1 ratio is applied to incoming WebSocket messages. It does not say the free daily request cap uses that ratio. Rows read are 5 million per day. Rows written are 100,000 per day. Total SQL stored data is 5 GB. Footnote 3 says each `setAlarm()` is one row written. Footnote 4 says deletes count as rows written. Footnote 1 says the limits match D1. Storage billing was targeted for 7 January 2026, and the free plan is not charged for storage. An empty database is about 12 KB.
- Limits, updated 1 June 2026. `https://developers.cloudflare.com/durable-objects/platform/limits/`
  The opening says Durable Objects are a special kind of Worker, so Workers limits apply according to the Workers plan. The table lists CPU per request as 30 seconds by default, configurable to 5 minutes. A later paragraph says Durable Objects have the same per-invocation CPU limits as any Workers, and that the maximum CPU time per Durable Object invocation (HTTP, WebSocket message, or alarm) is 30 seconds by default. The storage table says 10 GB per object. The `SQLITE_FULL` paragraph says 10 GB on Paid or 1 GB on the Free plan.
- Workers limits, updated 12 October 2026. `https://developers.cloudflare.com/workers/platform/limits/`
  Workers Free CPU time is 10 ms per HTTP request. Error 1102 is `exceededCpu`. Waiting on I/O does not count. The page's advice to move expensive computation onto Durable Objects is not a statement that free-plan Durable Object CPU is 30 seconds.
- Alarms, updated 21 April 2026. `https://developers.cloudflare.com/durable-objects/api/alarms/`
  One alarm per object. `setAlarm` replaces the previous alarm. Delivery is at-least-once. Retries use exponential backoff from 2 seconds, up to 6 retries, only if `alarm()` throws. `alarmInfo.retryCount` and `isRetry` expose that. Only one `alarm()` runs at a time. Catch and reschedule when the work must retry longer than that. Do not call `setAlarm` in the constructor without checking `getAlarm`, because the constructor runs before `alarm` on wake. Wall time for an alarm handler is 15 minutes.
- WebSockets. `https://developers.cloudflare.com/durable-objects/api/websockets/`
  Hibernation uses `ctx.acceptWebSocket`. In-memory state resets and the constructor reruns. `serializeAttachment` keeps per-socket identity. `setTimeout` and `setInterval` prevent hibernation. The page says code updates disconnect all WebSockets, and deploying a new version restarts every Durable Object, which disconnects existing connections.

The sqlite storage API documents that index updates also count as row writes. The measurement includes them. This spec does not cite a second URL for that sentence beyond the pricing footnotes for `setAlarm` and deletes, which were the pages opened in full.

### How the first real-game pull request measures

That pull request counts, for one finished 4-seat Flip 7 with three CPUs, the step inserts, each `setAlarm`, snapshot replacements, deletes, index writes, and requests. It writes the count into `docs/decisions.md` and replaces the 330 illustration for this design. It also brackets local `performance.now()` around `command`, around `alarm`, around `foldRows` on wake, and around the whole handler, and logs the `ActionRecord` count.

Local time is a local budget. It does not prove the free-plan cap. If a deploy is possible, the same pull request records whether one free-plan alarm or WebSocket message completed or returned `exceededCpu`. If a deploy is not possible, it records the local numbers and leaves the cap question open. A local sample under or over 10 ms is not the platform decision. A real free-plan sample over 10 ms is what authorizes the following pull request to split the cascade so one alarm runs one CPU action. This design does not split it now, because `act` returns one `Step` and the table plays one `EventBatch`.

## Security and cheating

The object is the only process that holds `StoredMatch.private`. `frameFor` calls `definition.view(state, seat)` for a seated player, including an away player, who still sees their own cards and has `canAct` false. A watcher gets `you: null` and a view that passes the registration rule. The retry store copies that frame, never the match.

`act` applies only when `seq === match.seq`, the actor's chair is the human `toAct`, and the generation matches. A larger `seq` is a 409, as `postAction` does today. A smaller `seq` returns the stored frame for that seq and does not run the engine. A repeated `commandId` returns the stored frame for that id and does not rotate, deal, or sit twice. Ids are kept for the life of the match, not only the latest one.

The handler does not await between the rule check and the sqlite commit. The generation bumps in that commit, so a stale in-flight handler cannot write. D1 runs after.

`config.rig` is removed unless `DEV_RIG` is `1`, on solo HTTP and on `settings` and `deal`, before `parseConfig`. The seed is `crypto.randomUUID()` on the server for the first deal and for rematch. A client seed is ignored.

Action validation stays in `apply`. The room does not grow a second rules engine. It only checks whose chair may submit, whether the command is legal for the phase, and whether `seq` matches. `opening()` is the deal action, so a guest who posts `nextRound` on the socket is rejected. The room client never puts those bytes on the wire.

The code space is 32^4. A scanner can still walk it. Ten failed joins per minute per player, then 429, is the bound this spec sets.

## Failure modes

Deploy. Publishing a worker disconnects every room socket, per the websockets page. Clients reconnect with the same cookie, receive `snap: true`, and continue. The match is in sqlite, not in the disconnected heap.

Eviction. Hibernation drops memory and reruns the constructor. `foldRows` rebuilds from sqlite. The constructor does not call `setAlarm` without reading `getAlarm` first. One test builds that path by folding rows, because `wrangler dev` may not evict on its own.

Alarms. The handler is safe when `alarmInfo.isRetry` is true. A retry after a successful commit sees a later deadline and writes nothing. A crash before commit leaves the old deadline, so the next wake applies it once. Turn, quick, and host grace are separate fields. One `setAlarm` points at the earliest `dueAt`. On every wake, if host grace is due the room closes and no turn plays. Otherwise every other due deadline applies, then `setAlarm` is set to the next stored deadline. A wake that applies nothing still refreshes that alarm, so a reconnect that cleared grace does not lose the turn. If the close must not die after six thrown retries, the handler catches and reschedules.

Idempotence. Commands use `commandId`. Actions also use `seq`. Both return stored frames. The alarm uses the stored deadline plus the generation. None of these paths replay an effect that already committed.

D1 outage. The object keeps the step rows and retries `record`. Compaction waits. Players still play from the object.

## Testing and verification

Engine tests cover `opening`, `applyOpening`, `autoAct` while the seat is human, `continueMatch` refusing to deal, `replayTail` across a `kind` flip, and `seatList` clamps. Flip 7 version 2 rejects a version 1 blob. A seeded Flip 7 log assertion checks that events omit the draw order.

Worker tests, once the object exists, open two WebSocket clients against one room, deal, and assert each client lacks the other client's private bytes. Flip 7 has no private hand, so that test asserts the draw order is absent and `me` matches the seat. A fold test rebuilds the room from rows with an empty heap. An alarm test fires grace and a turn in one wake and asserts the room closes without applying the turn. A retry test resends an older `commandId` and asserts the engine `seq` does not move.

The web pull request drives two browser contexts through create, join, deal, a disconnect, and I am back. `spectator-count` is the eye counter. Phone and desktop stay on the existing Playwright projects.

`pnpm verify` runs on the pull request that changes the table, not on this spec.

## Phased plan

Plan only. This pull request is PR0 and implements none of the rest.

- PR1. Engine. `startMatch` and `replay` take seats. The worker still calls `seatsFor` and passes the list. Add `opening`, `applyOpening`, `ActionRecord.kind`, `autoAct`, `continueMatch`, and `replayTail`. Shipped games keep their current behavior. Tests only.
- PR2. The roster owns the list and deletes `seatsFor` in that same wave. Flip 7 `toAct` returns null between rounds, `opening` returns `nextRound`, the dealer starts as the last seat, `canOpen` gates the table, rig `you` maps to the human id, seat ids become `s0` onward, e2e selectors move, and `version` becomes 2. Solo stays on HTTP. Cross-project edits in Flip 7, Exploding Kittens, and Blackjack are logged in `docs/decisions.md` in that pull request. Blackjack's human id stays `player`. The PR1 bridge does not survive past PR2.
- PR3. Migration for `nickname`, `nickname_locked`, and `room_directory`. A worker test inserts a code.
- PR4. Durable Object lobby only. `POST /api/rooms`, hibernating sockets, presence refcount, no deal. Two WebSocket clients in a worker test. `wrangler.toml` gains `new_sqlite_classes`.
- PR5. Deal and play Flip 7. Per-seat views, `rig` stripped, redacted retry frames, generation counter.
- PR6. Timers, miss 1, miss 2, `back`, host grace, and one alarm that reschedules the other deadline.
- PR7. Rematch with a new `historyId`, `sit` at the next round with a `seatId`, and the spectator eye count.
- PR8. D1 history copy after ack, and the row and CPU measurement written to `docs/decisions.md`. The web UI can land here or in the next pull request. That UI is Play with friends, `/r/:code`, the 4-character code, the nickname once, the host Deal button, and `spectator-count`. End-to-end uses two browser contexts.

## Sketch comparison

Two whole shapes were sketched before this spec, against the design red flags in the architect notes. Operator override. Both runners and the cross-judge used `grok-4.7-xhigh` with fast mode off. The arena normally mixes model families. The score gap is one family.

Candidate 1 is one deep room module. The game stays on `GameDefinition`. `seatsFor` is deleted. The platform builds `Seat[]`. Solo and a room both call `beginMatch`. The web client speaks commands and frames.

Candidate 2 is a `GameAdapter` with seven methods (`assertRoster`, `hostDeal`, `play`, `situation`, `spectate`, `parseAction`, `parseView`). `seatsFor` stays for solo. Blackjack stays on `startMatch` directly. The web client imports `flip7Adapter` to rewrite `nextRound` into a deal. That is a shallow module, two ways to start a match, and a game author who has to learn boundary, covered, and previousFirst.

The cross-judge scored candidate 1 at 28/30 and candidate 2 at 16/30. Candidate 1 won on interface depth. It hides codes, sockets, alarms, takeover, and the host behind `setup(config, seats, rng)` and the methods Flip 7 already has. Candidate 2 adds surface area the game author must fill in.

Grafted from candidate 2.

- A quick-window timeout does not increment misses and does not call the policy. The decline action lives on `GameMeta.quick` in the game package, not as the strings `pass` and `nope` inside `clock.ts`.
- Every client command carries `commandId`.
- The CPU measurement includes `foldRows` on wake.

Not grafted. `GameAdapter`, `hostDeal`, `withBoundary`, a client that rewrites `nextRound` by importing the game, `act` while `kind` stays `human` for a covered seat, `seatsFor` left alive, and re-arming host grace from now instead of the stored `dueAt`.

The pre-review synthesis still let `toAct` return `order[0]` between rounds, forgot chairs on the live room, stored the last `commandId` only, and treated one alarm as one deadline. Interrogation rejected those. The sections above are the design after that review. The synthesis file stays the pre-review record.

## Interrogation

Reviewers A (`bc-32c8eefd-d345-5bda-89fe-c820b12c06bf`) and B (`bc-fb5efd5a-0876-50d7-b5cc-010df1d916b7`) both used `grok-4.7-xhigh`. The full buckets are in the agent store at `internal/interrogation/verdict.md`. What changed in this spec is listed here.

Act on, and what changed.

- One opener. `opening()`, `toAct` null between rounds, `applyOpening`, table `canOpen` false in a room, shell `deal`, server action is `opening()`.
- One roster. Chairs on lobby and live, clamp into `seats.min` and `seats.max`, no stacked `opponents`, solo rotates by `seed % length`, room first deal does not, rematch rotates left by one, rig `you` maps to the human id, `sit` carries `seatId`.
- Failure and cheat safety. Redacted frames in the retry log for the life of the match, generation counter, no await before commit, D1 after ack, rig strip, server seeds, separate deadlines, presence refcount, 15 second host grace, 10 failed joins per minute.
- Takeover and replay. Miss 1 is `autoAct` while human. Miss 2 flips to `cpu` with `away` before `continueMatch`. `ActionRecord.kind`. New `historyId` per match. Display seat omits `difficulty`. Engine seat keeps it. Compact only after D1 ack. Delete object storage on close.
- Plan and measurement. No `Room` solo variant. Blackjack stays solo. Exploding Kittens stays unregistered. The PR1 bridge dies in PR2. 330 is an illustration. A local CPU sample does not decide the free-plan cap.

Consider. The sqlite index list is chosen in the object pull request, because each index update is another row write. The measurement counts them. This spec does not freeze the indexes.

Noted. The lint bans above. The storage-size and CPU-cap and 20 to 1 discrepancies, left open. A fold-from-sqlite test. The pre-existing chips forfeit race, out of scope. Event redaction still deferred, with a Flip 7 event test in the first game pull request.

Dismissed. A type-level matrix of room kind and command, because the socket is JSON. Keeping `seatsFor` for solo. Treating 20 to 1 as the free request cap. The adapter, covered-while-human, and `withBoundary`. The claim that the 1 GB free-plan sentence is stale. Host migration, Easy-only timeout, a 30 minute idle expiry, and a required `spectatorView` for Flip 7. Polling and peer-to-peer.

## Principles

These are the leaf notes read for this design, each tied to the choice it changed.

Exhaust the design space. Two whole shapes were built and compared on interface depth before the pick. The adapter lost because it made the game author fill seven methods and made the web client import Flip 7 to deal.

Foundational thinking. The seat list and the `Room` sum are the core data. The socket and the alarm come later. Solo and a room share `seatList` so a later phase cannot grow a second start path. `opening()` is the scaffold every later score game needs for a host Deal, so the CPU cascade cannot be the thing that deals.

Model the domain. `Room` and `Chair` are sums. A covered human is a CPU chair with `away: PlayerId | null`, not a flag beside `kind: 'human'`. A quick window is not a turn, so it does not increment misses. Misses are `0 | 1` because 2 is the flip, which is a different chair. `toAct` null between rounds means nobody's turn, so the CPU loop cannot deal.

Type system discipline. `PlayerId`, `RoomCode`, and `CommandId` are brands, checked at the boundary in `wire.ts`. Misses cannot store an arbitrary number. Kick, chat, and chip commands are absent from `ClientCommand`. The retry payload is a `Frame`, not a `StoredMatch`. Lobby chairs cannot carry misses. Live chairs cannot be `open`.

## Open questions

Cloudflare's limits page says Durable Object CPU defaults to 30 seconds, and also says Durable Objects share Workers per-invocation CPU limits. Workers Free is 10 ms. Which cap a free-plan alarm or WebSocket message actually hits is not settled by those pages. The measurement in the first real-game pull request is how this spec answers it. Until that outcome is recorded, the question stays open.

The pricing page's 20 to 1 ratio is described as compute-request billing. It is not explicit that the free daily request cap of 100,000 uses that ratio. Row writes stay the planning wall. The measurement also counts requests.

The limits table says 10 GB per object. A later paragraph on the same page says a free-plan object hits `SQLITE_FULL` at 1 GB. Pricing says 5 GB total SQL stored data on the free plan. Which number binds one room is open. It is not the daily row wall. This spec does not pick a winner among those three sentences.
