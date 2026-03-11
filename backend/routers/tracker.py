"""
Institutional tracker — logging, settlement, and analytics endpoints.
All write operations are idempotent. All reads are sport-filterable.
"""
from collections import defaultdict
from datetime import datetime, date
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Query

_ET = ZoneInfo("America/New_York")

def _today() -> date:
    return datetime.now(_ET).date()

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fetch_nba_data(today: date) -> tuple[list, list]:
    """Fetch games + prediction rows for NBA. Returns (games, rows)."""
    from nba.fetch import fetch_games, fetch_nba_stats, load_schedule, fetch_kalshi_markets
    from nba.model import build_all_rows
    games   = fetch_games(today)
    kalshi  = fetch_kalshi_markets()
    stats   = fetch_nba_stats()
    sched   = load_schedule()
    df      = build_all_rows(games, kalshi, stats, sched, {})
    rows    = df.to_dict(orient="records") if not df.empty else []
    return games, rows


def _fetch_nhl_data(today: date) -> tuple[list, list]:
    """Fetch games + prediction rows for NHL. Returns (games, rows)."""
    from nhl.fetch import fetch_games, fetch_kalshi_markets, fetch_standings
    from nhl.model import build_all_rows
    games      = fetch_games(today)
    kalshi     = fetch_kalshi_markets()
    standings  = fetch_standings()
    df         = build_all_rows(games, kalshi, standings, {})
    rows       = df.to_dict(orient="records") if not df.empty else []
    return games, rows


SPORT_FETCHERS = {
    "nba": _fetch_nba_data,
    "nhl": _fetch_nhl_data,
}


# ── Write endpoints ────────────────────────────────────────────────────────────

@router.post("/tracker/log")
def log_today(sport: str = Query(default="nba")):
    """
    Select and log today's top picks. Idempotent — safe to call many times.
    Inserts market_snapshots + model_predictions + daily_picks.
    """
    from tracker.logger import log_daily_picks
    today  = _today()
    fetcher = SPORT_FETCHERS.get(sport.lower())
    if not fetcher:
        return {"status": "sport_not_supported", "sport": sport}
    games, rows = fetcher(today)
    return log_daily_picks(sport.lower(), rows, games, today)


@router.post("/tracker/capture-closing")
def capture_closing(sport: str = Query(default="nba")):
    """
    Snapshot current Kalshi prices as closing prices for CLV calculation.
    Call ~30 min before first tipoff. Idempotent.
    """
    from tracker.settler import capture_closing_prices
    today   = _today()
    fetcher = SPORT_FETCHERS.get(sport.lower())
    if not fetcher:
        return {"status": "sport_not_supported", "sport": sport}
    _, rows = fetcher(today)
    saved   = capture_closing_prices(sport.lower(), rows, str(today))
    return {"status": "ok", "closing_prices_saved": saved}


@router.post("/tracker/settle")
def settle(sport: str = Query(default="nba")):
    """
    Settle picks for games that have gone final. Idempotent.
    Looks up closing prices for CLV, writes one settlement row per pick.
    """
    from tracker.settler import settle_pending_picks
    today   = _today()
    fetcher = SPORT_FETCHERS.get(sport.lower())
    if not fetcher:
        return {"status": "sport_not_supported", "sport": sport}
    games, _ = fetcher(today)
    return settle_pending_picks(sport.lower(), games)


# ── Read endpoints ─────────────────────────────────────────────────────────────

@router.get("/tracker/picks")
def get_picks(
    sport: str | None = Query(default=None),
    limit: int        = Query(default=100, le=500),
):
    """Historical picks with embedded settlement data."""
    from tracker.db import get_db
    db = get_db()
    q  = (
        db.table("daily_picks")
        .select("*, settlements(*)")
        .order("pick_date", desc=True)
        .order("selected_rank")
        .limit(limit)
    )
    if sport:
        q = q.eq("sport", sport.lower())
    return {"picks": q.execute().data}


