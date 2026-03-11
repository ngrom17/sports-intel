import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ═══════════════════════════════════════════════════════════════
// SPORTS INTEL — Landing Page v3
// Design: premium dark analytics platform
// Responsive: mobile-first, 640 / 1024 / 1280 breakpoints
// iOS translation notes at bottom of this file
// ═══════════════════════════════════════════════════════════════

// ── B logo mark ────────────────────────────────────────────────
// Geometric B in a rounded-square container.
// Scales cleanly from 16px (favicon) → 512px (iOS app icon).
// iOS SwiftUI: replace with Image("AppIcon") or custom Shape.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Sports Intel">
      {/* Container */}
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      {/* Left stem */}
      <rect x="6" y="6" width="5" height="20" fill="white" />
      {/* Upper bowl — flat left at x=11, quadratic curve right */}
      <path d="M11 6H19Q24 6 24 10.5Q24 15 19 15H11Z" fill="white" />
      {/* Lower bowl — slightly wider, 2px gap from upper creates the B waist */}
      <path d="M11 17H20Q26 17 26 21.5Q26 26 20 26H11Z" fill="white" />
    </svg>
  );
}

// ── Category badge ─────────────────────────────────────────────
// iOS: Text + .padding(.horizontal, 8) + .background(Color(cat)) + .clipShape(Capsule())
function CategoryPill({ cat }: { cat: string }) {
  return <span className={`badge badge-${cat.toLowerCase().replace(/\s+/g, "-")}`}>{cat}</span>;
}

