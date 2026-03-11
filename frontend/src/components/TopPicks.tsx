import type { PredictionRow } from "@/types/sports";
import CategoryBadge from "./CategoryBadge";

const TOP_CATS = new Set(["HOMERUN", "UNDERVALUED", "UNDERDOG"]);

function pct(v: number)  { return `${(v * 100).toFixed(1)}%`; }
function evFmt(v: number) { return `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`; }

export default function TopPicks({ rows }: { rows: PredictionRow[] }) {
  const picks = rows
    .filter((r) => TOP_CATS.has(r.category))
    .sort((a, b) => b.ev - a.ev)
    .slice(0, 6);

  if (picks.length === 0) return null;

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Top Picks</span>
        <span className="section-count">{picks.length}</span>
      </div>
      <div className="picks-grid">
        {picks.map((r) => (
          <div key={r.ticker} className="pick-card">
            <div className="pick-card-top">
              <CategoryBadge category={r.category} />
              <span className="pick-card-game">{r.game_label}</span>
            </div>
            <div className="pick-card-contract">
              {r.market_type === "total" && r.line != null ? `Over ${r.line}` : r.title}
            </div>
            <div className="pick-card-metrics">
              <div className="pick-metric">
                <span className="pick-metric-label">Edge</span>
                <span className={`pick-metric-value ${r.edge > 0 ? "positive" : "negative"}`}>
                  {r.edge > 0 ? "+" : ""}{pct(r.edge)}
                </span>
              </div>
              <div className="pick-metric">
                <span className="pick-metric-label">EV</span>
                <span className={`pick-metric-value ${r.ev > 0 ? "positive" : "negative"}`}>
                  {evFmt(r.ev)}
                </span>
              </div>
              <div className="pick-metric">
                <span className="pick-metric-label">Kelly</span>
                <span className="pick-metric-value">{r.kelly.toFixed(1)}%</span>
              </div>
              <div className="pick-metric">
                <span className="pick-metric-label">Odds</span>
                <span className="pick-metric-value">
                  {!r.american_odds.startsWith("-") && !r.american_odds.startsWith("+") ? "+" : ""}{r.american_odds}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
