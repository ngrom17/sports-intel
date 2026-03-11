"""
NHL win probability model — Bradley-Terry strength-based.

No XGBoost required. Win probability derived from:
  - NHL standings (pointPctg + goal differential rate)
  - Home ice advantage multiplier (1.15)
  - Kalshi implied probability

Kalshi ticker format (actual, discovered empirically):
  KXNHLGAME-26MAR13EDMSTL-STL   (St. Louis wins)
  KXNHLGAME-26MAR13LANYI-LA     (Los Angeles wins — uses "LA" not "LAK")
  Title: "Edmonton at St. Louis Winner?"

Matching strategy: parse title → away/home team name phrases → match NHL API names.
Winner key is the Kalshi short abbreviation — matched via startswith on NHL abbr.
"""
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from nhl.config import HOME_ICE_ADVANTAGE, BET_THRESHOLDS


# ── Strength model ──────────────────────────────────────────────────────────

def team_strength(standings: pd.DataFrame, abbr: str) -> float:
    """
    Composite team strength [0, 1].
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
    Clipped to [0.10, 0.90].
    """
    s_home = team_strength(standings, home_abbr)
    s_away = team_strength(standings, away_abbr)

    numerator   = s_home * HOME_ICE_ADVANTAGE
    denominator = numerator + s_away
    if denominator == 0:
        return 0.5

    prob = numerator / denominator
    return max(0.10, min(0.90, prob))


# ── Kalshi market → game matcher ─────────────────────────────────────────────

# Kalshi moneyline title format: "X at Y Winner?"
_TITLE_RE = re.compile(r"^(.+?)\s+at\s+(.+?)\s+Winner\?$", re.IGNORECASE)


def _parse_title(title: str) -> Optional[Tuple[str, str]]:
    """
    Extract (away_phrase, home_phrase) from "X at Y Winner?".
    Returns None if title doesn't match.
    """
    m = _TITLE_RE.match(title.strip())
    if not m:
        return None
    return m.group(1).strip(), m.group(2).strip()


def _name_matches(phrase: str, full_name: str) -> bool:
    """
    Check if a Kalshi short team phrase matches an NHL full team name.
    Kalshi often truncates: "New York I" matches "New York Islanders",
    "New York R" matches "New York Rangers", "Los Angeles" matches "Los Angeles Kings".

    Strategy: the full name must start with the phrase, or the phrase is contained
    within the full name, using case-insensitive comparison.
    """
    phrase_l = phrase.lower().strip()
    name_l   = full_name.lower().strip()
    return name_l.startswith(phrase_l) or phrase_l in name_l


def _match_game(
    away_phrase: str,
    home_phrase: str,
    games: List[Dict],
) -> Optional[Dict]:
    """
    Find the NHL API game whose away/home team names match the given phrases.
    Returns the game dict or None.
    """
    for g in games:
        away_name = g.get("away_name", "")
        home_name = g.get("home_name", "")
        if _name_matches(away_phrase, away_name) and _name_matches(home_phrase, home_name):
            return g
    return None


def _resolve_side(winner_key: str, home_abbr: str, away_abbr: str) -> str:
    """
    Determine if winner_key refers to the home or away team.

    Kalshi uses shortened abbreviations: "LA" for "LAK", "SJ" for "SJS".
    Strategy: check if NHL abbr starts with the winner_key (or exact match).
    Since only 2 teams play, if it doesn't match home, it must be away.
    """
    wk = winner_key.upper()
    if home_abbr.upper().startswith(wk) or wk == home_abbr.upper():
        return "home"
    return "away"


# ── EV / Kelly / Category ────────────────────────────────────────────────────

def _american_odds(prob: float) -> str:
    prob = max(0.001, min(0.999, prob))
    if prob >= 0.5:
        odds = -round(prob / (1 - prob) * 100)
    else:
        odds = round((1 - prob) / prob * 100)
    return f"+{odds}" if odds > 0 else str(odds)


