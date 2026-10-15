# Rooms

Play with friends opens a Flip 7 room. The address is `/r/` plus a 4-character code, and that same code is on the screen. A nickname is assigned once and shown on the seat. The host presses Deal. Watchers are an eye count (`spectator-count`) on the shell. A watcher can take an open CPU seat for the next round. Two missed turns cover a chair, and I'm back returns it. Rematch rotates who goes first and waits for Deal. The host leaving closes the room. Blackjack has no room.

## Sub-features

- Home: `play-with-friends`, `room-code-input`, `room-join`.
- Room: `room-screen` (`data-you`, `data-state`), `room-code`, `nickname`, `spectator-count`, `room-deal`, `room-back`, `room-rematch`, `room-leave`, `sit-<seatId>`, `room-closed`, `room-missing`.
- The Flip 7 table is the live table. The shell passes `canOpen` false, so Deal is the shell button.

## How to get to it (user POV)

- Lobby, Play with friends. Share the code or the `/r/:code` link.
- A friend types the code and presses Join, or opens the link.

## Driving it with verify.sh

Preconditions:

- `pnpm verify doctor` passes.

- **Open.** `pnpm verify drive --path / --click play-with-friends --expect room-code --expect room-deal --expect spectator-count`.
- **Full flows.** Two browsers, a rigged win, a mid-game join, a CPU takeover, the host leaving, and rematch are in `e2e/room.spec.ts`: `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/room.spec.ts`.

## Gotchas

- The code alphabet has no I, O, 0, or 1. A lowercase link is not a room.
- `?rig=` on the lobby is forwarded only when the worker has `DEV_RIG=1`. Production strips it.
- I'm back appears after two 30 second misses. The takeover spec waits up to 90 seconds.
