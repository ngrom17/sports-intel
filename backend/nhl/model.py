"""
NHL win probability model — Bradley-Terry strength-based.

No XGBoost required. Win probability is derived from:
  - NHL standings (pointPctg, goal differential rate)
  - Home ice advantage multiplier (1.15)
  - Kalshi implied probability

Edge and EV are computed exactly as NBA:
  edge  = model_prob - kalshi_prob
  ev    = model_prob * payout - (1 - model_prob) * 100  [per $100 bet]
  kelly = edge / (payout / 100)
"""
import re
from typing import Dict, List, Optional

import pandas as pd

from nhl.config import HOME_ICE_ADVANTAGE, BET_THRESHOLDS


# ── Strength model ──────────────────────────────────────────────────────────

def team_strength(standings: pd.DataFrame, abbr: str) -> float:
    """
    Composite team strength in [0, 1].
    Blends pointPctg (70%) + goal differential rate (30%).
    Falls back to 0.5 if team not in standings.
    """
    if standings is None or standings.empty:
        return 0.5

    row = standings[standings["teamAbbrev"] == abbr]
    if row.empty:
        return 0.5

    r = row.iloc[0]
    pp      = float(r.get("pointPctg", 0.5))
    gp      = int(r.get("gamesPlayed", 1)) or 1
    gf      = float(r.get("goalFor", 0))
    ga      = float(r.get("goalAgainst", 1)) or 1.0
    gd_rate = gf / (gf + ga) if (gf + ga) > 0 else 0.5

    return 0.70 * pp + 0.30 * gd_rate


def win_probability(
    home_abbr: str,
    away_abbr: str,
    standings: Optional[pd.DataFrame],
) -> float:
    """
    Bradley-Terry P(home wins) with home ice advantage.
    P = (s_home * HIA) / (s_home * HIA + s_away)
    Clipped to [0.10, 0.90] to avoid degenerate odds.
    """
    s_home = team_strength(standings, home_abbr)
    s_away = team_strength(standings, away_abbr)

    numerator = s_home * HOME_ICE_ADVANTAGE
    denominator = numerator + s_away
    if denominator == 0:
        return 0.5

    prob = numerator / denominator
    return max(0.10, min(0.90, prob))


# ── Ticker parser ────────────────────────────────────────────────────────────

# Example tickers:
#   KXNHLGAME-25MAR10-BOS-TBL-Y   (home team wins)
#   KXNHLTOTAL-25MAR10-BOS-TBL-O5 (over 5 goals)
_MONEYLINE_RE = re.compile(
    r"KXNHLGAME-\d{2}\w{3}\d{2}-([A-Z]+)-([A-Z]+)-([YN])$",
    re.IGNORECASE,
)
_TOTAL_RE = re.compile(
    r"KXNHLTOTAL-\d{2}\w{3}\d{2}-([A-Z]+)-([A-Z]+)-([OUou]\d+\.?\d*)$",
    re.IGNORECASE,
)


def parse_kalshi_ticker_nhl(ticker: str) -> Optional[Dict]:
    """
    Parse an NHL Kalshi ticker into structured metadata.

    Moneyline (Y = YES, home team wins):
      {"market_type": "moneyline", "home_abbr": "BOS", "away_abbr": "TBL", "side": "home"}

    Moneyline (N = YES, away team wins):
      {"market_type": "moneyline", "home_abbr": "BOS", "away_abbr": "TBL", "side": "away"}

    Total (O = over, U = under):
      {"market_type": "total", "home_abbr": "BOS", "away_abbr": "TBL",
       "side": "over", "line": 5.0}

    Returns None if ticker doesn't match a known pattern.
    """
    m = _MONEYLINE_RE.match(ticker)
    if m:
        home, away, yn = m.group(1).upper(), m.group(2).upper(), m.group(3).upper()
        return {
            "market_type": "moneyline",
            "home_abbr":   home,
            "away_abbr":   away,
            "side":        "home" if yn == "Y" else "away",
        }

    m = _TOTAL_RE.match(ticker)
    if m:
        home, away, ou_str = m.group(1).upper(), m.group(2).upper(), m.group(3)
        side = "over" if ou_str[0].upper() == "O" else "under"
        line_str = ou_str[1:] or "0"
        try:
            line = float(line_str)
        except ValueError:
            line = 0.0
        return {
            "market_type": "total",
            "home_abbr":   home,
            "away_abbr":   away,
            "side":        side,
            "line":        line,
        }

    return None


# ── EV / Kelly / Category ────────────────────────────────────────────────────

def _american_odds(prob: float) -> str:
    """Convert win probability to American odds string."""
    prob = max(0.001, min(0.999, prob))
    if prob >= 0.5:
        odds = -round(prob / (1 - prob) * 100)
    else:
        odds = round((1 - prob) / prob * 100)
    return f"+{odds}" if odds > 0 else str(odds)