def _categorize(edge: float, model_prob: float, kalshi_prob: float, t: dict) -> str:
    if edge >= t["HOMERUN"]["edge"] and model_prob >= t["HOMERUN"]["model_prob"]:
        return "HOMERUN"
    if edge >= t["UNDERVALUED"]["edge"]:
        return "UNDERVALUED"
    if kalshi_prob <= t["UNDERDOG"]["kalshi_prob"] and model_prob >= t["UNDERDOG"]["model_prob"]:
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
    weights: Dict = None,
    thresholds: Dict = None,
    kelly_fraction: float = 1.0,
) -> pd.DataFrame:
    """
    Build one prediction row per Kalshi market contract.

    Matches Kalshi markets to NHL API games via title parsing ("X at Y Winner?"),
    then computes Bradley-Terry win probability, edge, EV, and Kelly fraction.

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
    stats_available = standings is not None and not standings.empty

    rows = []
    for market_type, markets in kalshi_by_type.items():
        for mkt in markets:
            ticker = mkt.get("ticker", "")
            title  = mkt.get("title", "")

            # ── Identify home/away from title ─────────────────────────────
            if market_type == "moneyline":
                parsed = _parse_title(title)
                if not parsed:
                    continue
                away_phrase, home_phrase = parsed

                # Match to a game from NHL API
                game = _match_game(away_phrase, home_phrase, games)
                if not game:
                    continue

                home_abbr = game["home_abbr"]
                away_abbr = game["away_abbr"]

                # Resolve which side this contract covers
                winner_key = ticker.rsplit("-", 1)[-1]   # last dash-separated segment
                side       = _resolve_side(winner_key, home_abbr, away_abbr)

            elif market_type == "total":
                # Totals: parse title "X at Y Over/Under N Goals?"
                # For now treat as zero-edge (no total model yet)
                parsed = _parse_title(title.replace("Over/Under", "at").replace("Goals?", "Winner?"))
                if not parsed:
                    continue
                game = _match_game(parsed[0], parsed[1], games)
                if not game:
                    continue
                home_abbr  = game["home_abbr"]
                away_abbr  = game["away_abbr"]
                side       = "over"  # placeholder

            else:
                continue

            # ── Kalshi mid-price → implied probability ────────────────────
            yes_bid  = float(mkt.get("yes_bid",    0) or 0)
            yes_ask  = float(mkt.get("yes_ask",    0) or 0)
            last     = float(mkt.get("last_price", 0) or 0)

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

            # ── Model probability ─────────────────────────────────────────
            if market_type == "moneyline":
                home_win_prob = win_probability(home_abbr, away_abbr, standings)
                model_prob    = home_win_prob if side == "home" else (1.0 - home_win_prob)
            else:
                # No total model — zero edge
                model_prob = kalshi_prob

            # ── Edge / EV / Kelly ─────────────────────────────────────────
            payout    = (1.0 / kalshi_prob - 1.0) * 100.0
            edge      = model_prob - kalshi_prob
            ev        = model_prob * payout - (1.0 - model_prob) * 100.0
            raw_kelly = edge / (payout / 100.0) if payout > 0 else 0.0
            kelly     = max(0.0, raw_kelly * kelly_fraction)

            category  = _categorize(edge, model_prob, kalshi_prob, t)
            game_label = f"{away_abbr} @ {home_abbr}"

            rows.append({
                "game_id":       game["game_id"],
                "game_label":    game_label,
                "home_abbr":     home_abbr,
                "away_abbr":     away_abbr,
                "market_type":   market_type,
                "ticker":        ticker,
                "title":         title,
                "kalshi_prob":   round(kalshi_prob, 4),
                "model_prob":    round(model_prob, 4),
                "edge":          round(edge, 4),
                "category":      category,
                "american_odds": _american_odds(kalshi_prob),
                "ev":            round(ev, 2),
                "kelly":         round(kelly, 4),
                "volume":        mkt.get("volume", 0),
                "stats_loaded":  stats_available,
                "side":          side,
                "line":          None,
                "status":        game.get("status", ""),
                "tipoff_utc":    game.get("tipoff_utc", ""),
            })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df.sort_values("ev", ascending=False, inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df
