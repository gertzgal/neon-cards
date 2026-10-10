-- Core platform schema. Mirrors apps/worker/src/db/schema.ts; change both together.
-- Timestamps are Unix epoch milliseconds.

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE wallets (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  balance INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE wallet_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX wallet_ledger_player ON wallet_ledger(player_id, created_at);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL,
  game_version INTEGER NOT NULL,
  seed TEXT NOT NULL,
  config TEXT NOT NULL,
  state_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_player ON sessions(player_id, created_at);

CREATE TABLE actions (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,
  seat TEXT NOT NULL,
  action_json TEXT NOT NULL,
  response_json TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, seq)
);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  round_no INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  net INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, round_no)
);
