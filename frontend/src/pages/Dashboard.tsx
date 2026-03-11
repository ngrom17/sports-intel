import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSports, fetchPredictions } from "@/lib/api";
import type { PredictionRow, ModelSettings } from "@/types/sports";
import { DEFAULT_SETTINGS } from "@/types/sports";
import GameCard from "@/components/GameCard";
import TopPicks from "@/components/TopPicks";
import CategoryBadge from "@/components/CategoryBadge";
import ModelSettingsPanel from "@/components/ModelSettingsPanel";

const LOW_EDGE_CATS = new Set(["FADE", "LOW EDGE"]);

function pct(v: number)   { return `${(v * 100).toFixed(1)}%`; }
function evFmt(v: number) { return `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`; }

export default function Dashboard() {
  const [sport,       setSport]       = useState("nba");
  const [lastUpdate,  setLastUpdate]  = useState("");
  const [lowOpen,     setLowOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualMode,  setManualMode]  = useState(false);
  const [settings,    setSettings]    = useState<ModelSettings>(DEFAULT_SETTINGS);

  const patchSettings = (patch: Partial<ModelSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const { data: sportsData } = useQuery({
    queryKey:  ["sports"],
    queryFn:   fetchSports,
    staleTime: Infinity,
  });

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey:        ["predictions", sport, settings],
    queryFn:         () => fetchPredictions(sport, settings),
    refetchInterval: 60_000,
    staleTime:       30_000,
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(
        new Date(dataUpdatedAt).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", second: "2-digit",
        })
      );
    }
  }, [dataUpdatedAt]);

  // Group prediction rows by game
  const gameMap = new Map<number, PredictionRow[]>();
  for (const r of data?.rows ?? []) {
    if (!gameMap.has(r.game_id)) gameMap.set(r.game_id, []);
    gameMap.get(r.game_id)!.push(r);
  }

  const liveGames     = data?.games?.filter((g) => g.status === "in_progress") ?? [];
  const scheduledGames = data?.games?.filter((g) => g.status === "scheduled") ?? [];
  const lowRows       = data?.rows.filter((r) => LOW_EDGE_CATS.has(r.category)) ?? [];

  const settingsBtnLabel = manualMode
    ? `⚙ Manual — ${settings.wXgb.toFixed(2)}×`
    : `⚙ ${settings.wXgb.toFixed(2)}×`;

  return (
    <>
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand">
            <div className="nav-logo">SB</div>
            <div className="nav-title">Sports Intel</div>
          </a>

          <div className="nav-sports">
            {sportsData?.sports.map((s) => (
              <button
                key={s.id}
                className={`nav-sport-btn${sport === s.id ? " active" : ""}`}
                onClick={() => s.live && setSport(s.id)}
                disabled={!s.live}
                title={s.live ? undefined : "Coming soon"}
              >
                {s.label}
                {!s.live && <span className="coming-soon">SOON</span>}
              </button>
            ))}
          </div>

          <div className="nav-right">
            <a href="/tracker" className="nav-sport-btn" style={{ textDecoration: "none" }}>Tracker</a>
            {liveGames.length > 0 && <span className="live-dot" title="Live games in progress" />}
            {lastUpdate && <span className="refresh-time">Updated {lastUpdate}</span>}
            <button
              className={`nav-settings-btn${settingsOpen ? " active" : ""}`}
              onClick={() => setSettingsOpen((o) => !o)}
              title="Model settings"
            >
              {settingsBtnLabel}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Settings panel (drops from nav) ──────────────── */}
      <ModelSettingsPanel
        open={settingsOpen}
        manual={manualMode}
        settings={settings}
        onManual={setManualMode}
        onChange={patchSettings}
        onReset={() => setSettings(DEFAULT_SETTINGS)}
      />

      {/* ── Main ─────────────────────────────────────────── */}
      <main className="main">

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat-tile">
            <span className="stat-label">Games Today</span>
            <span className="stat-value">{data?.games_count ?? "—"}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Kalshi Markets</span>
            <span className="stat-value accent">{data?.markets_count ?? "—"}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Positive Edge</span>
            <span className="stat-value positive">{data?.positive_edge ?? "—"}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">+EV Bets</span>
            <span className="stat-value positive">{data?.positive_ev ?? "—"}</span>
          </div>
        </div>

        {/* Warnings */}
        {data && !data.stats_loaded && !data.coming_soon && (
          <div className="warning-banner">
            ⚠️ {sport.toUpperCase()} stats unavailable — predictions use baseline model. Edge may be unreliable.
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="games-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton skeleton-row" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="warning-banner error">
            ⚠️ {(error as Error).message}
          </div>
        )}

        {/* Coming soon */}
        {data?.coming_soon && (
          <div className="empty-state">
            <div className="empty-state-icon">🏈</div>
            <div className="empty-state-title">{sport.toUpperCase()} — Coming Soon</div>
            <div className="empty-state-body">Model training in progress. Check back next season.</div>
          </div>
        )}

        {/* No games */}
        {data && !data.coming_soon && data.games_count === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">No Games Today</div>
            <div className="empty-state-body">No {sport.toUpperCase()} games scheduled.</div>
          </div>
        )}

        {data && !data.coming_soon && data.games_count > 0 && (
          <>
            {/* Live scores strip */}
            {liveGames.length > 0 && (
              <div className="section">
                <div className="section-header">
                  <span className="section-title">
                    <span className="live-dot" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
                    Live Now
                  </span>
                  <span className="section-count">{liveGames.length}</span>
                </div>
                <div className="live-scores-strip">
                  {liveGames.map((game) => (
                    <div key={game.game_id} className="live-score-card">
                      <div className="live-score-teams">
                        <span className="live-score-abbr">{game.away_abbr}</span>
                        <span className="live-score-num">{game.away_score}</span>
                        <span className="live-score-sep">–</span>
                        <span className="live-score-num">{game.home_score}</span>
                        <span className="live-score-abbr">{game.home_abbr}</span>
                      </div>
                      <div className="live-score-clock">
                        {game.period ? `P${game.period}` : ""}
                        {game.time_remaining ? ` · ${game.time_remaining}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <TopPicks rows={data.rows} />

            <div className="section">
              <div className="section-header">
                <span className="section-title">Upcoming Games</span>
                <span className="section-count">{scheduledGames.length}</span>
              </div>
              <div className="games-list">
                {scheduledGames.map((game) => (
                  <GameCard
                    key={game.game_id}
                    game={game}
                    rows={gameMap.get(game.game_id) ?? []}
                  />
                ))}
              </div>
            </div>

            {lowRows.length > 0 && (
              <div className="section">
                <button className="collapse-header" onClick={() => setLowOpen((o) => !o)}>
                  <span>Low Edge / Fade — {lowRows.length} markets</span>
                  <span>{lowOpen ? "▲" : "▼"}</span>
                </button>
                {lowOpen && (
                  <div className="collapse-body">
                    <div style={{ overflowX: "auto", padding: "0 var(--sp-4) var(--sp-4)" }}>
                      <table className="market-table">
                        <thead>
                          <tr>
                            <th>Game</th>
                            <th>Contract</th>
                            <th>Odds</th>
                            <th>Edge</th>
                            <th>EV ($100)</th>
                            <th>Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowRows.map((r) => (
                            <tr key={r.ticker}>
                              <td className="cell-game-label">{r.game_label}</td>
                              <td className="cell-contract" title={r.title}>
                                {r.market_type === "total" && r.line != null ? `Over ${r.line}` : r.title}
                              </td>
                              <td><span className="odds-btn">{r.american_odds}</span></td>
                              <td className={`cell-edge ${r.edge > 0 ? "positive" : "negative"}`}>
                                {r.edge > 0 ? "+" : ""}{pct(r.edge)}
                              </td>
                              <td className={`cell-ev ${r.ev > 0 ? "positive" : "negative"}`}>
                                {evFmt(r.ev)}
                              </td>
                              <td><CategoryBadge category={r.category} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
