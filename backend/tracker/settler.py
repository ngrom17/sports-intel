"""
Settlement engine — runs after games go final.

Uses deterministic ticker parsing (parser.py) to determine W/L/push.
Looks up closing prices for CLV calculation.
Append-only: UNIQUE(pick_id) in settlements prevents double-settlement.
"""
from datetime import datetime, timezone
from .db import get_db
from .parser import determine_result


def capture_closing_prices(sport: str, rows: list[dict], game_date: str) -> int:
    """
    Snapshot current Kalshi prices as closing prices.
    Call this ~30 minutes before the first tipoff of the day.
    Idempotent — UNIQUE(ticker, game_date) skips already-captured tickers.
    """
    db  = get_db()
    now = datetime.now(timezone.utc).isoformat()
    saved = 0
    for row in rows:
        try:
            db.table("closing_prices").insert({
                "captured_at": now,
                "ticker":      row["ticker"],
                "game_date":   game_date,
                "kalshi_prob": row.get("kalshi_prob", 0),
            }).execute()
            saved += 1
        except Exception:
            pass   # already captured
    return saved


def settle_pending_picks(sport: str, games: list[dict]) -> dict:
    """
    Settle all unsettled picks for games that are now final.

    games: list of game dicts (from fetch_games) with status + final scores.
    Returns a summary dict.
    """
    db = get_db()

    final_games = {
        g["game_id"]: g
        for g in games
        if g.get("status") == "final"
    }
    if not final_games:
        return {"settled": 0, "skipped": 0, "reason": "no_final_games"}

    # Picks for final games that haven't been settled yet
    unsettled_resp = (
        db.table("daily_picks")
        .select("*")
        .eq("sport", sport)
        .in_("game_id", list(final_games.keys()))
        .execute()
    )
    if not unsettled_resp.data:
        return {"settled": 0, "skipped": 0, "reason": "no_matching_picks"}

    pick_ids = [p["id"] for p in unsettled_resp.data]
    already  = {
        s["pick_id"]
        for s in db.table("settlements")
                    .select("pick_id")
                    .in_("pick_id", pick_ids)
                    .execute()
                    .data
    }
    to_settle = [p for p in unsettled_resp.data if p["id"] not in already]

    # Load closing prices for CLV
    tickers = [p["ticker"] for p in to_settle]
    closing_map: dict[str, float] = {}
    if tickers:
        cp = (
            db.table("closing_prices")
            .select("ticker, kalshi_prob")
            .in_("ticker", tickers)
            .execute()
        )
        closing_map = {r["ticker"]: r["kalshi_prob"] for r in cp.data}

    settled_count = 0
    skipped_count = 0
    now = datetime.now(timezone.utc).isoformat()

    for pick in to_settle:
        game = final_games.get(pick["game_id"])
        if not game:
            skipped_count += 1
            continue

        home_score = game.get("home_score") or 0
        away_score = game.get("away_score") or 0

        result, payout = determine_result(
            market_type   = pick["market_type"],
            ticker        = pick["ticker"],
            home_abbr     = pick["home_abbr"],
            away_abbr     = pick["away_abbr"],
            home_score    = home_score,
            away_score    = away_score,
            american_odds = pick.get("american_odds", ""),
            stake         = float(pick["stake_amount"]),
        )

        ensemble_prob  = float(pick["ensemble_prob"])
        closing_prob   = closing_map.get(pick["ticker"])
        clv            = round(ensemble_prob - closing_prob, 4) if closing_prob is not None else None

        try:
            db.table("settlements").insert({
                "pick_id":              pick["id"],
                "sport":                sport,
                "settled_at":           now,
                "final_home_score":     home_score,
                "final_away_score":     away_score,
                "result":               result,
                "payout":               payout,
                "net_pnl":              round(payout - float(pick["stake_amount"]), 2),
                "ensemble_prob_at_pick": ensemble_prob,
                "closing_prob":         closing_prob,
                "clv":                  clv,
                "settlement_source":    "auto",
            }).execute()
            settled_count += 1
        except Exception:
            skipped_count += 1   # UNIQUE violation — race condition

    return {"settled": settled_count, "skipped": skipped_count}
