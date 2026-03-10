"""
Data fetching layer — BallDontLie games (with live scores), Kalshi markets, NBA stats.
"""

import os
import sys
import time
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Dict, Optional

import pandas as pd
import requests

NBA_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(NBA_DIR.parent))

from nba.config import (
    KALSHI_API_BASE, BALLDONTLIE_API_BASE,
    NBA_STATS_URL, NBA_STATS_HEADERS, FULL_TO_ABBREV,
)

SCHEDULE_PATH = NBA_DIR / "Data" / "nba-2025-UTC.csv"

# ── Module-level TTL cache ────────────────────────────────────────────────────
_cache: dict = {}

def _cached(key: str, ttl: int, fn):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < ttl:
        return _cache[key]["data"]
    data = fn()
    _cache[key] = {"data": data, "ts": now}
    return data


# ── BallDontLie — games with live scores ─────────────────────────────────────

def fetch_games(game_date: date) -> List[Dict]:
    """
    Fetch NBA games for a given date. Includes live score data when available.
    Returns status: 'scheduled' | 'in_progress' | 'final'
    """
    try:
        api_key = os.environ.get("BALLDONTLIE_API_KEY", "")
        headers = {"Authorization": api_key} if api_key else {}
        resp = requests.get(
            f"{BALLDONTLIE_API_BASE}/games",
            params={"dates[]": game_date.isoformat()},
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()

        games = []
        for raw in resp.json().get("data", []):
            home = raw.get("home_team", {})
            away = raw.get("visitor_team", {})
            home_abbr = home.get("abbreviation", "")
            away_abbr = away.get("abbreviation", "")
            status_raw = raw.get("status", "")

            dt_str = raw.get("datetime") or raw.get("date", "")
            try:
                tipoff = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            except Exception:
                tipoff = datetime.utcnow()

            LIVE_STATUSES = {"In Progress", "1st Qtr", "2nd Qtr", "3rd Qtr", "4th Qtr", "Halftime", "OT"}
            if status_raw == "Final":
                game_status = "final"
            elif status_raw in LIVE_STATUSES:
                game_status = "in_progress"
            else:
                game_status = "scheduled"

            if home_abbr and away_abbr and game_status != "final":
                games.append({
                    "game_id":       raw.get("id", ""),
                    "home_abbr":     home_abbr,
                    "away_abbr":     away_abbr,
                    "home_name":     home.get("full_name", ""),
                    "away_name":     away.get("full_name", ""),
                    "tipoff_utc":    tipoff.isoformat(),
                    "status":        game_status,
                    # Live score fields (0 when not started)
                    "home_score":    raw.get("home_team_score") or 0,
                    "away_score":    raw.get("visitor_team_score") or 0,
                    "period":        raw.get("period") or 0,
                    "time_remaining": raw.get("time") or "",
                })
        return games

    except Exception:
        return []


# ── Kalshi markets ────────────────────────────────────────────────────────────

def fetch_kalshi_markets() -> Dict[str, List[Dict]]:
    results = {}
    for market_type, prefix in [
        ("moneyline", "KXNBAGAME"),
        ("spread",    "KXNBASPREAD"),
        ("total",     "KXNBATOTAL"),
    ]:
        try:
            api_key = os.environ.get("KALSHI_API_KEY", "")
            headers = {"Authorization": api_key} if api_key else {}
            resp = requests.get(
                f"{KALSHI_API_BASE}/markets",
                params={"status": "open", "series_ticker": prefix, "limit": 500},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            markets = []
            for mkt in resp.json().get("markets", []):
                yes_bid    = (mkt.get("yes_bid",    0) or 0) / 100.0
                yes_ask    = (mkt.get("yes_ask",    0) or 0) / 100.0
                last_price = (mkt.get("last_price", 0) or 0) / 100.0
                if yes_bid <= 0 and yes_ask <= 0 and last_price <= 0:
                    continue
                markets.append({
                    "ticker":       mkt.get("ticker", ""),
                    "title":        mkt.get("title", ""),
                    "event_ticker": mkt.get("event_ticker", ""),
                    "yes_bid":      yes_bid,
                    "yes_ask":      yes_ask,
                    "last_price":   last_price,
                    "volume":       mkt.get("volume", 0),
                })
            results[market_type] = markets
        except Exception:
            results[market_type] = []
    return results


# ── NBA stats (1-hour cache) ──────────────────────────────────────────────────

def _fetch_nba_stats_impl() -> Optional[pd.DataFrame]:
    now = datetime.now()
    yr = now.year if now.month >= 10 else now.year - 1
    season = f"{yr}-{str(yr + 1)[2:]}"
    url = NBA_STATS_URL.format(season=season)
    for attempt in range(3):
        try:
            time.sleep(1.0 + attempt)
            resp = requests.get(url, headers=NBA_STATS_HEADERS, timeout=20)
            resp.raise_for_status()
            result_sets = resp.json().get("resultSets", [])
            if not result_sets:
                continue
            rs = result_sets[0]
            return pd.DataFrame(data=rs["rowSet"], columns=rs["headers"])
        except Exception:
            if attempt == 2:
                return None
    return None

def fetch_nba_stats() -> Optional[pd.DataFrame]:
    return _cached("nba_stats", 3600, _fetch_nba_stats_impl)


# ── Schedule (24-hour cache) ──────────────────────────────────────────────────

def _load_schedule_impl() -> Optional[pd.DataFrame]:
    try:
        return pd.read_csv(SCHEDULE_PATH, parse_dates=["Date"], date_format="%d/%m/%Y %H:%M")
    except Exception:
        return None

def load_schedule() -> Optional[pd.DataFrame]:
    return _cached("schedule", 86400, _load_schedule_impl)


def compute_rest_days(team_full_name: str, today: datetime, schedule_df) -> int:
    if schedule_df is None:
        return 2
    try:
        games = schedule_df[
            (schedule_df["Home Team"] == team_full_name) |
            (schedule_df["Away Team"] == team_full_name)
        ]
        prev = games.loc[games["Date"] <= today].sort_values("Date", ascending=False).head(1)["Date"]
        if len(prev) > 0:
            return (timedelta(days=1) + today - prev.iloc[0]).days
        return 7
    except Exception:
        return 2
