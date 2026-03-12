import type { PredictionRow } from "@/types/sports";
import CategoryBadge from "./CategoryBadge";
import { contractLabel } from "./PickDetailModal";

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function evFmt(v: number) { return `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`; }

export default function MarketTable({ rows }: { rows: PredictionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty-state">No markets for this type.</div>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="market-table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Kalshi%</th>
            <th>Odds</th>
            <th>Model%</th>
            <th>Edge</th>
            <th>EV ($100)</th>
            <th>Kelly%</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td className="cell-contract" title={r.title}>{contractLabel(r)}</td>
              <td className="cell-pct">{pct(r.kalshi_prob)}</td>
              <td><span className="odds-btn">{r.american_odds}</span></td>
              <td className="cell-pct">{pct(r.model_prob)}</td>
              <td className={`cell-edge ${r.edge > 0 ? "positive" : r.edge < 0 ? "negative" : "muted"}`}>
                {r.edge > 0 ? "+" : ""}{pct(r.edge)}
              </td>
              <td className={`cell-ev ${r.ev > 0 ? "positive" : r.ev < 0 ? "negative" : "muted"}`}>
                {evFmt(r.ev)}
              </td>
              <td className="cell-kelly">{r.kelly.toFixed(1)}%</td>
              <td><CategoryBadge category={r.category} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
