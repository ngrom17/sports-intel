import type { PredictionsResponse, SportMeta, ModelSettings } from "@/types/sports";
import type { PnLResponse, CalibrationResponse, Pick as TrackerPick } from "@/types/tracker";

// In dev: Vite proxy forwards /api/* → http://localhost:8090
// In prod build: set VITE_API_URL to your deployed backend URL
const BASE = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

export const fetchSports = (): Promise<{ sports: SportMeta[] }> =>
  get("/api/sports");

// ── Tracker ───────────────────────────────────────────────────────────────────
async function post(path: string, params?: Record<string, string>): Promise<unknown> {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const logTodaysPicks    = (sport = "nba") => post("/api/tracker/log",             { sport });
export const captureClosing    = (sport = "nba") => post("/api/tracker/capture-closing", { sport });
export const settlePicks       = (sport = "nba") => post("/api/tracker/settle",          { sport });
export const fetchTrackerPnl   = (sport?: string): Promise<PnLResponse> =>
  get("/api/tracker/pnl", sport ? { sport } : undefined);
export const fetchTrackerPicks = (sport?: string, limit = 100): Promise<{ picks: TrackerPick[] }> =>
  get("/api/tracker/picks", { ...(sport ? { sport } : {}), limit });
export const fetchCalibration  = (sport?: string): Promise<CalibrationResponse> =>
  get("/api/tracker/calibration", sport ? { sport } : undefined);

// ── Predictions ───────────────────────────────────────────────────────────────
export const fetchPredictions = (
  sport: string,
  settings: ModelSettings,
): Promise<PredictionsResponse> =>
  get("/api/predictions", {
    sport,
    w_xgb:                   settings.wXgb,
    kelly_fraction:           settings.kellyFraction,
    homerun_edge:             settings.homerunEdge,
    homerun_model_prob:       settings.homerunModelProb,
    undervalued_edge:         settings.undervaluedEdge,
    underdog_kalshi_ceiling:  settings.underdogKalshiCeiling,
    underdog_model_floor:     settings.underdogModelFloor,
    sharp_edge_min:           settings.sharpEdgeMin,
    sharp_edge_max:           settings.sharpEdgeMax,
  });
