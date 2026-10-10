// Drizzle mirror of migrations/0002_core.sql. The SQL migrations are the source of truth for D1.
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
})

export const wallets = sqliteTable('wallets', {
  playerId: text('player_id')
    .primaryKey()
    .references(() => players.id),
  balance: integer('balance').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const walletLedger = sqliteTable(
  'wallet_ledger',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    ref: text('ref'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('wallet_ledger_player').on(t.playerId, t.createdAt)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    gameId: text('game_id').notNull(),
    gameVersion: integer('game_version').notNull(),
    seed: text('seed').notNull(),
    config: text('config').notNull(),
    stateJson: text('state_json').notNull(),
    status: text('status', { enum: ['active', 'over'] }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sessions_player').on(t.playerId, t.createdAt)],
)

export const actions = sqliteTable(
  'actions',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    seq: integer('seq').notNull(),
    seat: text('seat').notNull(),
    actionJson: text('action_json').notNull(),
    /** Set on human actions only: the stored response a retried `seq` returns. */
    responseJson: text('response_json'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.seq] })],
)

export const rounds = sqliteTable(
  'rounds',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    roundNo: integer('round_no').notNull(),
    summaryJson: text('summary_json').notNull(),
    net: integer('net').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [unique().on(t.sessionId, t.roundNo)],
)
