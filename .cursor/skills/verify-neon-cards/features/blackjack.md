# Blackjack table

The Blackjack table at `/games/blackjack`, built from the UI kit. Bet with chips (5 cyan, 25 pink, 100 violet, 500 gold), deal, then hit, stand, double, or split against a dealer who stands on all 17s; a natural pays 3:2. Every server event plays through the kit's juice (deal fly-ins, the hole-card flip, bust shake, the gold blackjack burst and pop that stay below the dealer tray) and a tap skips to the end. The last bet is placed again after each round, and a broke player is refilled to $1,250 automatically. A reload mid-hand resumes the same hand from the server.

## Sub-features

- `blackjack-table` carries `data-stage` (`betting`, `dealing`, `playing`, `dealer`, `settling`), `data-busy` (a request or playback is running; wait for `false` before acting), `data-split`, and the last settled round: `data-rounds`, `data-last-outcomes` (`win`, `lose`, `push`, `blackjack`, comma-separated per hand), `data-last-statuses`, `data-last-net`, and `data-last-dealer` (`blackjack`, `bust`, or empty).
- Betting: `chip-5`, `chip-25`, `chip-100`, `chip-500`, `action-clear`, `action-deal`. `bet-amount[data-value]` is the bet, and `hud-bankroll[data-value]` is the bankroll minus the bet.
- Playing: `action-hit`, `action-stand`, `action-double`, `action-split`, each enabled only when legal. Keyboard: H, S, D, P, Space or Enter to deal, Backspace to clear.
- Hands: `dealer-tray` holds `dealer-hand` and `dealer-total`; `dealer-hand` is hidden while betting. Each player hand is `hand-<n>` (`data-status` `active`/`stood`/`bust`/`blackjack`, `data-outcome`, `data-active`, `data-bet`) with `hand-<n>-spot[data-state]` and `hand-<n>-total`. Cards are `card-<id>` with an aria label such as `10♥`, or `face-down card`.
- Results: `number-pop` in `fx-layer` (`+$50`, `-$50`, `±$0`, `+$1,250` for a refill; `data-tier="big"` for a blackjack).

## How to get to it (user POV)

- Open `http://localhost:$PORT/games/blackjack`, or tap the Blackjack tile in the lobby.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes. Rigs need `DEV_RIG=1`, which every local stack sets.

- **Deal.** `scripts/verify.sh drive --path "/games/blackjack?rig=win" --click chip-25 --click chip-25 --click action-deal --expect "hand-0-total=19" --expect "dealer-total=9" --expect "bet-amount=\$50"`.
- **Blackjack moment.** `scripts/verify.sh drive --path "/games/blackjack?rig=blackjack" --click chip-25 --click chip-25 --click action-deal --expect "number-pop=+\$75"`.
- **Every moment** (betting, deal, hit, stand, double, split, bust, blackjack, push, dealer blackjack, refill, resume, history) at both viewports: `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/blackjack.spec.ts`. Set `SCREENS_DIR=docs/reference/screens` to refresh the committed screenshots.

## Gotchas

- Rigs (`?rig=win|lose|push|bust|blackjack|dealerbj|double|split|splitaces|bjpush|dealerbust|soft17`, or a card list like `AH,9C,KS,7D`) stack the top of the shoe in deal order: player, dealer up, player, dealer hole, then draws. A rigged URL always starts a new session.
- After a round the table re-places the last bet, so `bet-amount` is non-zero in the next betting stage. Tap `action-clear` before building a different bet.
- `number-pop` lives in the stage-wide `fx-layer` only while it animates; assert on it right after the action, and on `data-last-*` once `data-busy` is `false`.
