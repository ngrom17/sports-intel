"""
XGBoost prediction engine — P(home_win), P(over/under), EV, Kelly Criterion.
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import xgboost as xgb

NBA_DIR   = Path(__file__).resolve().parent
MODEL_DIR = NBA_DIR / "Models" / "XGBoost_Models"
ACCURACY_PATTERN = re.compile(r"XGBoost_(\d+(?:\.\d+)?)%_")

from nba.config import ABBREV_TO_FULL, BET_THRESHOLDS

# ── Lazy model loading ────────────────────────────────────────────────────────
_xgb_ml = None
_xgb_uo = None

def _select_model_path(kind: str) -> Path:
    candidates = list(MODEL_DIR.glob(f"*{kind}*.json"))
    if not candidates:
        raise FileNotFoundError(f"No XGBoost {kind} model in {MODEL_DIR}")
    def score(p):
        m = ACCURACY_PATTERN.search(p.name)
        return (float(m.group(1)) if m else 0.0, p.stat().st_mtime)
    return max(candidates, key=score)

def _load_models():
    global _xgb_ml, _xgb_uo
    if _xgb_ml is None:
        _xgb_ml = xgb.Booster()
        _xgb_ml.load_model(str(_select_model_path("ML")))
    if _xgb_uo is None:
        _xgb_uo = xgb.Booster()
        _xgb_uo.load_model(str(_select_model_path("UO")))

def _predict_probs(model, data: np.ndarray) -> np.ndarray:
    raw = model.predict(xgb.DMatrix(data))
    if raw.ndim == 1:
        return np.column_stack([1.0 - raw, raw])
    return raw


# ── Kalshi helpers ────────────────────────────────────────────────────────────

def parse_kalshi_ticker(ticker: str) -> Optional[Dict]:
    ml = re.match(r"KXNBAGAME-\d{2}[A-Z]{3}\d{2}([A-Z]{2,3})([A-Z]{2,3})-[A-Z]{2,3}$", ticker)
    if ml:
        away, home = ml.groups()
        return {"market_type": "moneyline", "away_abbr": away, "home_abbr": home, "line": None}
    sp = re.match(r"KXNBASPREAD-\d{2}[A-Z]{3}\d{2}([A-Z]{2,3})([A-Z]{2,3})-[A-Z]{2,3}(\d+)$", ticker)
    if sp:
        away, home, n = sp.groups()
        return {"market_type": "spread", "away_abbr": away, "home_abbr": home, "line": float(n) + 0.5}
    tot = re.match(r"KXNBATOTAL-\d{2}[A-Z]{3}\d{2}([A-Z]{2,3})([A-Z]{2,3})-(\d+)$", ticker)
    if tot:
        away, home, n = tot.groups()
        return {"market_type": "total", "away_abbr": away, "home_abbr": home, "line": float(n) + 0.5}
    return None

def kalshi_mid_price(mkt: Dict) -> float:
    bid, ask, last = mkt.get("yes_bid", 0), mkt.get("yes_ask", 0), mkt.get("last_price", 0)
    if bid > 0 and ask > 0:
        return max(0.01, min(0.99, (bid + ask) / 2.0))
    if last > 0:
        return max(0.01, min(0.99, last))
    return 0.5

def prob_to_american(p: float) -> str:
    if p >= 0.99: return "-10000"
    if p <= 0.01: return "+10000"
    if p > 0.5:   return str(-round((p / (1 - p)) * 100))
    return f"+{round(((1 - p) / p) * 100)}"


# ── EV & Kelly ────────────────────────────────────────────────────────────────

def _american_to_decimal(o: float) -> float:
    if o >= 100: return round(1 + o / 100, 2)
    return round(1 + 100 / abs(o), 2)

def expected_value(p_win: float, american_odds: float) -> float:
    payout = american_odds if american_odds > 0 else (100 / abs(american_odds)) * 100
    return round(p_win * payout - (1 - p_win) * 100, 2)

def kelly_criterion(american_odds: float, p_win: float) -> float:
    decimal = _american_to_decimal(american_odds)
    return max(round(100 * (decimal * p_win - (1 - p_win)) / decimal, 2), 0.0)


# ── Bet classification ────────────────────────────────────────────────────────

def classify_bet(edge: float, model_prob: float, kalshi_prob: float,
                 market_type: str = "moneyline", thresholds: dict = None) -> str:
    t = thresholds or BET_THRESHOLDS
    if edge >= t["HOMERUN"]["edge"] and model_prob >= t["HOMERUN"]["model_prob"]:
        return "HOMERUN"
    if kalshi_prob <= t["UNDERDOG"]["kalshi_prob"] and model_prob >= t["UNDERDOG"]["model_prob"]:
        return "UNDERDOG"
    if edge >= t["UNDERVALUED"]["edge"]:
        return "UNDERVALUED"
    if t["SHARP"]["edge_min"] <= edge < t["SHARP"]["edge_max"]:
        return "SHARP"
    if edge < 0:
        return "FADE"
    return "LOW EDGE"


# ── Feature builder ───────────────────────────────────────────────────────────

def build_game_features(home_full, away_full, stats_df, schedule_df, today) -> Optional[pd.Series]:
    from nba.fetch import compute_rest_days
    home_rows = stats_df[stats_df["TEAM_NAME"] == home_full]
    away_rows = stats_df[stats_df["TEAM_NAME"] == away_full]
    if home_rows.empty or away_rows.empty:
        return None
    combined = pd.concat([home_rows.iloc[0], away_rows.iloc[0]])
    combined = combined.drop(labels=["TEAM_ID", "TEAM_NAME"], errors="ignore")
    combined["Days-Rest-Home"] = compute_rest_days(home_full, today, schedule_df)
    combined["Days-Rest-Away"] = compute_rest_days(away_full, today, schedule_df)
    return combined


# ── Master builder ────────────────────────────────────────────────────────────

def build_all_rows(games, kalshi_by_type, stats_df, schedule_df, weights,
                   thresholds: dict = None, kelly_fraction: float = 1.0) -> pd.DataFrame:
    _load_models()
    today = datetime.today()
    rows  = []

    for game in games:
        home_abbr  = game["home_abbr"]
        away_abbr  = game["away_abbr"]
        game_label = f"{away_abbr} @ {home_abbr}"
        home_full  = ABBREV_TO_FULL.get(home_abbr)
        away_full  = ABBREV_TO_FULL.get(away_abbr)

        features       = None
        home_prob_xgb  = 0.5
        away_prob_xgb  = 0.5
        stats_loaded   = stats_df is not None and not stats_df.empty and home_full and away_full

        if stats_loaded:
            feat = build_game_features(home_full, away_full, stats_df, schedule_df, today)
            if feat is not None:
                features = feat

        if features is not None:
            try:
                data = features.values.astype(float).reshape(1, -1)
                ml_probs      = _predict_probs(_xgb_ml, data)[0]
                away_prob_xgb = float(ml_probs[0])
                home_prob_xgb = float(ml_probs[1])
            except Exception:
                pass

        for market_type, markets in kalshi_by_type.items():
            for mkt in markets:
                parsed = parse_kalshi_ticker(mkt["ticker"])
                if not parsed:
                    continue
                if parsed["away_abbr"] != away_abbr or parsed["home_abbr"] != home_abbr:
                    continue

                kalshi_prob    = kalshi_mid_price(mkt)
                kalshi_american = int(prob_to_american(kalshi_prob).replace("+", ""))

                if market_type == "moneyline":
                    ticker_team = mkt["ticker"].split("-")[-1]
                    model_prob  = home_prob_xgb if ticker_team == parsed["home_abbr"] else away_prob_xgb
                elif market_type == "spread":
                    model_prob = kalshi_prob
                elif market_type == "total":
                    if features is not None and parsed["line"] is not None:
                        try:
                            frame = features.copy()
                            frame["OU"] = parsed["line"]
                            ou_probs   = _predict_probs(_xgb_uo, frame.values.astype(float).reshape(1, -1))[0]
                            model_prob = float(ou_probs[1])
                        except Exception:
                            model_prob = kalshi_prob
                    else:
                        model_prob = kalshi_prob
                else:
                    model_prob = kalshi_prob

                w_xgb      = weights.get("w_xgb", 1.0)
                model_prob = max(0.01, min(0.99, w_xgb * model_prob + (1 - w_xgb) * kalshi_prob))
                edge       = model_prob - kalshi_prob
                category   = classify_bet(edge, model_prob, kalshi_prob, market_type, thresholds)

                try:
                    ev    = expected_value(model_prob, kalshi_american)
                    kelly = kelly_criterion(kalshi_american, model_prob) * kelly_fraction
                except Exception:
                    ev = kelly = 0.0

                rows.append({
                    "game_id":       game["game_id"],
                    "game_label":    game_label,
                    "home_abbr":     home_abbr,
                    "away_abbr":     away_abbr,
                    "market_type":   market_type,
                    "ticker":        mkt["ticker"],
                    "title":         mkt["title"][:70],
                    "kalshi_prob":   round(kalshi_prob, 4),
                    "model_prob":    round(model_prob, 4),
                    "edge":          round(edge, 4),
                    "category":      category,
                    "american_odds": prob_to_american(kalshi_prob),
                    "ev":            ev,
                    "kelly":         kelly,
                    "volume":        mkt.get("volume", 0),
                    "stats_loaded":  stats_loaded,
                })

    return pd.DataFrame(rows) if rows else pd.DataFrame()
