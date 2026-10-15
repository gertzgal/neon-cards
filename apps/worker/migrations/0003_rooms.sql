-- Nickname is set once. room_directory is how a closed code stays visible without listing objects.
-- Timestamps are Unix epoch milliseconds.

ALTER TABLE players ADD COLUMN nickname TEXT;
ALTER TABLE players ADD COLUMN nickname_locked INTEGER NOT NULL DEFAULT 0 CHECK (nickname_locked IN (0, 1));

CREATE TABLE room_directory (
  code TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  host_player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);
