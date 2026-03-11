"""
NHL data fetching — NHL Stats API (free, no auth) + Kalshi markets.

NHL API base: https://api-web.nhle.com/v1
  - /score/{YYYY-MM-DD}   → games with live scores
  - /standings/now        → current season standings (team stats)

No API key required for the NHL API.
"""

import os
import time
from datetime import date, datetime
from typing import Dict, List, Optional

import pandas as pd
import requests

from nhl.config import KALSHI_API_BASE, NHL_API_BASE, KALSHI_NHL_SERIES

# ── Module-level TTL cache ─────────────────────────────────────────────────
_cache: dict = {}

def _cached(key: str, ttl: int, fn):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < ttl:
        return _cache[key]["data"]
    data = fn()
    _cache[key] = {"data": data, "ts": now}
    return data


# ── NHL games ──────────────────────────────────────────────────────────────

def fetch_games(game_date: date) -> List[Dict]:
    """
    Fetch NHL games for a given date from the NHL Stats API.
    Returns status: 'scheduled' | 'in_progress' | 'final'
    """
    try:
        resp = requests.get(
            f"{NHL_API_BASE}/score/{game_date.isoformat()}",
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        games = []
        for raw in data.get("games", []):
            home = raw.get("homeTeam", {})
            away = raw.get("awayTeam", {})
            home_abbr = home.get("abbrev", "")
            away_abbr = away.get("abbrev", "")
            if not home_abbr or not away_abbr:
                continue

            state = raw.get("gameState", "FUT")
            if state in ("FINAL", "OFF"):
                game_status = "final"
            elif state in ("LIVE", "CRIT"):
                game_status = "in_progress"
            else:
                game_status = "scheduled"

            # Parse start time
            start_utc = raw.get("startTimeUTC", "")
            try:
                tipoff = datetime.fromisoformat(start_utc.replace("Z", "+00:00"))
            except Exception:
                tipoff = datetime.utcnow()

            games.append({
                "game_id":        raw.get("id", ""),
                "home_abbr":      home_abbr,
                "away_abbr":      away_abbr,
                "home_name":      home.get("name", {}).get("default", home_abbr),
                "away_name":      away.get("name", {}).get("default", away_abbr),
                "tipoff_utc":     tipoff.isoformat(),
                "status":         game_status,
                "home_score":     home.get("score", 0) or 0,
                "away_score":     away.get("score", 0) or 0,
                "period":         raw.get("period", 0) or 0,
                "time_remaining": raw.get("clock", {}).get("timeRemaining", "") if raw.get("clock") else "",
            })
        return games

    except Exception:
        return []


# ── NHL standings (1-hour cache) ───────────────────────────────────────────

def _fetch_standings_impl() -> Optional[pd.DataFrame]:
    """
    Fetch current season standings from NHL Stats API.
    Returns DataFrame with teamAbbrev, gamesPlayed, wins, losses, otLosses,
    points, pointPctg, goalFor, goalAgainst.
    """
    try:
        resp = requests.get(
            f"{NHL_API_BASE}/standings/now",
            timeout=15,
        )
        resp.raise_for_status()
        rows = []
        for team in resp.json().get("standings", []):
            rows.append({
                "teamAbbrev":  team.get("teamAbbrev", {}).get("default", ""),
                "gamesPlayed": team.get("gamesPlayed", 0),
                "wins":        team.get("wins", 0),
                "losses":      team.get("losses", 0),
                "otLosses":    team.get("otLosses", 0),
                "points":      team.get("points", 0),
                "pointPctg":   team.get("pointPctg", 0.5),
                "goalFor":     team.get("goalFor", 0),
                "goalAgainst": team.get("goalAgainst", 0),
            })
        return pd.DataFrame(rows) if rows else None
    except Exception:
        return None

def fetch_standings() -> Optional[pd.DataFrame]:
    return _cached("nhl_standings", 3600, _fetch_standings_impl)


# ── Kalshi NHL markets ─────────────────────────────────────────────────────

def fetch_kalshi_markets() -> Dict[str, List[Dict]]:
    """
    Fetch open Kalshi NHL markets for each configured series.
    Returns dict keyed by market_type: {"moneyline": [...], "total": [...]}
    """
    results = {}
    api_key = os.environ.get("KALSHI_API_KEY", "")
    headers = {"Authorization": api_key} if api_key else {}

    for market_type, series_ticker in KALSHI_NHL_SERIES.items():
        try:
            resp = requests.get(
                f"{KALSHI_API_BASE}/markets",
                params={"status": "open", "series_ticker": series_ticker, "limit": 500},
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
