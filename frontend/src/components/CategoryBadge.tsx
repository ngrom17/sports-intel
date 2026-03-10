import type { PredictionRow } from "@/types/sports";

const CLASS_MAP: Record<PredictionRow["category"], string> = {
  "HOMERUN":    "badge badge-homerun",
  "UNDERVALUED":"badge badge-undervalued",
  "UNDERDOG":   "badge badge-underdog",
  "SHARP":      "badge badge-sharp",
  "FADE":       "badge badge-fade",
  "LOW EDGE":   "badge badge-low-edge",
};

export default function CategoryBadge({ category }: { category: PredictionRow["category"] }) {
  return <span className={CLASS_MAP[category] ?? "badge badge-fade"}>{category}</span>;
}
