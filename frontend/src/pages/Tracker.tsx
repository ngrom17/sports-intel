import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  fetchTrackerPnl, fetchTrackerPicks, fetchCalibration,
  logTodaysPicks, settlePicks, captureClosing,
} from "@/lib/api";
import CategoryBadge from "@/components/CategoryBadge";
import type { Pick as TrackerPick } from "@/types/tracker";

// ── Formatters ────────────────────────────────────────────────────────────────
const pct  = (v: number | null) => v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const usd  = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`;
const roi  = (v: number | null) => v == null ? "—" : `${(v * 100).toFixed(2)}%`;
const clv  = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function ResultBadge({ result }: { result?: string }) {
  if (!result) return <span className="badge badge-low-edge">Pending</span>;
  const cls = result === "win"  ? "badge-homerun"
            : result === "loss" ? "badge-fade"
            : "badge-sharp";
  return <span className={`badge ${cls}`}>{result.toUpperCase()}</span>;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-label" style={{ marginTop: 2 }}>{sub}</span>}
    </div>
  );
}

function PickRow({ pick }: { pick: TrackerPick }) {
  const settlement = pick.settlements?.[0];
  return (
    <tr>
      <td>{pick.pick_date}</td>
      <td className="cell-game-label">{pick.game_label}</td>
      <td><CategoryBadge category={pick.category as never} /></td>
      <td className="cell-contract" title={pick.title}>{pick.title}</td>
      <td><span className="odds-btn">{pick.american_odds}</span></td>
      <td className={pick.raw_edge > 0 ? "positive" : "negative"}>
        {pct(pick.raw_edge)}
      </td>
      <td className={pick.ev_per_100 > 0 ? "positive" : "negative"}>
        {usd(pick.ev_per_100)}
      </td>
      <td><ResultBadge result={settlement?.result} /></td>
      <td className={!settlement ? "" : settlement.net_pnl >= 0 ? "positive" : "negative"}>
        {settlement ? usd(settlement.net_pnl) : "—"}
      </td>
      <td>{settlement ? clv(settlement.clv) : "—"}</td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Tracker() {
  const [sport, setSport]   = useState<string | undefined>(undefined);
  const [tab,   setTab]     = useState<"picks" | "calibration">("picks");
  const qc = useQueryClient();

  const { data: pnl, isLoading: pnlLoading } = useQuery({
    queryKey:  ["tracker_pnl", sport],
    queryFn:   () => fetchTrackerPnl(sport),
    staleTime: 60_000,
  });

  const { data: picksData } = useQuery({
    queryKey:  ["tracker_picks", sport],
    queryFn:   () => fetchTrackerPicks(sport, 200),
    staleTime: 60_000,
  });

  const { data: calData } = useQuery({
    queryKey:  ["tracker_calibration", sport],
    queryFn:   () => fetchCalibration(sport),
    staleTime: 60_000,
    enabled:   tab === "calibration",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tracker_pnl"] });
    qc.invalidateQueries({ queryKey: ["tracker_picks"] });
    qc.invalidateQueries({ queryKey: ["tracker_calibration"] });
  };

  const mutLog     = useMutation({ mutationFn: () => logTodaysPicks(sport ?? "nba"),  onSuccess: invalidate });
  const mutSettle  = useMutation({ mutationFn: () => settlePicks(sport ?? "nba"),     onSuccess: invalidate });
  const mutClosing = useMutation({ mutationFn: () => captureClosing(sport ?? "nba"),  onSuccess: invalidate });

  const settled   = (picksData?.picks ?? []).filter(p => p.settlements?.[0]);
  const unsettled = (picksData?.picks ?? []).filter(p => !p.settlements?.[0]);

  // Equity curve colour
  const eq          = pnl?.equity_curve ?? [];
  const lastEq      = eq.length > 0 ? eq[eq.length - 1].cumulative : 0;
  const curveColour = lastEq >= 0 ? "var(--positive)" : "var(--negative)";

  return (
    <>
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand">
            <div className="nav-logo">SB</div>
            <div className="nav-title">Sports Intel</div>
          </a>
          <div className="nav-sports">
            <a href="/dashboard" className="nav-sport-btn">Dashboard</a>
            <button className="nav-sport-btn active">Tracker</button>
          </div>
          <div className="nav-right">
            {/* Sport filter */}
            <select
              value={sport ?? ""}
              onChange={e => setSport(e.target.value || undefined)}
              style={{
                background: "var(--bg-card)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 6,
                padding: "4px 8px", fontSize: 13, cursor: "pointer",
              }}
            >
              <option value="">All Sports</option>
              <option value="nba">NBA</option>
              <option value="nhl">NHL</option>
              <option value="ncaab">NCAAB</option>
              <option value="mlb">MLB</option>
            </select>
          </div>
        </div>
      </nav>

      <main className="main">

        {/* ── Action bar ────────────────────────────────────── */}
        <div className="action-bar">
          <span className="action-bar-label">Actions</span>

          {/* Primary: log picks */}
          <button
            className="action-btn action-btn-primary"
            onClick={() => mutLog.mutate()}
            disabled={mutLog.isPending}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M4.5 6l3.5-4 3.5 4" />
              <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
            </svg>
            {mutLog.isPending ? "Logging…" : "Log Today's Picks"}
          </button>

          {/* Secondary: capture closing */}
          <button
            className="action-btn action-btn-secondary"
            onClick={() => mutClosing.mutate()}
            disabled={mutClosing.isPending}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="9" r="3" />
              <path d="M1 6h2l1.5-2h7L13 6h2v7a1 1 0 01-1 1H2a1 1 0 01-1-1V6z" />
            </svg>
            {mutClosing.isPending ? "Capturing…" : "Capture Closing"}
          </button>

          {/* Secondary: settle */}
          <button
            className="action-btn action-btn-secondary"
            onClick={() => mutSettle.mutate()}
            disabled={mutSettle.isPending}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M5 8l2 2 4-4" />
            </svg>
            {mutSettle.isPending ? "Settling…" : "Settle Final Games"}
          </button>

          {/* Inline response feedback */}
          {(mutLog.data || mutSettle.data || mutClosing.data) && (
            <span className="action-result">
              {JSON.stringify((mutLog.data ?? mutSettle.data ?? mutClosing.data) as Record<string, unknown>)}
            </span>
          )}
        </div>

        {/* ── Summary stats ─────────────────────────────────── */}
        {pnlLoading ? (
          <div className="skeleton skeleton-row" style={{ height: 80 }} />
        ) : (
          <div className="stats-bar">
            <StatTile label="Picks Logged"  value={String(pnl?.total_picks ?? 0)} />
            <StatTile label="Settled"       value={String(settled.length)}         />
            <StatTile label="Win Rate"      value={pct(pnl?.win_rate ?? null)}     />
            <StatTile
              label="Net P&L"
              value={usd(pnl?.net_pnl ?? null)}
              sub={`ROI: ${roi(pnl?.roi ?? null)}`}
            />
            <StatTile
              label="Avg CLV"
              value={clv(pnl?.avg_clv ?? null)}
              sub={pnl?.pct_positive_clv != null ? `${pct(pnl.pct_positive_clv)} beat close` : undefined}
            />
            <StatTile label="Pending"       value={String(unsettled.length)}       />
          </div>
        )}

        {/* ── Equity curve ──────────────────────────────────── */}
        {(pnl?.equity_curve.length ?? 0) > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">Equity Curve</span>
              <span className="section-count">
                {usd(eq.length > 0 ? eq[eq.length - 1].cumulative : null)} cumulative
              </span>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 8px 8px" }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={pnl!.equity_curve} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6 }}
                    labelStyle={{ color: "var(--text-muted)", fontSize: 11 }}
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, "Cumulative P&L"]}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="cumulative" stroke={curveColour}
                    strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Category breakdown ────────────────────────────── */}
        {pnl && Object.keys(pnl.by_category).length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">By Category</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="market-table">
                <thead>
                  <tr><th>Category</th><th>Picks</th><th>Wins</th><th>Win Rate</th><th>Net P&L</th></tr>
                </thead>
                <tbody>
                  {Object.entries(pnl.by_category).map(([cat, s]) => (
                    <tr key={cat}>
                      <td><CategoryBadge category={cat as never} /></td>
                      <td>{s.picks}</td>
                      <td>{s.wins}</td>
                      <td>{s.picks > 0 ? pct(s.wins / s.picks) : "—"}</td>
                      <td className={s.net_pnl >= 0 ? "positive" : "negative"}>{usd(s.net_pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab strip ─────────────────────────────────────── */}
        <div className="section">
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
            {(["picks", "calibration"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 16px", fontSize: 13, fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  textTransform: "capitalize",
                }}
              >
                {t === "picks" ? `Picks (${picksData?.picks.length ?? 0})` : "Calibration"}
              </button>
            ))}
          </div>

          {/* Picks table */}
          {tab === "picks" && (
            <div style={{ overflowX: "auto" }}>
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Game</th><th>Cat</th><th>Contract</th>
                    <th>Odds</th><th>Edge</th><th>EV($100)</th>
                    <th>Result</th><th>P&L</th><th>CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {(picksData?.picks ?? []).map(p => <PickRow key={p.id} pick={p} />)}
                  {(picksData?.picks.length ?? 0) === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
                      No picks logged yet. Click "Log Today's Picks" to start.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Calibration table */}
          {tab === "calibration" && (
            <div style={{ overflowX: "auto" }}>
              {calData?.note && (
                <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>{calData.note}</div>
              )}
              {(calData?.buckets.length ?? 0) > 0 && (
                <table className="market-table">
                  <thead>
                    <tr>
                      <th>Edge Bucket</th><th>Picks</th><th>Win Rate</th>
                      <th>Avg Model Prob</th><th>Avg P&L/pick</th><th>Avg CLV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calData!.buckets.map(b => (
                      <tr key={b.edge_bucket}>
                        <td><strong>{b.edge_bucket}</strong></td>
                        <td>{b.count}</td>
                        <td className={b.win_rate > 0.5 ? "positive" : "negative"}>{pct(b.win_rate)}</td>
                        <td>{pct(b.avg_ensemble_prob)}</td>
                        <td className={b.avg_net_pnl_per_pick >= 0 ? "positive" : "negative"}>
                          {usd(b.avg_net_pnl_per_pick)}
                        </td>
                        <td className={b.avg_clv != null && b.avg_clv >= 0 ? "positive" : "negative"}>
                          {clv(b.avg_clv)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ── Hard truth disclaimer ─────────────────────────── */}
        {(pnl?.total_picks ?? 0) > 0 && (pnl?.total_picks ?? 0) < 200 && (
          <div className="warning-banner" style={{ marginTop: 16 }}>
            ⚠️ <strong>Statistical note:</strong> {pnl!.total_picks} settled picks.
            Win rate confidence interval is ±{(1.96 * Math.sqrt(0.25 / pnl!.total_picks) * 100).toFixed(1)}%.
            Edge vs noise indistinguishable at this sample size. CLV is more informative than P&L here.
          </div>
        )}

      </main>
    </>
  );
}
