import { useNavigate } from "react-router-dom";

function CategoryPill({ cat }: { cat: string }) {
  const cls = cat.toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge badge-${cls}`}>{cat}</span>;
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">

      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="nav-brand">
            <div className="nav-logo">SB</div>
            <span className="nav-title">Sports Intel</span>
          </div>
          <button
            className="landing-nav-cta"
            onClick={() => navigate("/dashboard")}
            aria-label="Launch Dashboard"
          >
            Launch Dashboard →
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-eyebrow">NBA · Live Predictions</div>
          <h1 className="landing-hero-title">
            Betting Edge,<br />Quantified.
          </h1>
          <p className="landing-hero-sub">
            XGBoost machine-learning models compared against live Kalshi prediction
            market prices. Surfaces positive-EV opportunities with Kelly-optimal
            sizing — before the market adjusts.
          </p>
          <div className="landing-hero-actions">
            <button
              className="landing-cta-primary"
              onClick={() => navigate("/dashboard")}
              aria-label="Enter Dashboard"
            >
              Enter Dashboard →
            </button>
            <a href="#how-it-works" className="landing-cta-ghost" aria-label="Scroll to how it works">
              How it works ↓
            </a>
          </div>
          <div className="landing-hero-stats">
            <div className="landing-hero-stat">
              <span className="landing-hero-stat-value">68.9%</span>
              <span className="landing-hero-stat-label">ML Moneyline Accuracy</span>
            </div>
            <div className="landing-hero-stat-sep" />
            <div className="landing-hero-stat">
              <span className="landing-hero-stat-value">50.1%</span>
              <span className="landing-hero-stat-label">O/U Accuracy (50% baseline)</span>
            </div>
            <div className="landing-hero-stat-sep" />
            <div className="landing-hero-stat">
              <span className="landing-hero-stat-value">60s</span>
              <span className="landing-hero-stat-label">Market Refresh Rate</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature row ────────────────────────────────────────── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">How It Works</h2>
            <p className="landing-section-sub">
              Three data layers combined into a single edge signal.
            </p>
          </div>
          <div className="landing-features">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">📊</div>
              <h3 className="landing-feature-title">XGBoost Models</h3>
              <p className="landing-feature-body">
                Two gradient-boosted models — one for moneylines (68.9% accuracy),
                one for over/unders (50.1%) — trained on NBA team statistics
                including pace, efficiency, rest days, and home/away splits.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">📈</div>
              <h3 className="landing-feature-title">Kalshi Markets</h3>
              <p className="landing-feature-body">
                Live prediction market prices from Kalshi's NBA contracts. Market
                probabilities reflect real money being staked by informed participants —
                a stronger signal than book lines that include margin.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">🎯</div>
              <h3 className="landing-feature-title">Edge + EV Analysis</h3>
              <p className="landing-feature-body">
                Edge = model probability minus market probability. Expected Value
                is projected profit per $100 wagered. Kelly Criterion provides a
                mathematically optimal bet sizing fraction.
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
              Each market is classified by the model's confidence and edge level.
            </p>
          </div>
          <div className="landing-categories">
            {[
              { cat: "HOMERUN",     desc: "High conviction. Edge ≥10% and model probability ≥65%. Both thresholds must be met simultaneously." },
              { cat: "UNDERVALUED", desc: "Solid +EV. Edge ≥5%. Market is underpricing the team but model confidence is moderate." },
              { cat: "UNDERDOG",    desc: "Market pricing ≤38% win probability but model disagrees. High variance, positive EV when calibrated." },
              { cat: "SHARP",       desc: "Disciplined small-edge play. Edge between 3–5%. The type of bet professional bettors make in volume." },
              { cat: "FADE",        desc: "Negative edge. Model believes the market has this side overpriced. Avoid or fade." },
            ].map(({ cat, desc }) => (
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
              Understanding the system is part of using it responsibly.
            </p>
          </div>
          <div className="landing-transparency-grid">

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Data Sources</h4>
              <ul className="landing-transparency-list">
                <li><span className="landing-t-source">stats.nba.com</span> — team statistics (points, pace, efficiency, eFG%, TOV%, OREB%, DRTG) updated daily during the season</li>
                <li><span className="landing-t-source">BallDontLie API</span> — today's game schedule, live scores, period and time remaining</li>
                <li><span className="landing-t-source">Kalshi Trade API</span> — live moneyline, spread, and total market prices refreshed every 60 seconds</li>
              </ul>
            </div>

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">What the Model Accounts For</h4>
              <ul className="landing-transparency-list">
                <li>Season-to-date team offensive and defensive ratings</li>
                <li>Days of rest since last game (home and away)</li>
                <li>Home/away differential in team statistics</li>
                <li>Over/under line as a feature for totals prediction</li>
                <li>Blended probability with Kalshi market price via tunable weight</li>
              </ul>
            </div>

            <div className="landing-transparency-card landing-transparency-card--warning">
              <h4 className="landing-transparency-heading">What the Model Does NOT Account For</h4>
              <ul className="landing-transparency-list">
                <li>Player injuries or absences (including same-day scratches)</li>
                <li>Roster changes, trades, or load management decisions</li>
                <li>Real-time line movement or sharp money signals</li>
                <li>Travel fatigue beyond simple rest-day counting</li>
                <li>Referee assignments or pace-of-play tendencies</li>
                <li>Bookmaker limits, CLV, or market liquidity constraints</li>
                <li>In-game situational factors (foul trouble, momentum)</li>
              </ul>
            </div>

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Update Frequency</h4>
              <ul className="landing-transparency-list">
                <li><strong>Kalshi markets</strong> — live, refreshed every 60 seconds in the dashboard</li>
                <li><strong>Team statistics</strong> — cached 1 hour; reflects season-to-date averages</li>
                <li><strong>Game schedule</strong> — cached 24 hours; fetched fresh each day</li>
                <li><strong>Model weights</strong> — fixed; not retrained intra-season</li>
              </ul>
            </div>

          </div>

          <div className="landing-model-statement">
            Model outputs are <strong>probabilistic estimates</strong> based on historical patterns
            and current market prices. They represent statistical tendencies, not predictions of
            specific outcomes. Past model accuracy does not guarantee future performance.
            This tool should not be interpreted as financial advice, investment guidance,
            or a recommendation to place any wager.
          </div>
        </div>
      </section>

      {/* ── Disclaimers ────────────────────────────────────────── */}
      <section className="landing-section landing-section-alt" id="disclaimers">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Important Disclaimers</h2>
          </div>
          <div className="landing-disclaimers">
            <div className="landing-disclaimer">
              <span className="landing-disclaimer-icon">⚠️</span>
              <div>
                <strong>For Informational &amp; Analytical Purposes Only</strong>
                <p>This dashboard is a research and analytics tool. It does not constitute financial advice, investment guidance, or a recommendation to place any wager. The operator assumes no liability for decisions made based on the outputs displayed.</p>
              </div>
            </div>
            <div className="landing-disclaimer">
              <span className="landing-disclaimer-icon">⚠️</span>
              <div>
                <strong>Betting Carries Significant Financial Risk</strong>
                <p>Sports betting involves the risk of financial loss. Positive expected value is a statistical concept that applies over large sample sizes — individual results will vary significantly. Never bet more than you can afford to lose. If you or someone you know has a gambling problem, call the National Problem Gambling Helpline: <strong>1-800-522-4700</strong>.</p>
              </div>
            </div>
            <div className="landing-disclaimer">
              <span className="landing-disclaimer-icon">⚠️</span>
              <div>
                <strong>Data May Be Delayed or Incomplete</strong>
                <p>Market prices, team statistics, and game data are fetched from third-party APIs that may experience delays, outages, or inaccuracies. Odds data should be verified against the relevant sportsbook or exchange before placing any wager. The operator makes no warranty regarding data accuracy or completeness.</p>
              </div>
            </div>
          </div>
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
            aria-label="Enter Dashboard"
          >
            Enter Dashboard →
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="nav-brand">
            <div className="nav-logo">SB</div>
            <span className="nav-title">Sports Intel</span>
          </div>
          <p className="landing-footer-legal">
            Sports Intel is an independent analytics tool. It is not affiliated with,
            endorsed by, or sponsored by Kalshi, the NBA, DraftKings, FanDuel, or any
            other sports betting operator. All model outputs are for informational
            purposes only and do not constitute betting or financial advice.
            © {new Date().getFullYear()} Sports Intel.
          </p>
        </div>
      </footer>

    </div>
  );
}
