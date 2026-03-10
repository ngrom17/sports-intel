"""
Deterministic ticker parsers for settlement logic.

Ticker formats (NBA examples, pattern holds for other sports):
  Moneyline: KXNBAGAME-26MAR10MEMPHI-PHI       → YES = PHI wins
  Spread:    KXNBASPREAD-26MAR10MEMPHI-MEM12    → YES = MEM wins by >12.5
  Total:     KXNBATOTAL-26MAR10MEMPHI-244       → YES = total >244
"""
import re


def parse_moneyline(ticker: str) -> str:
    """Return the winning team abbreviation for a moneyline YES contract."""
    return ticker.split("-")[-1]   # "PHI"


def parse_spread(ticker: str) -> tuple[str, float]:
    """
    Return (team_abbr, line) for a spread YES contract.
    YES = team wins by strictly more than line (line already has .5 added).
    """
    last = ticker.split("-")[-1]   # "MEM12"
    team = re.match(r"[A-Z]+", last).group()
    raw  = re.search(r"\d+", last).group()
    line = float(raw) + 0.5        # half-point to avoid push
    return team, line


def parse_total(ticker: str) -> float:
    """
    Return the total-points threshold for a total YES contract.
    YES = home_score + away_score > threshold.
    """
    last = ticker.split("-")[-1]   # "244"
    return float(last)


def determine_result(
    market_type: str,
    ticker: str,
    home_abbr: str,
    away_abbr: str,
    home_score: int,
    away_score: int,
    american_odds: str,
    stake: float,
) -> tuple[str, float]:
    """
    Returns (result, payout) for a YES-side bet on this contract.

    result: 'win' | 'loss' | 'push' | 'void'
    payout: dollars returned (including stake on win, 0 on loss)
    """
    def american_to_decimal(odds_str: str) -> float:
        try:
            n = int(odds_str.replace("+", ""))
            return (1 + n / 100) if n > 0 else (1 + 100 / abs(n))
        except Exception:
            return 1.91   # default ~-110

    dec = american_to_decimal(american_odds or "")

    if market_type == "moneyline":
        winner = parse_moneyline(ticker)
        if home_score == away_score:
            return "push", stake
        home_won = home_score > away_score
        team_won = (winner == home_abbr and home_won) or (winner == away_abbr and not home_won)
        if team_won:
            return "win", round(stake * dec, 2)
        return "loss", 0.0

    elif market_type == "spread":
        team, line = parse_spread(ticker)
        margin = (home_score - away_score) if team == home_abbr else (away_score - home_score)
        if margin == line:
            return "push", stake
        if margin > line:
            return "win", round(stake * dec, 2)
        return "loss", 0.0

    elif market_type == "total":
        threshold = parse_total(ticker)
        total = home_score + away_score
        if total == threshold:
            return "push", stake
        if total > threshold:
            return "win", round(stake * dec, 2)
        return "loss", 0.0

    return "void", stake
