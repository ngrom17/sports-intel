import { useState } from "react";
import type { GameInfo, PredictionRow } from "@/types/sports";
import LiveScoreBadge from "./LiveScoreBadge";
import CategoryBadge from "./CategoryBadge";
import MarketTable from "./MarketTable";

const TABS = ["moneyline", "spread", "total"] as const;
type Tab = (typeof TABS)[number];

const TOP_CATS = new Set(["HOMERUN", "UNDERVALUED", "UNDERDOG"]);

export default function GameCard({ game, rows }: { game: GameInfo; rows: PredictionRow[] }) {
  const [open, setOpen] = useState(true);
  const [tab,  setTab]  = useState<Tab>("moneyline");

  const tabRows  = rows.filter((r) => r.market_type === tab);
  const bestPick = rows.filter((r) => TOP_CATS.has(r.category)).sort((a, b) => b.ev - a.ev)[0];
  const isLive   = game.status === "in_progress";

  return (
    <div className={`game-card${isLive ? " live" : ""}`}>
      <button className="game-header" onClick={() => setOpen((o) => !o)}>

        <div style={{ flexShrink: 0 }}>
          <LiveScoreBadge game={game} />
        </div>

        {isLive && (
          <div className="score-display">
            <div className="score-team">
              <span className="score-abbr">{game.away_abbr}</span>
              <span className="score-pts">{game.away_score}</span>
            </div>
            <span className="score-sep">–</span>
            <div className="score-team">
              <span className="score-pts">{game.home_score}</span>
              <span className="score-abbr">{game.home_abbr}</span>
            </div>
          </div>
        )}

        <div className="game-info">
          <div className={`game-matchup${isLive ? " live" : ""}`}>
            {game.away_abbr} @ {game.home_abbr}
          </div>
          <div className="game-meta">{rows.length} markets</div>
        </div>

        {bestPick && (
          <div className="game-best-pick">
            <CategoryBadge category={bestPick.category} />
            <span className="game-best-edge">
              {bestPick.edge > 0 ? "+" : ""}{(bestPick.edge * 100).toFixed(1)}% edge
            </span>
          </div>
        )}

        <span className={`game-chevron${open ? " open" : ""}`}>▼</span>
      </button>

      {open && (
        <>
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab-btn${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <MarketTable rows={tabRows} />
        </>
      )}
    </div>
  );
}
