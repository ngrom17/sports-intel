export interface Settlement {
  id:                    string;
  result:                "win" | "loss" | "push" | "void";
  payout:                number;
  net_pnl:               number;
  clv:                   number | null;
  closing_prob:          number | null;
  ensemble_prob_at_pick: number;
  settled_at:            string;
}

export interface Pick {
  id:             string;
  sport:          string;
  pick_date:      string;
  selected_rank:  number;
  game_label:     string;
  ticker:         string;
  title:          string;
  market_type:    string;
  category:       string;
  raw_edge:       number;
  ev_per_100:     number;
  kelly_fraction: number | null;
  american_odds:  string;
  ensemble_prob:  number;
  kalshi_prob:    number;
  stake_amount:   number;
  model_version:  string;
  settlements:    Settlement[] | null;
}

export interface EquityPoint {
  date:       string;
  daily_pnl:  number;
  cumulative: number;
}

export interface CategorySlice {
  picks:   number;
  wins:    number;
  net_pnl: number;
}

export interface PnLResponse {
  total_picks:      number;
  wins:             number;
  losses:           number;
  pushes:           number;
  win_rate:         number | null;
  net_pnl:          number;
  total_staked:     number;
  roi:              number | null;
  avg_clv:          number | null;
  pct_positive_clv: number | null;
  equity_curve:     EquityPoint[];
  by_category:      Record<string, CategorySlice>;
  by_market_type:   Record<string, CategorySlice>;
}

export interface CalibrationBucket {
  edge_bucket:          string;
  count:                number;
  win_rate:             number;
  avg_ensemble_prob:    number;
  avg_net_pnl_per_pick: number;
  avg_clv:              number | null;
}

export interface CalibrationResponse {
  buckets: CalibrationBucket[];
  note?:   string;
}
