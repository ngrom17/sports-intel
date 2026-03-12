export interface ModelSettings {
  wXgb:                  number;  // 0.0–2.0  — XGBoost vs Kalshi blend
  kellyFraction:         number;  // 0.1–1.0  — fraction of full Kelly
  homerunEdge:           number;  // 0.01–0.30 — min edge for HOMERUN
  homerunModelProb:      number;  // 0.50–0.90 — min model prob for HOMERUN
  undervaluedEdge:       number;  // 0.01–0.20 — min edge for UNDERVALUED
  underdogKalshiCeiling: number;  // 0.20–0.50 — max market prob for UNDERDOG
  underdogModelFloor:    number;  // 0.35–0.65 — min model prob for UNDERDOG
  sharpEdgeMin:          number;  // 0.01–0.10 — SHARP band floor
  sharpEdgeMax:          number;  // 0.02–0.15 — SHARP band ceiling
}

export const DEFAULT_SETTINGS: ModelSettings = {
  wXgb:                  1.0,
  kellyFraction:         1.0,
  homerunEdge:           0.10,
  homerunModelProb:      0.65,
  undervaluedEdge:       0.05,
  underdogKalshiCeiling: 0.38,
  underdogModelFloor:    0.48,
  sharpEdgeMin:          0.03,
  sharpEdgeMax:          0.05,
};

export interface SportMeta {
  id:    string;
  label: string;
  live:  boolean;
}

export interface GameInfo {
  game_id:       number;
  home_abbr:     string;
  away_abbr:     string;
  home_name:     string;
  away_name:     string;
  tipoff_utc:    string;
  status:        "scheduled" | "in_progress" | "final";
  home_score:    number;
  away_score:    number;
  period:        number;
  time_remaining: string;
}

export interface PredictionRow {
  game_id:       number;
  game_label:    string;
  home_abbr:     string;
  away_abbr:     string;
  market_type:   "moneyline" | "spread" | "total";
  ticker:        string;
  title:         string;
  kalshi_prob:   number;
  model_prob:    number;
  edge:          number;
  category:      "HOMERUN" | "UNDERVALUED" | "UNDERDOG" | "SHARP" | "FADE" | "LOW EDGE";
  american_odds: string;
  ev:            number;
  kelly:         number;
  volume:        number;
  stats_loaded:  boolean;
  line:          number | null;
  side:          "over" | "under" | null;
  winner_abbr:   string | null;
}

export interface PredictionsResponse {
  sport:         string;
  games_count:   number;
  markets_count: number;
  positive_ev:   number;
  positive_edge: number;
  stats_loaded:  boolean;
  coming_soon:   boolean;
  games:         GameInfo[];
  rows:          PredictionRow[];
}
