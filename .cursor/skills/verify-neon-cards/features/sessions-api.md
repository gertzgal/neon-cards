# Sessions, actions, and history API

A game session lives on the server. `POST /api/sessions {gameId, config}` parses the config, seats the table, runs any CPU turns before the human's, and returns `{sessionId, gameId, seats, events, view, seq, status, wallet?}`. Each `POST /api/sessions/:id/actions {action, seq}` applies the human action, runs CPU seats server-side (each as a `turn` event followed by its events), settles finished rounds into history and, for chips games, the wallet, and returns `{events, view, seq, status, wallet?}`. Send back the `seq` from the last response; a retried `seq` returns the stored response. `GET /api/sessions/:id` resumes; `GET /api/history?gameId=` lists finished rounds newest first.

## Sub-features

- `session-create`: 201 with seats in turn order, `seq`, and the human's redacted view (Blackjack's hole card is `face: null`).
- `session-action`: 200 with events and the next `seq`; 400 for an illegal action, 409 for a stale or ahead `seq` or an over session, 404 for another player's session.
- `session-idempotent`: re-posting a used human `seq` returns byte-identical JSON.
- `chips-settle`: a Blackjack round's net lands in the wallet and in history.
- `chips-forfeit`: starting a new chips session while a hand is dealt (New game, a second tab, a `?rig=` URL) forfeits that hand's stake: a history row with the negative net and `summary.forfeit: true`, and a `forfeit` wallet ledger row.
- `cpu-seats`: proven in `apps/worker/test/sessions.test.ts` with the engine's test-only High Card game (not in the production registry).

## How to get to it (user POV)

- The shell's game screen creates or resumes a session and posts every button press as an action.
- `curl` with a cookie jar (below).

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes. The verify stack runs with `DEV_RIG=1`, so `config.rig` works.

```sh
J=/tmp/jar; U=http://localhost:$PORT/api; C="curl -s -c $J -b $J -H content-type:application/json"
ID=$($C -X POST $U/sessions -d '{"gameId":"blackjack","config":{"rig":"blackjack"}}' | jq -r .sessionId)
$C -X POST $U/sessions/$ID/actions -d '{"action":{"type":"bet","amount":100},"seq":0}' | jq '{seq, wallet, phase: .view.phase}'
$C $U/wallet
$C "$U/history?gameId=blackjack" | jq '.rounds[] | {roundNo, net}'
```

- **Blackjack rig.** The bet returns `{"seq":1,"wallet":1400,"phase":"settling"}`; the wallet reads `{"balance":1400}`; history has round 1 with net 150.
- **Idempotent retry.** Re-post the bet with `"seq":0`: identical body.
- **Errors.** `"seq":7` is 409; `{"type":"bet","amount":7}` with `"seq":1` is 400 `{"error":"Bet must be a multiple of 5"}`; `curl $U/sessions/$ID` without the jar is 404.

## Gotchas

- `seq` counts CPU actions too, so never compute it client-side; use the last response's.
- A play action is two D1 round trips: one read of the session joined to the wallet and the round count, then one write batch. A cookie that is already set is not looked up again on that path. `apps/worker/test/action-queries.test.ts` fails if a hit, stand, double, or split grows past that.
- Starting a new chips session closes the player's other active chips sessions (actions on them are 409) and forfeits any chips staked on a dealt, unsettled hand. Undealt chips on the felt are client-only and cost nothing.
- Without `DEV_RIG=1` (production), `config.rig` and `seed` are 400s.
