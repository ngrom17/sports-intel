"""
Daily pick logger — immutable, idempotent, sport-agnostic.

Selection rule: top MAX_PICKS picks by EV where:
  - edge >= MIN_EDGE
  - category in ELIGIBLE_CATEGORIES
  - ev_per_100 > 0

Idempotent: UNIQUE(pick_date, ticker) in DB prevents double-logging.
"""
from datetime import date, datetime, timezone
from .db import get_db

# ── Selection parameters ──────────────────────────────────────────────────────
MIN_EDGE            = 0.05
MAX_PICKS           = 15
STAKE_AMOUNT        = 100.0
STAKE_RULE          = "flat_100"
ELIGIBLE_CATEGORIES = {"HOMERUN", "UNDERVALUED", "UNDERDOG"}
SELECTION_REASON    = f"top_{MAX_PICKS}_ev_edge_gte_{MIN_EDGE}"

# Map sport → model version tag
MODEL_VERSION: dict[str, str] = {
    "nba":   "nba-xgb-v1",
    "nhl":   "nhl-xgb-v1",
    "ncaab": "ncaab-xgb-v1",
    "mlb":   "mlb-xgb-v1",
    "nfl":   "nfl-xgb-v1",
}


def log_daily_picks(
    sport: str,
    rows: list[dict],
    games: list[dict],
    today: date,
) -> dict:
    """
    Insert market_snapshots + model_predictions + daily_picks for today.
    Safe to call multiple times — existing picks are skipped via DB constraint.

    rows:  prediction rows from build_all_rows()
    games: game list from fetch_games()
    today: date to log under
    """
    db = get_db()

    if not rows:
        return {"status": "no_data", "sport": sport, "date": str(today), "picks_logged": 0}

    # Short-circuit if already logged today — avoids polluting snapshot/prediction tables
    existing = (
        db.table("daily_picks")
        .select("id", count="exact")
        .eq("sport", sport)
        .eq("pick_date", str(today))
        .execute()
    )
    if existing.count and existing.count > 0:
        return {"status": "already_logged", "sport": sport, "date": str(today),
                "eligible": 0, "picks_logged": 0}

    game_lookup: dict[int, dict] = {g["game_id"]: g for g in games}
    model_ver = MODEL_VERSION.get(sport, f"{sport}-v1")
    now = datetime.now(timezone.utc).isoformat()

    # Filter eligible picks
    candidates = [
        r for r in rows
        if r.get("category") in ELIGIBLE_CATEGORIES
        and r.get("edge", 0) >= MIN_EDGE
        and r.get("ev", 0) > 0
    ]

    # Deduplicate: keep only the best EV pick per (game_id, market_type).
    # Prevents logging both "home wins" and "away wins" for the same game,
    # or multiple over/under lines for the same game.
    seen_game_market: dict = {}
    for r in sorted(candidates, key=lambda x: x.get("ev", 0), reverse=True):
        key = (r.get("game_id"), r.get("market_type", "moneyline"))
        if key not in seen_game_market:
            seen_game_market[key] = r

    eligible = sorted(seen_game_market.values(), key=lambda x: x.get("ev", 0), reverse=True)

    if not eligible:
        return {"status": "no_eligible_picks", "sport": sport, "date": str(today), "picks_logged": 0}

    logged = 0
    for rank, row in enumerate(eligible[:MAX_PICKS], 1):
        game     = game_lookup.get(row["game_id"], {})
        ticker   = row["ticker"]
        home_abbr = row.get("home_abbr", game.get("home_abbr", ""))
        away_abbr = row.get("away_abbr", game.get("away_abbr", ""))

        # ── 1. Market snapshot ───────────────────────────────────────────────
        snap = db.table("market_snapshots").insert({
            "observed_at":   now,
            "sport":         sport,
            "game_id":       row["game_id"],
            "game_label":    row.get("game_label", ""),
            "game_date":     str(today),
            "tipoff_utc":    game.get("tipoff_utc"),
            "home_abbr":     home_abbr,
            "away_abbr":     away_abbr,
            "market_type":   row.get("market_type", "moneyline"),
            "ticker":        ticker,
            "title":         row.get("title", ""),
            "kalshi_prob":   row.get("kalshi_prob", 0),
            "american_odds": row.get("american_odds", ""),
            "volume":        row.get("volume", 0),
            "market_status": "open",
        }).execute()
        snap_id = snap.data[0]["id"]

        # ── 2. Model prediction ──────────────────────────────────────────────
        pred = db.table("model_predictions").insert({
            "snapshot_id":   snap_id,
            "sport":         sport,
            "game_date":     str(today),
            "model_version": model_ver,
            "feature_version": "v1",
            "xgb_prob":      row.get("model_prob"),
            "ensemble_prob": row.get("model_prob", row.get("kalshi_prob", 0)),
            "kalshi_prob":   row.get("kalshi_prob", 0),
            "raw_edge":      row.get("edge", 0),
            "ev_per_100":    row.get("ev", 0),
            "kelly_fraction": row.get("kelly"),
            "category":      row.get("category", ""),
            "ev_rank":       rank,
        }).execute()
        pred_id = pred.data[0]["id"]

        # ── 3. Daily pick (UNIQUE constraint makes this idempotent) ──────────
        try:
            db.table("daily_picks").insert({
                "prediction_id":  pred_id,
                "sport":          sport,
                "pick_date":      str(today),
                "stake_rule":     STAKE_RULE,
                "stake_amount":   STAKE_AMOUNT,
                "selected_rank":  rank,
                "selection_reason": SELECTION_REASON,
                "game_id":        row["game_id"],
                "game_label":     row.get("game_label", ""),
                "home_abbr":      home_abbr,
                "away_abbr":      away_abbr,
                "tipoff_utc":     game.get("tipoff_utc"),
                "ticker":         ticker,
                "title":          row.get("title", ""),
                "market_type":    row.get("market_type", "moneyline"),
                "category":       row.get("category", ""),
                "raw_edge":       row.get("edge", 0),
                "ev_per_100":     row.get("ev", 0),
                "kelly_fraction": row.get("kelly"),
                "american_odds":  row.get("american_odds", ""),
                "ensemble_prob":  row.get("model_prob", row.get("kalshi_prob", 0)),
                "kalshi_prob":    row.get("kalshi_prob", 0),
                "model_version":  model_ver,
            }).execute()
            logged += 1
        except Exception:
            # UNIQUE violation — already logged this ticker today
            pass

    return {
        "status":       "logged" if logged else "already_logged",
        "sport":        sport,
        "date":         str(today),
        "eligible":     len(eligible),
        "picks_logged": logged,
    }