def _categorize(edge: float, model_prob: float, kalshi_prob: float, t: dict) -> str:
    if (edge >= t["HOMERUN"]["edge"] and model_prob >= t["HOMERUN"]["model_prob"]):
        return "HOMERUN"
    if edge >= t["UNDERVALUED"]["edge"]:
        return "UNDERVALUED"
    if (kalshi_prob <= t["UNDERDOG"]["kalshi_prob"] and model_prob >= t["UNDERDOG"]["model_prob"]):
        return "UNDERDOG"
    if t["SHARP"]["edge_min"] <= edge < t["SHARP"]["edge_max"]:
        return "SHARP"
    if edge > 0:
        return "LOW EDGE"
    return "FADE"


# ── Main builder ─────────────────────────────────────────────────────────────

def build_all_rows(
    games: List[Dict],
    kalshi_by_type: Dict[str, List[Dict]],
    standings: Optional[pd.DataFrame],
    weights: Dict = None,           # reserved — not used yet for NHL
    thresholds: Dict = None,
    kelly_fraction: float = 1.0,
) -> pd.DataFrame:
    """
    Build one prediction row per Kalshi market contract.

    Args:
        games:          list from nhl.fetch.fetch_games()
        kalshi_by_type: dict from nhl.fetch.fetch_kalshi_markets()
        standings:      DataFrame from nhl.fetch.fetch_standings()
        weights:        reserved for future ensemble blend
        thresholds:     override BET_THRESHOLDS (optional)
        kelly_fraction: Kelly scaling factor [0.1, 1.0]

    Returns:
        DataFrame with one row per Kalshi contract, same schema as NBA.
    """
    t = thresholds or BET_THRESHOLDS

    # Build game lookup by (home_abbr, away_abbr) → game dict
    game_lookup: Dict[tuple, Dict] = {}
    for g in games:
        game_lookup[(g["home_abbr"], g["away_abbr"])] = g

    rows = []
    for market_type, markets in kalshi_by_type.items():
        for mkt in markets:
            ticker = mkt.get("ticker", "")
            parsed = parse_kalshi_ticker_nhl(ticker)
            if not parsed:
                continue

            home_abbr = parsed["home_abbr"]
            away_abbr = parsed["away_abbr"]
            side      = parsed["side"]          # "home" | "away" | "over" | "under"

            # Match to today's game (or skip if game not found — stale market)
            game = game_lookup.get((home_abbr, away_abbr))
            if not game:
                continue

            yes_bid  = mkt.get("yes_bid",    0)
            yes_ask  = mkt.get("yes_ask",    0)
            last     = mkt.get("last_price", 0)

            # Kalshi mid-price as implied probability
            if yes_bid > 0 and yes_ask > 0:
                kalshi_prob = (yes_bid + yes_ask) / 2
            elif yes_bid > 0:
                kalshi_prob = yes_bid
            elif yes_ask > 0:
                kalshi_prob = yes_ask
            else:
                kalshi_prob = last

            if kalshi_prob <= 0:
                continue

            # ── Model probability ──────────────────────────────────────────
            if market_type == "moneyline":
                home_win_prob = win_probability(home_abbr, away_abbr, standings)
                if side == "home":
                    model_prob = home_win_prob
                else:
                    model_prob = 1.0 - home_win_prob

            elif market_type == "total":
                # No total model yet — use Kalshi as model (zero edge)
                model_prob = kalshi_prob

            else:
                model_prob = kalshi_prob

            # ── Edge / EV / Kelly ─────────────────────────────────────────
            # YES contract: payout = (1/kalshi_prob - 1) * $100 net
            payout = (1.0 / kalshi_prob - 1.0) * 100.0
            edge   = model_prob - kalshi_prob
            ev     = model_prob * payout - (1.0 - model_prob) * 100.0

            # Full Kelly: f = edge / (payout / 100)
            raw_kelly = edge / (payout / 100.0) if payout > 0 else 0.0
            kelly     = max(0.0, raw_kelly * kelly_fraction)

            category = _categorize(edge, model_prob, kalshi_prob, t)

            game_label = f"{away_abbr} @ {home_abbr}"
            rows.append({
                "game_id":      game["game_id"],
                "game_label":   game_label,
                "home_abbr":    home_abbr,
                "away_abbr":    away_abbr,
                "market_type":  market_type,
                "ticker":       ticker,
                "title":        mkt.get("title", ""),
                "kalshi_prob":  round(kalshi_prob, 4),
                "model_prob":   round(model_prob, 4),
                "edge":         round(edge, 4),
                "category":     category,
                "american_odds": _american_odds(kalshi_prob),
                "ev":           round(ev, 2),
                "kelly":        round(kelly, 4),
                "volume":       mkt.get("volume", 0),
                "stats_loaded": standings is not None and not standings.empty,
                # Extra context
                "side":         side,
                "line":         parsed.get("line"),
                "status":       game.get("status", ""),
                "tipoff_utc":   game.get("tipoff_utc", ""),
            })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df.sort_values("ev", ascending=False, inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df
