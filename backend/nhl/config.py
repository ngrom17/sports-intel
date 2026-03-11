"""NHL configuration — API endpoints, team maps, thresholds."""

KALSHI_API_BASE = "https://api.elections.kalshi.com/trade-api/v2"
NHL_API_BASE    = "https://api-web.nhle.com/v1"

# Kalshi series tickers for NHL markets.
# Update these if Kalshi changes their naming scheme.
KALSHI_NHL_SERIES = {
    "moneyline": "KXNHLGAME",
    "total":     "KXNHLTOTAL",
    # puck line (+/- 1.5) if Kalshi offers it:
    # "spread": "KXNHLPUCK",
}

# Home ice advantage factor (NHL home teams win ~54% historically)
HOME_ICE_ADVANTAGE = 1.15

# Bet classification thresholds — slightly tighter than NBA
# (hockey markets are thinner and more efficient)
BET_THRESHOLDS = {
    "HOMERUN":     {"edge": 0.08,  "model_prob": 0.60},
    "UNDERVALUED": {"edge": 0.04},
    "UNDERDOG":    {"kalshi_prob": 0.38, "model_prob": 0.45},
    "SHARP":       {"edge_min": 0.02,   "edge_max":  0.04},
}

# All 32 NHL teams (NHL API canonical abbreviations)
NHL_TEAMS = {
    "ANA": "Anaheim Ducks",
    "BOS": "Boston Bruins",
    "BUF": "Buffalo Sabres",
    "CGY": "Calgary Flames",
    "CAR": "Carolina Hurricanes",
    "CHI": "Chicago Blackhawks",
    "COL": "Colorado Avalanche",
    "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars",
    "DET": "Detroit Red Wings",
    "EDM": "Edmonton Oilers",
    "FLA": "Florida Panthers",
    "LAK": "Los Angeles Kings",
    "MIN": "Minnesota Wild",
    "MTL": "Montreal Canadiens",
    "NSH": "Nashville Predators",
    "NJD": "New Jersey Devils",
    "NYI": "New York Islanders",
    "NYR": "New York Rangers",
    "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers",
    "PIT": "Pittsburgh Penguins",
    "SEA": "Seattle Kraken",
    "SJS": "San Jose Sharks",
    "STL": "St. Louis Blues",
    "TBL": "Tampa Bay Lightning",
    "TOR": "Toronto Maple Leafs",
    "UTA": "Utah Hockey Club",
    "VAN": "Vancouver Canucks",
    "VGK": "Vegas Golden Knights",
    "WSH": "Washington Capitals",
    "WPG": "Winnipeg Jets",
}
