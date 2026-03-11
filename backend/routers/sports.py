"""Sports predictions router — NBA + NHL live, other sports stubbed."""
import math
from datetime import datetime, date
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Query

_ET = ZoneInfo("America/New_York")

def _today() -> date:
    """Return today's date in US Eastern Time (all sports schedules run on ET)."""
    return datetime.now(_ET).date()

def _clean_rows(rows: list) -> list:
    """Replace NaN/Inf float values with 0 so FastAPI can JSON-serialize them."""
    float_keys = {"ev", "kelly", "edge", "kalshi_prob", "model_prob"}
    for r in rows:
        for k in float_keys:
            v = r.get(k)
            if isinstance(v, float) and not math.isfinite(v):
                r[k] = 0.0
    return rows

router = APIRouter()

SUPPORTED_SPORTS = {
    "nba":   {"label": "NBA",   "live": True},
    "nhl":   {"label": "NHL",   "live": True},
    "nfl":   {"label": "NFL",   "live": False},
    "ncaab": {"label": "NCAAB", "live": False},
    "mlb":   {"label": "MLB",   "live": False},
}


@router.get("/sports")
def list_sports():
    """Return all supported sports and their availability."""
    return {"sports": [{"id": k, **v} for k, v in SUPPORTED_SPORTS.items()]}


@router.get("/predictions")
def get_predictions(
    sport:  str   = Query(default="nba"),
    # ── Model blend ──────────────────────────────────────────
    w_xgb:  float = Query(default=1.0,  ge=0.0,  le=2.0),
    kelly_fraction: float = Query(default=1.0, ge=0.1, le=1.0),
    # ── HOMERUN thresholds ────────────────────────────────────
    homerun_edge:       float = Query(default=0.10, ge=0.01, le=0.30),
    homerun_model_prob: float = Query(default=0.65, ge=0.50, le=0.90),
    # ── UNDERVALUED threshold ─────────────────────────────────
    undervalued_edge: float = Query(default=0.05, ge=0.01, le=0.20),
    # ── UNDERDOG thresholds ───────────────────────────────────
    underdog_kalshi_ceiling: float = Query(default=0.38, ge=0.20, le=0.50),
    underdog_model_floor:    float = Query(default=0.48, ge=0.35, le=0.65),
    # ── SHARP band ────────────────────────────────────────────
    sharp_edge_min: float = Query(default=0.03, ge=0.01, le=0.10),
    sharp_edge_max: float = Query(default=0.05, ge=0.02, le=0.15),
):
    """Unified predictions endpoint. Returns live data for NBA, stub for others."""
    sport = sport.lower()
    if sport not in SUPPORTED_SPORTS:
        return {"error": f"Unknown sport: {sport}", "rows": [], "games": []}

    if not SUPPORTED_SPORTS[sport]["live"]:
        return {
            "sport":         sport,
            "games_count":   0,
            "markets_count": 0,
            "positive_ev":   0,
            "positive_edge": 0,
            "stats_loaded":  False,
            "coming_soon":   True,
            "games":         [],
            "rows":          [],
        }

    thresholds = {
        "HOMERUN":     {"edge": homerun_edge, "model_prob": homerun_model_prob},
        "UNDERVALUED": {"edge": undervalued_edge},
        "UNDERDOG":    {"kalshi_prob": underdog_kalshi_ceiling, "model_prob": underdog_model_floor},
        "SHARP":       {"edge_min": sharp_edge_min, "edge_max": sharp_edge_max},
    }

    # NBA live path
    if sport == "nba":
        from nba.fetch import fetch_games, fetch_kalshi_markets, fetch_nba_stats, load_schedule
        from nba.model import build_all_rows

        games       = fetch_games(_today())
        kalshi      = fetch_kalshi_markets()
        stats_df    = fetch_nba_stats()
        schedule_df = load_schedule()
        weights     = {"w_xgb": w_xgb}
        df   = build_all_rows(games, kalshi, stats_df, schedule_df, weights, thresholds, kelly_fraction)
        rows = _clean_rows(df.to_dict(orient="records") if not df.empty else [])

        return {
            "sport":         "nba",
            "games_count":   len(games),
            "markets_count": len(rows),
            "positive_ev":   sum(1 for r in rows if r.get("ev", 0) > 0),
            "positive_edge": sum(1 for r in rows if r.get("edge", 0) > 0),
            "stats_loaded":  stats_df is not None and not stats_df.empty,
            "coming_soon":   False,
            "games":         games,
            "rows":          rows,
        }

    # NHL live path
    if sport == "nhl":
        from nhl.fetch import fetch_kalshi_markets, fetch_games_for_markets, fetch_standings
        from nhl.model import build_all_rows

        kalshi     = fetch_kalshi_markets()
        games      = fetch_games_for_markets(kalshi)
        standings  = fetch_standings()
        df   = build_all_rows(games, kalshi, standings, {}, thresholds, kelly_fraction)
        rows = _clean_rows(df.to_dict(orient="records") if not df.empty else [])

        return {
            "sport":         "nhl",
            "games_count":   len(games),
            "markets_count": len(rows),
            "positive_ev":   sum(1 for r in rows if r.get("ev", 0) > 0),
            "positive_edge": sum(1 for r in rows if r.get("edge", 0) > 0),
            "stats_loaded":  standings is not None and not standings.empty,
            "coming_soon":   False,
            "games":         games,
            "rows":          rows,
        }

    # Fallback (should not reach here since live=True only for nba/nhl above)
    return {"sport": sport, "rows": [], "games": [], "coming_soon": True}