@router.get("/tracker/pnl")
def get_pnl(sport: str | None = Query(default=None)):
    """
    Full PnL summary: totals, ROI, win rate, CLV stats, equity curve.
    Only counts settled picks.
    """
    from tracker.db import get_db
    db = get_db()
    q  = (
        db.table("settlements")
        .select("result, net_pnl, payout, clv, sport, daily_picks(pick_date, category, raw_edge, ev_per_100, stake_amount, market_type, ticker)")
    )
    if sport:
        q = q.eq("sport", sport.lower())
    rows = q.execute().data

    if not rows:
        return {
            "total_picks": 0, "wins": 0, "losses": 0, "pushes": 0,
            "win_rate": None, "net_pnl": 0.0, "total_staked": 0.0,
            "roi": None, "avg_clv": None, "pct_positive_clv": None,
            "equity_curve": [], "by_category": {}, "by_market_type": {},
        }

    wins   = [r for r in rows if r["result"] == "win"]
    losses = [r for r in rows if r["result"] == "loss"]
    pushes = [r for r in rows if r["result"] == "push"]
    n_bet  = len(wins) + len(losses)   # exclude pushes from rate calc

    total_staked = sum(float(r["daily_picks"]["stake_amount"]) for r in rows)
    total_pnl    = sum(float(r["net_pnl"] or 0) for r in rows)

    clv_vals     = [float(r["clv"]) for r in rows if r.get("clv") is not None]

    # Daily equity curve
    daily: dict[str, float] = defaultdict(float)
    for r in rows:
        d = r["daily_picks"]["pick_date"] if r.get("daily_picks") else "unknown"
        daily[d] += float(r["net_pnl"] or 0)
    cumulative, equity_curve = 0.0, []
    for d, pnl in sorted(daily.items()):
        cumulative += pnl
        equity_curve.append({"date": d, "daily_pnl": round(pnl, 2), "cumulative": round(cumulative, 2)})

    # Slice by category
    by_cat: dict[str, dict] = defaultdict(lambda: {"picks": 0, "wins": 0, "net_pnl": 0.0})
    for r in rows:
        cat = r["daily_picks"]["category"] if r.get("daily_picks") else "?"
        by_cat[cat]["picks"]   += 1
        by_cat[cat]["net_pnl"] += float(r["net_pnl"] or 0)
        if r["result"] == "win":
            by_cat[cat]["wins"] += 1

    # Slice by market type
    by_mkt: dict[str, dict] = defaultdict(lambda: {"picks": 0, "wins": 0, "net_pnl": 0.0})
    for r in rows:
        mkt = r["daily_picks"]["market_type"] if r.get("daily_picks") else "?"
        by_mkt[mkt]["picks"]   += 1
        by_mkt[mkt]["net_pnl"] += float(r["net_pnl"] or 0)
        if r["result"] == "win":
            by_mkt[mkt]["wins"] += 1

    return {
        "total_picks":      len(rows),
        "wins":             len(wins),
        "losses":           len(losses),
        "pushes":           len(pushes),
        "win_rate":         round(len(wins) / n_bet, 4) if n_bet else None,
        "net_pnl":          round(total_pnl, 2),
        "total_staked":     round(total_staked, 2),
        "roi":              round(total_pnl / total_staked, 4) if total_staked else None,
        "avg_clv":          round(sum(clv_vals) / len(clv_vals), 4) if clv_vals else None,
        "pct_positive_clv": round(sum(1 for c in clv_vals if c > 0) / len(clv_vals), 4) if clv_vals else None,
        "equity_curve":     equity_curve,
        "by_category":      dict(by_cat),
        "by_market_type":   dict(by_mkt),
    }


@router.get("/tracker/calibration")
def get_calibration(sport: str | None = Query(default=None)):
    """
    Edge-bucket calibration: does predicted edge correlate with realized win rate?
    Buckets: 5-7%, 7-9%, 9-11%, 11%+
    """
    from tracker.db import get_db
    db = get_db()
    q  = (
        db.table("settlements")
        .select("result, ensemble_prob_at_pick, clv, daily_picks(raw_edge, category, ev_per_100)")
    )
    if sport:
        q = q.eq("sport", sport.lower())
    rows = q.execute().data
    if not rows:
        return {"buckets": [], "note": "no settled picks yet"}

    buckets: dict[str, list] = defaultdict(list)
    for r in rows:
        edge_pct = float(r["daily_picks"]["raw_edge"] or 0) * 100
        if   edge_pct < 7:  b = "5-7%"
        elif edge_pct < 9:  b = "7-9%"
        elif edge_pct < 11: b = "9-11%"
        else:               b = "11%+"
        buckets[b].append(r)

    bucket_order = ["5-7%", "7-9%", "9-11%", "11%+"]
    calibration  = []
    for b in bucket_order:
        br = buckets.get(b, [])
        if not br:
            continue
        wins     = sum(1 for r in br if r["result"] == "win")
        clv_vals = [float(r["clv"]) for r in br if r.get("clv") is not None]
        calibration.append({
            "edge_bucket":          b,
            "count":                len(br),
            "win_rate":             round(wins / len(br), 4),
            "avg_ensemble_prob":    round(sum(float(r["ensemble_prob_at_pick"]) for r in br) / len(br), 4),
            "avg_net_pnl_per_pick": round(sum(float(r["daily_picks"]["ev_per_100"] or 0) for r in br) / len(br), 2),
            "avg_clv":              round(sum(clv_vals) / len(clv_vals), 4) if clv_vals else None,
        })

    return {"buckets": calibration}
