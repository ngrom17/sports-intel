"""
NHL data fetching — NHL Stats API (free, no auth) + Kalshi markets.

NHL API base: https://api-web.nhle.com/v1
  - /score/{YYYY-MM-DD}   → games with live scores
  - /standings/now        → current season standings (team stats)

No API key required for the NHL API.
"""

import os
import re
import time
from datetime import date, datetime
from typing import Dict, List, Optional, Set

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


# ── Kalshi date extraction ─────────────────────────────────────────────────

_DATE_RE = re.compile(r"KXNHL\w+-(\d{2})([A-Z]{3})(\d{2})", re.IGNORECASE)
_MONTHS  = {m: i for i, m in enumerate(
    ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"], start=1
)}

def _extract_market_date(ticker: str) -> Optional[date]:
    """Parse game date from a Kalshi NHL ticker like KXNHLGAME-26MAR12NSHVAN-VAN."""
    m = _DATE_RE.match(ticker)
    if not m:
        return None
    yr, mon_str, day = int(m.group(1)), m.group(2).upper(), int(m.group(3))
    month = _MONTHS.get(mon_str)
    if not month:
        return None
    try:
        return date(2000 + yr, month, day)
    except ValueError:
        return None


def dates_in_markets(kalshi_by_type: Dict[str, List[Dict]]) -> Set[date]:
    """Return the set of game dates found across all open Kalshi markets."""
    dates: Set[date] = set()
    for markets in kalshi_by_type.values():
        for mkt in markets:
            d = _extract_market_date(mkt.get("ticker", ""))
            if d:
                dates.add(d)
    return dates


# ── NHL games ──────────────────────────────────────────────────────────────

def fetch_games(game_date: date) -> List[Dict]:
    """
    Fetch NHL games for a given date from the NHL Stats API.
    Returns status: 'scheduled' | 'in_progress' | 'final'
    """
    try:
        resp = requests.get(
            f"{NHL_API_BASE}/score/{game_date.isoformat()}",
            timeout=8,
            allow_redirects=True,
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


def fetch_games_for_markets(kalshi_by_type: Dict[str, List[Dict]]) -> List[Dict]:
    """
    Fetch NHL games for every date that has open Kalshi markets, in parallel.
    Always includes today (ET) so live games show alongside upcoming markets.
    Returns a merged, deduplicated list sorted by tipoff time.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from zoneinfo import ZoneInfo
    from datetime import datetime as _dt

    et_today = _dt.now(ZoneInfo("America/New_York")).date()
    market_dates = dates_in_markets(kalshi_by_type)
    fetch_dates  = market_dates | {et_today}

    results: List[Dict] = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(fetch_games, d): d for d in fetch_dates}
        for fut in as_completed(futures, timeout=12):
            try:
                results.extend(fut.result())
            except Exception:
                pass

    # Deduplicate by game_id
    seen: set = set()
    unique: List[Dict] = []
    for g in results:
        gid = g["game_id"]
        if gid not in seen:
            seen.add(gid)
            unique.append(g)

    unique.sort(key=lambda g: g.get("tipoff_utc", ""))
    return unique


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
            allow_redirects=True,
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
