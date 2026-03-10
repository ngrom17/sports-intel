import type { GameInfo } from "@/types/sports";

function periodLabel(period: number, time: string): string {
  if (period === 0) return "";
  const suffix = time === "Halftime" ? " HT" : time ? ` ${time}` : "";
  if (period <= 4) return `Q${period}${suffix}`;
  return `OT${period > 5 ? period - 4 : ""}${suffix}`;
}

export default function LiveScoreBadge({ game }: { game: GameInfo }) {
  if (game.status === "in_progress") {
    return (
      <span className="live-badge">
        <span className="live-badge-dot" />
        LIVE {periodLabel(game.period, game.time_remaining)}
      </span>
    );
  }

  const tipoff  = new Date(game.tipoff_utc);
  const timeStr = tipoff.toLocaleTimeString("en-US", {
    hour:     "numeric",
    minute:   "2-digit",
    timeZone: "America/New_York",
  });

  return <span className="scheduled-badge">{timeStr} ET</span>;
}
