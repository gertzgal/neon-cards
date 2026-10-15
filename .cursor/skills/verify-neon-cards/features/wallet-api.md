# Wallet API and player identity

The first `/api/*` call that needs a player creates an anonymous one, sets it in the httpOnly `nc_player` cookie, and opens a wallet at the 1,250 starting bankroll. `GET /api/wallet` returns `{"balance": n}`. A broke player (balance below 5, the smallest chip) is refilled to 1,250 on read, the response carries `refilled`, and the refill lands in `wallet_ledger`.

## Sub-features

- `player-cookie`: first call sets `nc_player=<uuid>; HttpOnly; SameSite=Lax`; later calls with the cookie don't set it again. An unknown id is replaced.
- `wallet-start`: a new player reads `{"balance":1250}`.
- `wallet-refill`: a broke player reads `{"balance":1250,"refilled":<delta>}` once, then `{"balance":1250}`.

## How to get to it (user POV)

- The game shell reads the bankroll from it for the HUD.
- `curl -c jar -b jar http://localhost:$PORT/api/wallet`.

## Driving it with verify.sh

Preconditions:

- `pnpm verify doctor` passes.

- **Cookie and start.** Run `curl -s -i -c /tmp/jar -b /tmp/jar http://localhost:$PORT/api/wallet`. Headers include `Set-Cookie: nc_player=...; HttpOnly; SameSite=Lax`; the body is `{"balance":1250}`. Repeat it: no `Set-Cookie`, same body.
- **Refill.** Lose the bankroll through play (or, in `apps/worker/test`, set the balance directly), then read the wallet again.

## Gotchas

- `curl` without a cookie jar makes a fresh player on every call.
- The cookie is `Secure` only over https, so local `http://localhost` keeps working.
