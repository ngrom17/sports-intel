import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Category badge ─────────────────────────────────────────────────────────
function CategoryPill({ cat }: { cat: string }) {
  const cls = cat.toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge badge-${cls}`}>{cat}</span>;
}

// ── SVG icons (inline, no dependency) ─────────────────────────────────────
const IconModel = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M17.5 17.5L21 21M14 17.5h3.5v3.5" />
  </svg>
);
const IconMarket = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
);
const IconEdge = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" />
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Bet category data ──────────────────────────────────────────────────────
const CATEGORIES = [
  { cat: "HOMERUN",     desc: "High conviction. Edge ≥10%, model prob ≥65%. Both thresholds met." },
  { cat: "UNDERVALUED", desc: "Solid +EV. Edge ≥5%. Market underpricing but moderate confidence." },
  { cat: "UNDERDOG",    desc: "Market ≤38% win prob, model disagrees. High variance, positive EV." },
  { cat: "SHARP",       desc: "Small-edge play. Edge 3–5%. Low variance, professional volume bet." },
  { cat: "FADE",        desc: "Negative edge. Market has this side overpriced. Avoid." },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [limitsOpen,     setLimitsOpen]     = useState(false);

  return (
    <div className="landing">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="nav-brand">
            <div className="nav-logo">SI</div>
            <span className="nav-title">Sports Intel</span>
          </div>
          <button
            className="landing-nav-cta"
            onClick={() => navigate("/dashboard")}
          >
            Enter Dashboard →
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="lp-eyebrow">NBA · Kalshi Markets · Live Edge</div>

          <h1 className="landing-hero-title">
            Betting Edge,<br />Quantified.
          </h1>

          <p className="landing-hero-sub">
            XGBoost models meet live Kalshi prediction markets.
            Surface +EV opportunities with Kelly-optimal sizing.
          </p>

          <div className="landing-hero-actions">
            <button
              className="landing-cta-primary"
              onClick={() => navigate("/dashboard")}
            >
              Enter Dashboard →
            </button>
            <a href="#how-it-works" className="landing-cta-ghost">
              How it works ↓
            </a>
          </div>

          {/* Trust strip — factual only, no unverified accuracy claims */}
          <div className="lp-trust-strip">
            <div className="lp-trust-item">
              <IconRefresh />
              <span>Live Kalshi prices</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <span>Kelly sizing</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <span>60s refresh</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <span>Full model transparency</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">How It Works</h2>
            <p className="landing-section-sub">Three data layers. One edge signal.</p>
          </div>
          <div className="landing-features">

            <div className="landing-feature-card">
              <div className="lp-icon-wrap"><IconModel /></div>
              <h3 className="landing-feature-title">Model Probabilities</h3>
              <p className="landing-feature-body">
                XGBoost trained on NBA team statistics — pace, efficiency,
                rest days, and home/away splits. Outputs a win probability
                for every market before tip.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="lp-icon-wrap"><IconMarket /></div>
              <h3 className="landing-feature-title">Live Market Prices</h3>
              <p className="landing-feature-body">
                Kalshi prediction market contracts refreshed every 60 seconds.
                Real money reflects real information — a cleaner signal than
                sportsbook lines padded with margin.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="lp-icon-wrap"><IconEdge /></div>
              <h3 className="landing-feature-title">Edge + Sizing</h3>
              <p className="landing-feature-body">
                Edge = model prob − market prob. EV = projected profit per $100.
                Kelly Criterion gives a mathematically optimal stake fraction
                based on the size of the edge.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Bet categories ─────────────────────────────────────── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Bet Categories</h2>
            <p className="landing-section-sub">
              Every market gets classified by edge and model confidence.
            </p>
          </div>
          <div className="landing-categories">
            {CATEGORIES.map(({ cat, desc }) => (
              <div key={cat} className="landing-category-row">
                <CategoryPill cat={cat} />
                <p className="landing-category-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Model transparency ─────────────────────────────────── */}
      <section className="landing-section" id="model">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Model Transparency</h2>
            <p className="landing-section-sub">
              Understand the system before you use it.
            </p>
          </div>

          <div className="landing-transparency-grid">

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Data Sources</h4>
              <ul className="landing-transparency-list">
                <li><span className="landing-t-source">stats.nba.com</span> — team stats updated daily</li>
                <li><span className="landing-t-source">BallDontLie API</span> — schedule and live scores</li>
                <li><span className="landing-t-source">Kalshi Trade API</span> — live market prices, 60s refresh</li>
              </ul>
            </div>

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">What the Model Uses</h4>
              <ul className="landing-transparency-list">
                <li>Offensive and defensive ratings (season-to-date)</li>
                <li>Rest days since last game</li>
                <li>Home/away statistical splits</li>
                <li>Kalshi market price as a blended input</li>
              </ul>
            </div>

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Update Cadence</h4>
              <ul className="landing-transparency-list">
                <li><strong>Kalshi prices</strong> — live, every 60s</li>
                <li><strong>Team stats</strong> — cached 1 hour</li>
                <li><strong>Schedule</strong> — cached 24 hours</li>
                <li><strong>Model weights</strong> — fixed, not retrained intra-season</li>
              </ul>
            </div>

            {/* Collapsible limitations card */}
            <div className="landing-transparency-card landing-transparency-card--warning">
              <button
                className="lp-collapsible-header"
                onClick={() => setLimitsOpen(o => !o)}
                aria-expanded={limitsOpen}
              >
                <h4 className="landing-transparency-heading" style={{ margin: 0 }}>
                  What the Model Does NOT Cover
                </h4>
                <IconChevron open={limitsOpen} />
              </button>
              {limitsOpen && (
                <ul className="landing-transparency-list" style={{ marginTop: 12 }}>
                  <li>Player injuries or same-day scratches</li>
                  <li>Roster changes, trades, load management</li>
                  <li>Real-time line movement or sharp money</li>
                  <li>Travel fatigue beyond rest-day counting</li>
                  <li>Referee assignments or foul tendencies</li>
                  <li>In-game situational factors</li>
                </ul>
              )}
            </div>

          </div>

          <p className="landing-model-statement">
            Model outputs are <strong>probabilistic estimates</strong> based on historical patterns.
            Past accuracy does not guarantee future performance.
            This tool is not financial advice or a recommendation to place any wager.
          </p>
        </div>
      </section>

      {/* ── Disclaimer accordion ────────────────────────────────── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <button
            className="lp-disclaimer-toggle"
            onClick={() => setDisclaimerOpen(o => !o)}
            aria-expanded={disclaimerOpen}
          >
            <span>Important Disclaimers</span>
            <IconChevron open={disclaimerOpen} />
          </button>

          {disclaimerOpen && (
            <div className="lp-disclaimer-body">
              <div className="landing-disclaimer">
                <div>
                  <strong>For Informational &amp; Analytical Purposes Only</strong>
                  <p>This is a research tool. It does not constitute financial advice or a recommendation to place any wager. The operator assumes no liability for decisions made based on these outputs.</p>
                </div>
              </div>
              <div className="landing-disclaimer">
                <div>
                  <strong>Betting Carries Significant Financial Risk</strong>
                  <p>Positive expected value is a statistical concept that applies over large sample sizes — individual results vary significantly. Never bet more than you can afford to lose. Problem gambling helpline: <strong>1-800-522-4700</strong>.</p>
                </div>
              </div>
              <div className="landing-disclaimer">
                <div>
                  <strong>Data May Be Delayed or Incomplete</strong>
                  <p>Market prices and statistics are fetched from third-party APIs that may experience delays or inaccuracies. Verify against the relevant exchange before acting on any data shown here.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="landing-section landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <h2 className="landing-cta-title">Ready to explore?</h2>
          <p className="landing-cta-sub">
            Live NBA markets. Real edge signals. Full model transparency.
          </p>
          <button
            className="landing-cta-primary"
            onClick={() => navigate("/dashboard")}
          >
            Enter Dashboard →
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="nav-brand">
            <div className="nav-logo">SI</div>
            <span className="nav-title">Sports Intel</span>
          </div>
          <p className="landing-footer-legal">
            Independent analytics tool. Not affiliated with Kalshi, the NBA, or any sportsbook.
            All outputs are for informational purposes only and do not constitute betting or financial advice.
            © {new Date().getFullYear()} Sports Intel.
          </p>
        </div>
      </footer>

    </div>
  );
}