// ── Icon set (inline SVG, no dependency) ──────────────────────
// iOS equivalents: chart.xyaxis.line, arrow.up.right, clock, eye, square.stack.3d.up
const Ico = {
  Model: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  Market: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Edge: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" />
    </svg>
  ),
  Eye: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Layers: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Chevron: ({ open }: { open: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

// ── Dashboard preview (hero) ────────────────────────────────────
// Code-rendered mock showing the dashboard at a glance.
// Uses sample data styled identically to real pick rows.
// iOS: UITableView with custom PickCell / SwiftUI List { ForEach }
const SAMPLE_PICKS = [
  { cat: "HOMERUN",     game: "MEM vs BOS", title: "Memphis to win", odds: "+180", edge: "+16.2%", ev: "+$28.40" },
  { cat: "UNDERVALUED", game: "LAL vs PHX", title: "Lakers to win",  odds: "+105", edge: "+8.7%",  ev: "+$12.60" },
  { cat: "UNDERDOG",    game: "OKC vs DEN", title: "OKC to win",     odds: "+155", edge: "+6.1%",  ev: "+$9.30"  },
];

function DashboardPreview() {
  return (
    <div className="lp-preview" aria-hidden="true">
      {/* Header */}
      <div className="lp-preview-header">
        <div className="lp-preview-live">
          <span className="lp-live-dot" />
          <span>Live Markets</span>
        </div>
        <span className="lp-preview-tag">NBA</span>
      </div>

      {/* Pick rows */}
      {SAMPLE_PICKS.map((p, i) => (
        <div key={i} className="lp-preview-row">
          <div className="lp-preview-row-l">
            <CategoryPill cat={p.cat} />
            <div>
              <div className="lp-preview-game">{p.game}</div>
              <div className="lp-preview-title">{p.title}</div>
            </div>
          </div>
          <div className="lp-preview-row-r">
            <span className="odds-btn">{p.odds}</span>
            <div className="lp-preview-nums">
              <span className="positive">{p.edge}</span>
              <span className="positive">{p.ev}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="lp-preview-footer">
        <span>3 of 11 markets</span>
        <span>Updated 12s ago</span>
      </div>
    </div>
  );
}

// ── Signal category data ───────────────────────────────────────
const CATEGORIES = [
  { cat: "HOMERUN",     threshold: "Edge ≥ 10% · Prob ≥ 65%", desc: "Highest conviction. Both thresholds must be met simultaneously." },
  { cat: "UNDERVALUED", threshold: "Edge ≥ 5%",               desc: "Solid +EV. Market underpricing with moderate model confidence." },
  { cat: "UNDERDOG",    threshold: "Market ≤ 38%",             desc: "Market heavily discounts the team but the model disagrees." },
  { cat: "SHARP",       threshold: "Edge 3 – 5%",              desc: "Small-edge, low-variance play. Professional volume bet." },
  { cat: "FADE",        threshold: "Negative edge",            desc: "Market has overpriced this side. Avoid or counter." },
];

// ── Reusable icon tile ─────────────────────────────────────────
// iOS: ZStack { RoundedRectangle, Image(sfSymbol) }
function IconTile({ children }: { children: React.ReactNode }) {
  return <div className="lp-icon-tile">{children}</div>;
}

// ══════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════
export default function Landing() {
  const navigate = useNavigate();
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [limitsOpen,     setLimitsOpen]     = useState(false);

  return (
    <div className="landing">

      {/* ── Navbar ──────────────────────────────────────────────
          iOS: NavigationStack top bar / custom HStack header    */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="nav-brand">
            <LogoMark size={28} />
            <span className="nav-title">Sports Intel</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="#how-it-works" className="lp-nav-link">How it works</a>
            <button className="landing-nav-cta" onClick={() => navigate("/dashboard")}>
              Enter Dashboard →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────
          2-col on desktop (copy left / preview right)
          1-col centered on mobile + tablet
          iOS: VStack { heroText, previewCard }                 */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="lp-hero-inner">

            {/* Left — copy */}
            <div className="lp-hero-copy">
              <div className="lp-eyebrow">
                <span className="lp-live-dot" />
                NBA · Kalshi Markets
              </div>

              <h1 className="landing-hero-title">
                Betting Edge,<br />Quantified.
              </h1>

              <p className="landing-hero-sub">
                XGBoost models meet live Kalshi prediction markets.
                Surface +EV opportunities with Kelly-optimal sizing.
              </p>

              <div className="landing-hero-actions">
                <button className="landing-cta-primary" onClick={() => navigate("/dashboard")}>
                  Enter Dashboard →
                </button>
                <a href="#how-it-works" className="landing-cta-ghost">
                  How it works ↓
                </a>
              </div>

              {/* Trust strip — factual only
                  iOS: ScrollView(.horizontal) { HStack } */}
              <div className="lp-trust-strip">
                <span className="lp-trust-item">Live Kalshi data</span>
                <span className="lp-trust-sep" />
                <span className="lp-trust-item">Kelly sizing</span>
                <span className="lp-trust-sep" />
                <span className="lp-trust-item">60s refresh</span>
                <span className="lp-trust-sep" />
                <span className="lp-trust-item">Full transparency</span>
              </div>
            </div>

            {/* Right — dashboard preview
                Hidden on mobile (<640px), shown tablet+
                iOS: conditionally rendered or in HStack       */}
            <div className="lp-hero-preview-wrap">
              <DashboardPreview />
            </div>

          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────
          Numbered 3-step layout
          iOS: LazyHGrid (iPad) / VStack (iPhone)              */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">How It Works</h2>
            <p className="landing-section-sub">Three data layers. One edge signal.</p>
          </div>
          <div className="landing-features">

            <div className="landing-feature-card">
              <div className="lp-step">01</div>
              <IconTile><Ico.Model /></IconTile>
              <h3 className="landing-feature-title">Model Probabilities</h3>
              <p className="landing-feature-body">
                XGBoost trained on NBA team stats — pace, efficiency,
                rest days, home/away splits. A win probability for every market.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="lp-step">02</div>
              <IconTile><Ico.Market /></IconTile>
              <h3 className="landing-feature-title">Live Market Prices</h3>
              <p className="landing-feature-body">
                Kalshi prediction market prices refreshed every 60 seconds.
                Real money, no sportsbook margin — a cleaner probability signal.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="lp-step">03</div>
              <IconTile><Ico.Edge /></IconTile>
              <h3 className="landing-feature-title">Edge + Sizing</h3>
              <p className="landing-feature-body">
                Edge = model prob − market prob. EV = projected profit per $100.
                Kelly Criterion sizes each bet to the edge.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Why It's Different ──────────────────────────────────
          3 value props distinguishing from typical tools
          iOS: LazyVGrid(columns: 3) on iPad, VStack on iPhone */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Why It's Different</h2>
            <p className="landing-section-sub">Not another odds aggregator.</p>
          </div>
          <div className="lp-why-grid">

            <div className="lp-why-card">
              <IconTile><Ico.Market /></IconTile>
              <h3 className="lp-why-title">Prediction markets, not books</h3>
              <p className="lp-why-body">
                Kalshi prices reflect real-money participants with no vigorish.
                The probability signal is cleaner than any sportsbook line.
              </p>
            </div>

            <div className="lp-why-card">
              <IconTile><Ico.Eye /></IconTile>
              <h3 className="lp-why-title">Methodology first</h3>
              <p className="lp-why-body">
                We document exactly what the model can and can't see.
                Injuries, trades, and line movement are all out of scope — and we say so.
              </p>
            </div>

            <div className="lp-why-card">
              <IconTile><Ico.Layers /></IconTile>
              <h3 className="lp-why-title">Structured signals</h3>
              <p className="lp-why-body">
                Five categories from HOMERUN to FADE. Every opportunity is
                classified, sized, and ranked — not a raw number dump.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Signal Categories ───────────────────────────────────
          Card grid: 1-col mobile, 2-col tablet, 3-col desktop
          iOS: LazyVGrid(columns: [GridItem(.adaptive(min:160))]) */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Signal Categories</h2>
            <p className="landing-section-sub">Every market classified before you see it.</p>
          </div>
          <div className="lp-cat-grid">
            {CATEGORIES.map(({ cat, threshold, desc }) => (
              <div key={cat} className="lp-cat-card">
                <div className="lp-cat-top">
                  <CategoryPill cat={cat} />
                  <code className="lp-cat-threshold">{threshold}</code>
                </div>
                <p className="lp-cat-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Model Transparency ──────────────────────────────────
          3 always-visible cards + 1 collapsible limitations
          iOS: cards → VStack, limits → DisclosureGroup        */}
      <section className="landing-section landing-section-alt" id="model">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Model Transparency</h2>
            <p className="landing-section-sub">Understand the system before you use it.</p>
          </div>

          <div className="landing-transparency-grid">

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Data Sources</h4>
              <ul className="landing-transparency-list">
                <li><span className="landing-t-source">stats.nba.com</span> — team stats, updated daily</li>
                <li><span className="landing-t-source">BallDontLie</span> — schedule and live scores</li>
                <li><span className="landing-t-source">Kalshi API</span> — live market prices, 60s refresh</li>
              </ul>
            </div>

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Model Inputs</h4>
              <ul className="landing-transparency-list">
                <li>Offensive and defensive ratings (season-to-date)</li>
                <li>Rest days since last game</li>
                <li>Home/away statistical splits</li>
                <li>Kalshi market price as blended input</li>
              </ul>
            </div>

            <div className="landing-transparency-card">
              <h4 className="landing-transparency-heading">Update Cadence</h4>
              <ul className="landing-transparency-list">
                <li><strong>Kalshi</strong> — live, every 60 seconds</li>
                <li><strong>Team stats</strong> — cached 1 hour</li>
                <li><strong>Schedule</strong> — cached 24 hours</li>
                <li><strong>Model weights</strong> — fixed, not retrained intra-season</li>
              </ul>
            </div>

            {/* Collapsible limitations
                iOS: DisclosureGroup("What It Doesn't Cover") { list } */}
            <div className="landing-transparency-card landing-transparency-card--warning">
              <button className="lp-collapsible-header" onClick={() => setLimitsOpen(o => !o)} aria-expanded={limitsOpen}>
                <h4 className="landing-transparency-heading" style={{ margin: 0 }}>What the Model Doesn't Cover</h4>
                <Ico.Chevron open={limitsOpen} />
              </button>
              {limitsOpen && (
                <ul className="landing-transparency-list" style={{ marginTop: 12 }}>
                  <li>Player injuries or same-day scratches</li>
                  <li>Roster changes, trades, load management</li>
                  <li>Real-time sharp money or line movement</li>
                  <li>Travel fatigue beyond rest-day counting</li>
                  <li>In-game situational factors</li>
                </ul>
              )}
            </div>

          </div>

          <p className="landing-model-statement">
            Outputs are <strong>probabilistic estimates</strong> based on historical patterns.
            Past accuracy does not guarantee future results. Not financial advice.
          </p>
        </div>
      </section>

      {/* ── Disclaimers — compact accordion ─────────────────────
          Collapsed by default; legally present, not dominant
          iOS: DisclosureGroup                                  */}
      <section className="landing-section">
        <div className="landing-container">
          <button className="lp-disclaimer-toggle" onClick={() => setDisclaimerOpen(o => !o)} aria-expanded={disclaimerOpen}>
            <span>Important Disclaimers</span>
            <Ico.Chevron open={disclaimerOpen} />
          </button>
          {disclaimerOpen && (
            <div className="lp-disclaimer-body">
              <div className="landing-disclaimer">
                <div>
                  <strong>For Informational Purposes Only</strong>
                  <p>A research tool, not financial advice or a recommendation to place any wager. The operator assumes no liability for decisions made based on these outputs.</p>
                </div>
              </div>
              <div className="landing-disclaimer">
                <div>
                  <strong>Betting Carries Real Financial Risk</strong>
                  <p>Positive EV is a statistical concept applying over large samples — individual results vary significantly. Never bet more than you can afford to lose. Problem gambling helpline: <strong>1-800-522-4700</strong>.</p>
                </div>
              </div>
              <div className="landing-disclaimer">
                <div>
                  <strong>Data May Be Delayed or Incomplete</strong>
                  <p>Prices and statistics are sourced from third-party APIs and may have delays or inaccuracies. Verify before acting on any data shown here.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────
          iOS: sticky bottom CTA bar or sheet                  */}
      <section className="landing-section landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <h2 className="landing-cta-title">Ready to explore?</h2>
          <p className="landing-cta-sub">Live NBA markets. Real edge signals. Full model transparency.</p>
          <button className="landing-cta-primary" onClick={() => navigate("/dashboard")}>
            Enter Dashboard →
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="nav-brand">
            <LogoMark size={22} />
            <span className="nav-title">Sports Intel</span>
          </div>
          <p className="landing-footer-legal">
            Independent analytics tool. Not affiliated with Kalshi, the NBA, or any sportsbook.
            Outputs are for informational purposes only.
            © {new Date().getFullYear()} Sports Intel.
          </p>
        </div>
      </footer>

      {/*
       * ═══════════════════════════════════════════════════════════
       * FUTURE iOS TRANSLATION NOTES
       * ═══════════════════════════════════════════════════════════
       *
       * Design Tokens → Assets.xcassets colors:
       *   --accent       → AccentBlue   #1a6dff
       *   --bg-base      → Background   #0b0c10
       *   --bg-surface   → Surface      #13141a
       *   --bg-elevated  → Elevated     #1c1d27
       *   --border       → Border       #252633
       *   --text-primary → TextPrimary  #f0f0f8
       *   --text-muted   → TextMuted    #5c5f7a
       *   --positive     → Positive     #2ed573
       *   --negative     → Negative     #ff4757
       *
       * Component Mapping:
       *   LogoMark              → Image("AppIcon") or custom Shape + fill
       *   landing-nav           → HStack in ZStack overlay (top)
       *   landing-cta-primary   → Button { }.buttonStyle(FilledAccentStyle())
       *   landing-cta-ghost     → Button { }.buttonStyle(OutlinedStyle())
       *   landing-feature-card  → VStack in LazyHGrid / LazyVGrid
       *   lp-why-card           → same as above
       *   lp-cat-card           → VStack in LazyVGrid(adaptive min: 160)
       *   CategoryPill          → Text.padding(.horizontal,8).background.clipShape(Capsule())
       *   DashboardPreview      → GroupBox or RoundedRectangle card with List
       *   lp-live-dot (pulse)   → Circle().foregroundColor(.green).scaleEffect(animating)
       *   lp-trust-strip        → ScrollView(.horizontal) { HStack }
       *   lp-collapsible-header → DisclosureGroup label
       *   landing-transparency  → LazyVGrid(columns: 2)
       *   lp-disclaimer-toggle  → DisclosureGroup
       *   landing-cta-section   → VStack pinned bottom or sheet
       *
       * Navigation:
       *   Nav "Enter Dashboard →" → NavigationLink or TabView tab switch
       *   "How it works ↓"       → ScrollViewReader.scrollTo("howItWorks")
       *
       * Responsive Equivalents:
       *   <640px   (iPhone SE/14/15)     → .compact size class
       *   640-1024 (iPad mini / Air)     → .regular size class, horizontal layout
       *   1024+    (iPad Pro / Mac)      → .regular + larger containers
       * ═══════════════════════════════════════════════════════════
       */}
    </div>
  );
}
