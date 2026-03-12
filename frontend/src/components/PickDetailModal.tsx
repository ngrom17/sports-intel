/**
 * PickDetailModal — right-side drawer for Top Pick detail.
 * Portals into #modal-root (outside #root) to avoid all stacking-context issues.
 *
 * Phase 1 (live): probability bars, category reason, EV math, Kelly, market context.
 * Phase 2 (dormant): win rate/ROI tiles, equity curve, calibration chart.
 *                    Unlocks when MIN_SETTLED_FOR_CHART settled picks exist.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { PredictionRow } from "@/types/sports";
import type { PnLResponse, CalibrationResponse } from "@/types/tracker";
import { fetchTrackerPnl, fetchCalibration } from "@/lib/api";
import CategoryBadge from "./CategoryBadge";

const MIN_SETTLED_FOR_CHART = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

function winPer100(americanOdds: string): number {
  const o = parseFloat(americanOdds.replace(/^\+/, ""));
  if (isNaN(o) || o === 0) return 100;
  return o > 0 ? o : (100 / Math.abs(o)) * 100;
}

function fmtMoney(v: number) {
  if (isNaN(v)) return "$0.00";
  return `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`;
}

export function contractLabel(r: PredictionRow): string {
  if (r.market_type === "total" && r.line != null) {
    return `${r.side === "under" ? "Under" : "Over"} ${r.line}`;
  }
  if (r.market_type === "moneyline" && r.winner_abbr) {
    return `${r.winner_abbr} to Win`;
  }
  return r.title;
}

// ── Category explanation ──────────────────────────────────────────────────────

const CATEGORY_REASON: Record<string, (r: PredictionRow) => string> = {
  HOMERUN: (r) =>
    `Model gives ${pct(r.model_prob)} vs ${pct(r.kalshi_prob)} market implied — ${pct(r.edge)} edge. ` +
    `Qualifies as HOMERUN: edge ≥ 10% and model confidence ≥ 65%.`,
  UNDERVALUED: (r) =>
    `Market underprices this contract by ${pct(r.edge)}. ` +
    `Model gives ${pct(r.model_prob)} vs ${pct(r.kalshi_prob)} implied.`,
  UNDERDOG: (r) =>
    `Market prices this side at only ${pct(r.kalshi_prob)} (underdog territory) ` +
    `but the model gives ${pct(r.model_prob)}. Positive edge on a long shot.`,
  SHARP: (r) =>
    `Thin edge (${pct(r.edge)}) in the SHARP band. ` +
    `May reflect informed positioning rather than large model divergence.`,
  FADE: (r) =>
    `Market prices this at ${pct(r.kalshi_prob)}, above the model's ${pct(r.model_prob)}. ` +
    `Negative edge — the opposing side is the value play.`,
  "LOW EDGE": (r) =>
    `Marginal edge (${pct(r.edge)}). Market and model are close — treat as informational only.`,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ProbBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="prob-bar-row">
      <span className="prob-bar-label">{label}</span>
      <div className="prob-bar-track">
        <div className="prob-bar-fill" style={{ width: `${(prob * 100).toFixed(1)}%`, background: color }} />
      </div>
      <span className="prob-bar-value">{pct(prob)}</span>
    </div>
  );
}

function EdgeGap({ edge }: { edge: number }) {
  return (
    <div className={`edge-gap ${edge >= 0 ? "positive" : "negative"}`}>
      {edge >= 0 ? "+" : ""}{pct(edge)} edge
    </div>
  );
}

// ── Phase 2 ───────────────────────────────────────────────────────────────────

function CategoryStatsPanel({ category, pnl }: { category: string; pnl: PnLResponse | undefined }) {
  const slice  = pnl?.by_category[category];
  const picks  = slice?.picks ?? 0;
  const enough = picks >= MIN_SETTLED_FOR_CHART;
  const winRate = enough ? ((slice!.wins / picks) * 100).toFixed(1) + "%" : null;
  const roi     = enough ? ((slice!.net_pnl / (picks * 100)) * 100).toFixed(1) + "%" : null;

  return (
    <div className="modal-stat-row">
      {[
        { label: `Win Rate (${category})`, val: winRate, isGood: winRate ? parseFloat(winRate) >= 52 : false },
        { label: `ROI (${category})`,      val: roi,     isGood: roi     ? parseFloat(roi)     >= 0  : false },
        { label: "Sample",                 val: enough ? `${picks} picks` : null, isGood: true },
      ].map(({ label, val, isGood }) => (
        <div key={label} className="modal-stat-tile">
          <span className="modal-stat-label">{label}</span>
          {val
            ? <span className={`modal-stat-value ${isGood ? "positive" : "negative"}`}>{val}</span>
            : <span className="modal-locked-value">🔒 {picks}/{MIN_SETTLED_FOR_CHART}</span>
          }
        </div>
      ))}
    </div>
  );
}

function EquityCurveChart({ pnl }: { pnl: PnLResponse | undefined }) {
  const curve = pnl?.equity_curve ?? [];
  if (curve.length < 7) {
    return (
      <div className="modal-chart-placeholder">
        <span className="modal-chart-lock">📈</span>
        <span className="modal-chart-lock-text">
          Equity curve — {Math.max(0, 7 - curve.length)} more trading day{7 - curve.length !== 1 ? "s" : ""} needed
        </span>
      </div>
    );
  }
  return (
    <div className="modal-chart-wrap">
      <div className="modal-chart-label">Cumulative P&L</div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2ed573" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2ed573" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#13141a", border: "1px solid #252633", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [fmtMoney(Number(v)), ""]}
            labelStyle={{ color: "#9497b0" }}
          />
          <Area type="monotone" dataKey="cumulative" stroke="#2ed573" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CalibrationChart({ calibration }: { calibration: CalibrationResponse | undefined }) {
  const buckets = calibration?.buckets ?? [];
  if (buckets.length === 0) {
    return (
      <div className="modal-chart-placeholder">
        <span className="modal-chart-lock">🎯</span>
        <span className="modal-chart-lock-text">
          Edge calibration — needs {MIN_SETTLED_FOR_CHART} settled picks
        </span>
      </div>
    );
  }
  return (
    <div className="modal-chart-wrap">
      <div className="modal-chart-label">Win Rate by Edge Bucket</div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="edge_bucket" tick={{ fontSize: 11, fill: "#9497b0" }} axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            contentStyle={{ background: "#13141a", border: "1px solid #252633", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, "Win rate"]}
            labelStyle={{ color: "#9497b0" }}
          />
          <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={i} fill={b.win_rate >= 0.55 ? "#2ed573" : b.win_rate >= 0.50 ? "#ffa502" : "#ff4757"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  row:     PredictionRow | null;
  sport:   string;
  onClose: () => void;
}

export default function PickDetailModal({ row, sport, onClose }: Props) {
  // Escape key
  useEffect(() => {
    if (!row) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [row, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (row) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [row]);

  const { data: pnlData } = useQuery({
    queryKey:  ["tracker_pnl", sport],
    queryFn:   () => fetchTrackerPnl(sport),
    enabled:   !!row,
    staleTime: 5 * 60_000,
  });
  const { data: calibrationData } = useQuery({
    queryKey:  ["tracker_calibration", sport],
    queryFn:   () => fetchCalibration(sport),
    enabled:   !!row,
    staleTime: 5 * 60_000,
  });

  if (!row) return null;

  const winAmt = winPer100(row.american_odds);
  const ev     = row.model_prob * winAmt - (1 - row.model_prob) * 100;
  const reason = CATEGORY_REASON[row.category]?.(row) ?? "";
  const label  = contractLabel(row);

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(2px)",
          zIndex: 9998,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(480px, 100vw)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
        }}
        className="modal-drawer"
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="modal-header">
          <div className="modal-header-left">
            <CategoryBadge category={row.category} />
            <div>
              <div className="modal-game-label">{row.game_label}</div>
              <div className="modal-contract-label">{label}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">

          {/* ── Edge breakdown ────────────────────────────────── */}
          <section className="modal-section">
            <div className="modal-section-title">Edge Breakdown</div>
            <div className="prob-bars">
              <ProbBar label="Market" prob={row.kalshi_prob} color="var(--text-muted)" />
              <ProbBar label="Model"  prob={row.model_prob}  color="var(--accent)" />
            </div>
            <EdgeGap edge={row.edge} />
            {reason && <p className="modal-reason-text">{reason}</p>}
          </section>

          {/* ── EV math ───────────────────────────────────────── */}
          <section className="modal-section">
            <div className="modal-section-title">EV Math (per $100 stake)</div>
            <div className="ev-formula">
              <span className="ev-formula-term positive">Win ${winAmt.toFixed(2)} × {pct(row.model_prob)}</span>
              <span className="ev-formula-op">−</span>
              <span className="ev-formula-term negative">Lose $100 × {pct(1 - row.model_prob)}</span>
              <span className="ev-formula-op">=</span>
              <span className={`ev-formula-result ${ev >= 0 ? "positive" : "negative"}`}>{fmtMoney(ev)}</span>
            </div>
            <div className="kelly-row">
              <div className="kelly-tile">
                <span className="kelly-label">Full Kelly</span>
                <span className="kelly-value">{row.kelly.toFixed(1)}%</span>
              </div>
              <div className="kelly-tile">
                <span className="kelly-label">Half Kelly</span>
                <span className="kelly-value">{(row.kelly / 2).toFixed(1)}%</span>
              </div>
              <div className="kelly-tile">
                <span className="kelly-label">Quarter Kelly</span>
                <span className="kelly-value">{(row.kelly / 4).toFixed(1)}%</span>
              </div>
            </div>
          </section>

          {/* ── Market context ────────────────────────────────── */}
          <section className="modal-section">
            <div className="modal-section-title">Market Context</div>
            <div className="ctx-grid">
              <div className="ctx-item">
                <span className="ctx-label">Kalshi Price</span>
                <span className="ctx-value">{pct(row.kalshi_prob)}</span>
              </div>
              <div className="ctx-item">
                <span className="ctx-label">American Odds</span>
                <span className="ctx-value">{row.american_odds}</span>
              </div>
              <div className="ctx-item">
                <span className="ctx-label">Volume</span>
                <span className="ctx-value">{row.volume.toLocaleString()}</span>
              </div>
              <div className="ctx-item">
                <span className="ctx-label">Stats Model</span>
                <span className={`ctx-value ${row.stats_loaded ? "positive" : "negative"}`}>
                  {row.stats_loaded ? "Loaded" : "Baseline"}
                </span>
              </div>
              <div className="ctx-item">
                <span className="ctx-label">Market Type</span>
                <span className="ctx-value" style={{ textTransform: "capitalize" }}>{row.market_type}</span>
              </div>
              <div className="ctx-item">
                <span className="ctx-label">Ticker</span>
                <span className="ctx-value ctx-ticker">{row.ticker}</span>
              </div>
            </div>
          </section>

          {/* ── Historical performance (Phase 2) ─────────────── */}
          <section className="modal-section">
            <div className="modal-section-title">
              Historical Performance
              <span className="modal-section-badge">
                {(pnlData?.by_category[row.category]?.picks ?? 0) >= MIN_SETTLED_FOR_CHART ? "Live" : "Pending data"}
              </span>
            </div>
            <CategoryStatsPanel category={row.category} pnl={pnlData} />
            <EquityCurveChart pnl={pnlData} />
            <CalibrationChart calibration={calibrationData} />
          </section>

        </div>
      </div>
    </>,
    modalRoot
  );
}
