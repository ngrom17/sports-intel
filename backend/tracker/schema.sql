-- ============================================================
-- Sports Intel — Institutional Tracker Schema
-- Run this in the Supabase SQL editor before first deploy.
-- All tables are append-only. Never UPDATE. Only INSERT.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. MARKET SNAPSHOTS
-- The full opportunity set — every market observed each cycle.
-- Critical for avoiding selection bias: log ALL markets seen,
-- not just the ones we pick. Research can then compare picked
-- vs skipped opportunities without retroactive filtering.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_snapshots (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    observed_at      TIMESTAMPTZ NOT NULL,
    sport            VARCHAR(16) NOT NULL,   -- 'nba', 'nhl', 'ncaab', 'mlb', 'nfl'
    game_id          BIGINT      NOT NULL,
    game_label       TEXT        NOT NULL,   -- "MEM @ PHI"
    game_date        DATE        NOT NULL,
    tipoff_utc       TIMESTAMPTZ,
    home_abbr        VARCHAR(8),
    away_abbr        VARCHAR(8),
    market_type      VARCHAR(16) NOT NULL,   -- 'moneyline', 'spread', 'total'
    ticker           TEXT        NOT NULL,
    title            TEXT        NOT NULL,
    kalshi_prob      NUMERIC(6,4) NOT NULL,
    american_odds    TEXT,
    volume           INTEGER     DEFAULT 0,
    market_status    VARCHAR(32) DEFAULT 'open',
    CONSTRAINT chk_snapshot_prob CHECK (kalshi_prob BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_sport_date ON market_snapshots (sport, game_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_observed   ON market_snapshots (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_ticker     ON market_snapshots (ticker);


-- ─────────────────────────────────────────────────────────────
-- 2. MODEL PREDICTIONS
-- One row per scored contract per observation. Append-only.
-- If model version changes, new rows with new model_version.
-- Prediction timestamp + model_version allow full audit trail.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_predictions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id      UUID        REFERENCES market_snapshots(id) NOT NULL,
    predicted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sport            VARCHAR(16) NOT NULL,
    game_date        DATE        NOT NULL,
    model_version    TEXT        NOT NULL,  -- e.g. 'nba-xgb-v1'
    feature_version  TEXT        NOT NULL DEFAULT 'v1',
    -- Raw model outputs
    xgb_prob         NUMERIC(6,4),
    ensemble_prob    NUMERIC(6,4) NOT NULL,
    kalshi_prob      NUMERIC(6,4) NOT NULL,
    no_vig_prob      NUMERIC(6,4),
    raw_edge         NUMERIC(6,4) NOT NULL,
    ev_per_100       NUMERIC(8,2) NOT NULL,
    kelly_fraction   NUMERIC(6,4),
    category         VARCHAR(32) NOT NULL,
    ev_rank          INTEGER,              -- rank within full daily prediction set
    CONSTRAINT chk_pred_ensemble CHECK (ensemble_prob BETWEEN 0 AND 1),
    CONSTRAINT chk_pred_kalshi   CHECK (kalshi_prob   BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_predictions_sport_date ON model_predictions (sport, game_date);
CREATE INDEX IF NOT EXISTS idx_predictions_category   ON model_predictions (category);
CREATE INDEX IF NOT EXISTS idx_predictions_snapshot   ON model_predictions (snapshot_id);


-- ─────────────────────────────────────────────────────────────
-- 3. DAILY PICKS
-- The selection decision. Immutable once written.
-- Denormalized key fields so queries never need joins.
-- UNIQUE(pick_date, ticker) makes the logger idempotent.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_picks (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id    UUID        REFERENCES model_predictions(id) NOT NULL,
    sport            VARCHAR(16) NOT NULL,
    pick_date        DATE        NOT NULL,
    selected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Decision metadata
    stake_rule       TEXT        NOT NULL DEFAULT 'flat_100',
    stake_amount     NUMERIC(8,2) NOT NULL DEFAULT 100.00,
    selected_rank    INTEGER     NOT NULL,
    selection_reason TEXT        NOT NULL,  -- "top_15_ev_edge_gte_0.05"

    -- Market context snapshot (frozen at decision time — never changes)
    game_id          BIGINT      NOT NULL,
    game_label       TEXT        NOT NULL,
    home_abbr        VARCHAR(8)  NOT NULL,
    away_abbr        VARCHAR(8)  NOT NULL,
    tipoff_utc       TIMESTAMPTZ,
    ticker           TEXT        NOT NULL,
    title            TEXT        NOT NULL,
    market_type      VARCHAR(16) NOT NULL,
    category         VARCHAR(32) NOT NULL,
    raw_edge         NUMERIC(6,4) NOT NULL,
    ev_per_100       NUMERIC(8,2) NOT NULL,
    kelly_fraction   NUMERIC(6,4),
    american_odds    TEXT,
    ensemble_prob    NUMERIC(6,4) NOT NULL,
    kalshi_prob      NUMERIC(6,4) NOT NULL,
    model_version    TEXT        NOT NULL,

    -- Prevents double-logging the same market on the same day
    CONSTRAINT uq_daily_pick UNIQUE (pick_date, ticker)
);

CREATE INDEX IF NOT EXISTS idx_picks_sport_date ON daily_picks (sport, pick_date DESC);
CREATE INDEX IF NOT EXISTS idx_picks_category   ON daily_picks (category);
CREATE INDEX IF NOT EXISTS idx_picks_game_id    ON daily_picks (game_id);


-- ─────────────────────────────────────────────────────────────
-- 4. SETTLEMENTS
-- Written once per pick when the game goes final.
-- Append-only. UNIQUE(pick_id) prevents double-settlement.
-- closing_prob: Kalshi price captured near game start for CLV.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id               UUID        REFERENCES daily_picks(id) NOT NULL,
    sport                 VARCHAR(16) NOT NULL,
    settled_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Final scores
    final_home_score      INTEGER,
    final_away_score      INTEGER,

    -- Outcome
    result                VARCHAR(8)  NOT NULL,
    payout                NUMERIC(8,2) NOT NULL,
    net_pnl               NUMERIC(8,2) NOT NULL,

    -- Closing-line value (CLV)
    -- Positive = we predicted better than where market closed
    ensemble_prob_at_pick NUMERIC(6,4) NOT NULL,
    closing_prob          NUMERIC(6,4),  -- kalshi price ~game start
    clv                   NUMERIC(6,4),  -- ensemble_prob_at_pick - closing_prob

    settlement_source     TEXT        NOT NULL DEFAULT 'auto',

    CONSTRAINT uq_settlement     UNIQUE (pick_id),
    CONSTRAINT chk_result        CHECK (result IN ('win', 'loss', 'push', 'void')),
    CONSTRAINT chk_ensemble_prob CHECK (ensemble_prob_at_pick BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_settlements_sport   ON settlements (sport, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_result  ON settlements (result);
CREATE INDEX IF NOT EXISTS idx_settlements_pick    ON settlements (pick_id);


-- ─────────────────────────────────────────────────────────────
-- 5. CLOSING PRICES
-- Separate table to track Kalshi prices at/near game start.
-- Written by a pre-game job running ~30 min before tipoff.
-- Used to compute CLV when settling.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS closing_prices (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ticker       TEXT        NOT NULL,
    game_date    DATE        NOT NULL,
    kalshi_prob  NUMERIC(6,4) NOT NULL,
    CONSTRAINT uq_closing UNIQUE (ticker, game_date)
);

CREATE INDEX IF NOT EXISTS idx_closing_ticker ON closing_prices (ticker, game_date);
