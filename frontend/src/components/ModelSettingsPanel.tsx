import type { ModelSettings } from "@/types/sports";
import { DEFAULT_SETTINGS } from "@/types/sports";

// ── Info tooltip ──────────────────────────────────────────────────────────────
function InfoTip({ text }: { text: string }) {
  return (
    <span className="infotip">
      <span className="infotip-trigger" tabIndex={0} aria-label="More info">?</span>
      <span className="infotip-content" role="tooltip">{text}</span>
    </span>
  );
}

// ── Individual slider row ─────────────────────────────────────────────────────
interface SliderRowProps {
  label:    string;
  tip:      string;
  value:    number;
  min:      number;
  max:      number;
  step:     number;
  fmt:      (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({ label, tip, value, min, max, step, fmt, onChange }: SliderRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-header">
        <span className="setting-label">
          {label}
          <InfoTip text={tip} />
        </span>
        <span className="setting-value">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="setting-slider"
      />
    </div>
  );
}

// ── Group heading ─────────────────────────────────────────────────────────────
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="setting-group-label">{children}</div>;
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface Props {
  open:       boolean;
  manual:     boolean;
  settings:   ModelSettings;
  onManual:   (v: boolean) => void;
  onChange:   (patch: Partial<ModelSettings>) => void;
  onReset:    () => void;
}

const pct  = (v: number) => `${(v * 100).toFixed(0)}%`;
const mult = (v: number) => `${v.toFixed(2)}×`;
const frac = (v: number) => `${(v * 100).toFixed(0)}%`;

export default function ModelSettingsPanel({ open, manual, settings, onManual, onChange, onReset }: Props) {
  return (
    <div className={`settings-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="settings-panel-inner">

        {/* ── Panel header ── */}
        <div className="settings-panel-header">
          <span className="settings-panel-title">Model Settings</span>
          <label className="toggle-switch" title="Enable manual threshold tuning">
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => onManual(e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">Manual Mode</span>
          </label>
        </div>

        {/* ── Always-visible sliders ── */}
        <div className="settings-grid">
          <SliderRow
            label="XGBoost Weight"
            tip="Blends your XGBoost model output with the raw Kalshi market price. 1.0× = pure model. 0.0× = trust the market entirely. Above 1.0× amplifies the model signal beyond its raw output — useful when you believe the model is underconfident."
            value={settings.wXgb}
            min={0} max={2} step={0.05}
            fmt={mult}
            onChange={(v) => onChange({ wXgb: v })}
          />
          <SliderRow
            label="Kelly Fraction"
            tip="Scales the Kelly Criterion bet size. Full Kelly (100%) maximizes long-run growth but produces highly volatile swings. Half Kelly (50%) is the industry standard — cuts variance roughly in half with only a small sacrifice in expected growth. Quarter Kelly (25%) is the conservative floor used by professional bettors."
            value={settings.kellyFraction}
            min={0.1} max={1.0} step={0.05}
            fmt={frac}
            onChange={(v) => onChange({ kellyFraction: v })}
          />
        </div>

        {/* ── Manual Mode: category thresholds ── */}
        {manual && (
          <>
            <div className="settings-divider" />
            <div className="settings-grid">

              <GroupLabel>
                <span className="badge badge-homerun">HOMERUN</span>
                <InfoTip text="HOMERUNs are the highest-conviction bets: large edge AND high model probability. Both conditions must be met simultaneously — this prevents flagging long shots with artificially inflated edge." />
              </GroupLabel>

              <SliderRow
                label="Min Edge"
                tip="Minimum edge (model probability minus market probability) required to qualify as a HOMERUN. Higher threshold = fewer but higher-conviction picks. At 10% edge, the model must believe the true probability is at least 10 percentage points above what Kalshi is pricing."
                value={settings.homerunEdge}
                min={0.01} max={0.30} step={0.01}
                fmt={pct}
                onChange={(v) => onChange({ homerunEdge: v })}
              />
              <SliderRow
                label="Min Model Prob"
                tip="Minimum model win probability for a HOMERUN classification. Prevents the model from calling a 20% dog with high edge a HOMERUN just because the market is pricing it at 10%. The team must actually be a favorite or near-favorite according to the model."
                value={settings.homerunModelProb}
                min={0.50} max={0.90} step={0.01}
                fmt={pct}
                onChange={(v) => onChange({ homerunModelProb: v })}
              />

              <GroupLabel>
                <span className="badge badge-undervalued">UNDERVALUED</span>
                <InfoTip text="UNDERVALUED bets have solid positive edge but don't meet the HOMERUN bar. These are the bread-and-butter +EV plays — the market is underpricing the team but the model's confidence is moderate rather than strong." />
              </GroupLabel>

              <SliderRow
                label="Min Edge"
                tip="Minimum edge to classify as UNDERVALUED. Lowering this threshold adds more picks but reduces average quality. At 5%, the model needs to see at least a 5-point gap between its probability estimate and what Kalshi is offering."
                value={settings.undervaluedEdge}
                min={0.01} max={0.20} step={0.01}
                fmt={pct}
                onChange={(v) => onChange({ undervaluedEdge: v })}
              />

              <GroupLabel>
                <span className="badge badge-underdog">UNDERDOG</span>
                <InfoTip text="UNDERDOG picks are teams the market prices as heavy underdogs but the model believes have a realistic chance. These carry higher variance but positive EV when the model is calibrated correctly. The market ceiling ensures you're only getting true underdogs." />
              </GroupLabel>

              <SliderRow
                label="Market Ceiling"
                tip="Maximum Kalshi probability for an UNDERDOG pick. The market must be pricing the team at or below this threshold for the pick to qualify. At 38%, only teams priced as meaningful underdogs (roughly +163 or longer) are eligible."
                value={settings.underdogKalshiCeiling}
                min={0.20} max={0.50} step={0.01}
                fmt={pct}
                onChange={(v) => onChange({ underdogKalshiCeiling: v })}
              />
              <SliderRow
                label="Min Model Prob"
                tip="Minimum model probability for the team to qualify as an UNDERDOG pick. The model must see the underdog as having a realistic chance — this prevents backing 5% shots just because the market also sees them as 5%. At 48%, the model nearly disagrees with the market entirely."
                value={settings.underdogModelFloor}
                min={0.35} max={0.65} step={0.01}
                fmt={pct}
                onChange={(v) => onChange({ underdogModelFloor: v })}
              />

              <GroupLabel>
                <span className="badge badge-sharp">SHARP</span>
                <InfoTip text="SHARP bets are disciplined plays with small but consistent edge — the kind professional bettors make in volume. They fall between the low-edge noise floor and the UNDERVALUED threshold. Narrowing this band focuses the category; widening it captures more plays." />
              </GroupLabel>

              <SliderRow
                label="Band Floor"
                tip="Minimum edge for a SHARP classification. Bets with edge below this floor fall into LOW EDGE or FADE. Raising this floor makes the SHARP category more selective and pushes more picks into LOW EDGE."
                value={settings.sharpEdgeMin}
                min={0.01} max={0.10} step={0.005}
                fmt={pct}
                onChange={(v) => onChange({ sharpEdgeMin: v })}
              />
              <SliderRow
                label="Band Ceiling"
                tip="Maximum edge before a bet graduates from SHARP to UNDERVALUED. This creates the SHARP band: [floor, ceiling). Lowering this ceiling promotes more picks to UNDERVALUED. It must always be set above the Band Floor."
                value={settings.sharpEdgeMax}
                min={0.02} max={0.15} step={0.005}
                fmt={pct}
                onChange={(v) => onChange({ sharpEdgeMax: v })}
              />

            </div>

            <div className="settings-reset-row">
              <button className="settings-reset-btn" onClick={onReset}>
                Reset to Defaults
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
