import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SketchDefs        from "../components/SketchDefs";
import GlidingScanner     from "../components/GlidingScanner";
import HeroSpectrumRing  from "../components/HeroSpectrumRing";
import SpectrumRingStory from "../components/SpectrumRingStory";
import ShieldBranchIllustration from "../components/icons/ShieldBranchIllustration";
import {
  initScrollReveal,
  initStaggerReveal,
  initParallax,
  initAnimatedCounters,
  initMagneticButtons,
  launchCardTransition,
} from "../animations/homeAnimations";
import {
  initPerspectiveScroll,
  initSection3DEntrance,
  initCard3DTilt,
} from "../animations/scroll3D";
import useSystemStatus from "../hooks/useSystemStatus";
import "../styles/Home.css";

const MODULES = [
  { id: "scam",     icon: "🎯", image: "/cyber/1.png", title: "SCAM RADAR",       desc: "NLP-driven pattern recognition for message-based fraud.",           tags: ["TF-IDF", "NLP"] },
  { id: "behavior", icon: "📊", image: "/cyber/2.png", title: "BEHAVIOR MONITOR", desc: "Sequence anomaly detection for user interactions.",                  tags: ["ISO FOREST", "SVM"] },
  { id: "news",     icon: "📰", image: "/cyber/3.png", title: "FAKE NEWS",        desc: "Stance detection and credibility cross-referencing.",                tags: ["BERT", "STANCE"] },
  { id: "loan",     icon: "⚖️", image: "/cyber/4.png", title: "LOAN SCANNER",     desc: "RBI regulatory compliance and predatory audit.",                    tags: ["AUDIT", "COMPLY"] },
  { id: "phishing", icon: "🎣", image: "/cyber/5.png", title: "PHISHING LINK",    desc: "Real-time URL heuristic and redirect mapping.",                     tags: ["HEURISTIC", "WHOIS"] },
  { id: "threat",   icon: "🔎", image: "/cyber/6.png", title: "THREAT ANALYZER",  desc: "Unified correlation engine for risk scoring.",                      tags: ["FUSION", "CORE"] },
  { id: "honeypot", icon: "🐝", image: "/cyber/7.png", title: "HONEYPOT OPS",     desc: "Live intelligence feed from the Agentic Honeypot engagement system.", tags: ["AGENT", "HONEYPOT"] },
];

const fmtUptime = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
};

function StatusRow({ label, pct, value }) {
  return (
    <div className="status-row">
      <span className="status-row-label">{label}</span>
      <div className="status-row-bar"><div className="status-row-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="status-row-value">{value}</span>
    </div>
  );
}

const TECH_STACK = ["React", "Node.js", "Flask", "MongoDB", "scikit-learn", "Google Gemini"];

export default function Home() {
  const navigate = useNavigate();
  const heroRef  = useRef(null);
  const worldRef = useRef(null);
  const cardRefs = useRef({});
  const [launchingId, setLaunchingId] = useState(null);
  const { status: sys, error: sysError } = useSystemStatus();

  // ── Pokémon-style select: card pops up big, then opens its shield page ──
  const handleModuleSelect = (m, index) => {
    if (launchingId) return; // ignore double-clicks mid-transition
    const el = cardRefs.current[index];
    setLaunchingId(m.id);
    launchCardTransition(el, () => {
      navigate("/dashboard", { state: { tab: m.id } });
    });
  };

  const operational = Boolean(sys?.operational);
  const mlMods = Object.values(sys?.ml?.modules || {});
  const mlTotal = mlMods.length || 4;
  const mlLoaded = mlMods.filter(Boolean).length;
  const mlPct = sys?.ml?.reachable ? Math.round((mlLoaded / mlTotal) * 100) : 0;
  const stats = [
    { num: "07",     label: "ACTIVE FORENSIC MODULES", color: "var(--cyan)", counter: true },
    { num: sys?.db?.connected ? String(sys.db.sessions ?? 0) : "—", label: "SESSIONS ANALYZED", color: "var(--cyan)" },
    { num: sys?.db?.connected ? String(sys.db.scamSessions ?? 0) : "—", label: "SCAMS INTERCEPTED", color: "var(--white)" },
    { num: sys ? (operational ? "LIVE" : "DEGRADED") : sysError ? "OFFLINE" : "…", label: "THREAT MONITOR STATUS", color: operational ? "var(--green)" : "var(--red)" }
  ];

  // ── Cinematic entrance + scroll-driven animations ──
  useEffect(() => {
    const cleanups = [
      initParallax(heroRef.current, "[data-parallax]"),
      initStaggerReveal(".home-modules-showcase .grid-3-col", ".dossier-card", { stagger: 90 }),
      initScrollReveal(".section-label-technical, .section-title", { distance: 30, duration: 700 }),
      initAnimatedCounters("[data-counter]"),
      initMagneticButtons(".btn-technical, .btn-outline-technical"),
    ];

    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  // ── 3D perspective scroll + section depth + card tilt ──
  useEffect(() => {
    const c1 = initPerspectiveScroll(worldRef.current);
    const c2 = initSection3DEntrance(".scroll-3d-section");
    // Module cards get their own dedicated Netflix-style hover-expand
    // (CSS-driven) instead of the mouse-tilt effect, so the two don't
    // fight over the element's `transform`.
    const c3 = initCard3DTilt(".dossier-card:not(.module-card), .report-card:not(.ring-story-card), .stat-card");
    return () => { c1(); c2(); c3(); };
  }, []);

  return (
    <div className="home-root">
      <SketchDefs />
      {launchingId && <div className="module-launch-backdrop" />}

      <div className="hero-side-label">
        <span>CYBER THREAT INTELLIGENCE, REIMAGINED</span>
        <span className="year">2026</span>
      </div>

      {/* ── SECTION 00: DOSSIER HERO ── */}
      <section className="home-hero dossier-layout" ref={heroRef}>
        {/* Theme-aware hero artwork — CSS swaps the background-image when
            `.dark-theme` is on <body>, same pattern as the footer banner. */}
        <div className="hero-bg-img" role="img" aria-label="A cloaked traveler and wolf overlooking a guarded valley at dusk" />

        <HeroSpectrumRing />

        {/* Parallax depth layers — react to cursor movement */}
        <div className="hero-parallax-orb orb-cyan" data-parallax="35" />
        <div className="hero-parallax-orb orb-amber" data-parallax="55" />

        <div className="container hero-cta-overlay">
          <div className="hero-actions dossier-actions fade-up" style={{ margin: 0, display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-sketch-pill" onClick={() => navigate("/dashboard")}>
              Open Case File <span className="arrow">→</span>
            </button>
            <button className="btn-sketch-pill-outline" onClick={() => document.getElementById('modules').scrollIntoView({ behavior: 'smooth' })}>
              View Forensic Shields <span className="arrow">↓</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 01: SCROLL-DRIVEN SPECTRUM RING / THREAT INTEL REPORT ──
          Lives outside .scroll-3d-world deliberately: that wrapper has a
          continuous (if currently identity) rotateX transform from
          initPerspectiveScroll, and any non-`none` ancestor transform
          breaks `position: sticky` scroll-pinning the same way it broke
          `position: fixed` in the module-card launch transition (see that
          component's own notes). Keeping this section a sibling of
          .scroll-3d-stage, not a descendant, avoids that entirely. */}
      <SpectrumRingStory />

      {/* ── 3D WORLD WRAPPER — everything below hero gets perspective tilt ── */}
      <div className="scroll-3d-stage">
      <div className="scroll-3d-world" ref={worldRef}>

      {/* ── STATS ROW ── */}
      <div className="container">
        <div className="stats-row technical-grid fade-up">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card technical-card">
              <div className="stat-num mono" style={{ color: stat.color }} {...(stat.counter ? { "data-counter": stat.num } : {})}>
                 {stat.num}
              </div>
              <div className="stat-label mono">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <GlidingScanner />

      {/* ── CINEMATIC DEFENSE SHOWCASE VIDEO ── */}
      <section className="home-cinematic-showcase scroll-3d-section" style={{ padding: '60px 0' }}>
        <div className="container">
          <div className="cinematic-split-layout">
            {/* Left: Text */}
            <div className="cinematic-split-text">
              <div className="section-label-technical mono" style={{ marginBottom: "20px" }}>
                <span className="idx">/02.5</span> // GUARDIAN VISION
              </div>
              <h3 className="cinematic-h3" style={{ color: 'var(--white)' }}>
                Standing Guard Over <br/>
                <span className="serif-highlight">Digital Bharat</span>
              </h3>
              <p className="cinematic-p" style={{ color: 'var(--text)', marginTop: '20px' }}>
                Autonomous threat surveillance monitoring digital vectors in real time to safeguard citizens nationwide.
              </p>
            </div>

            {/* Right: Video */}
            <div className="cinematic-split-video">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="cinematic-video-player"
                src="/traveler-video.mp4"
              />
            </div>
          </div>
        </div>
      </section>


      {/* ── DASHED JOURNEY PATH ── */}
      <div className="container" style={{ overflow: 'hidden' }}>
        <svg className="sweeping-dashed-path" viewBox="0 0 1200 60" fill="none" preserveAspectRatio="none">
          <path d="M 0 30 Q 300 55 600 20 T 1200 30" stroke="var(--border)" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
        </svg>
      </div>

      {/* ── SECTION 02: FORENSIC MODULES ── */}
      <section className="home-modules-showcase technical-section scroll-3d-section" id="modules">
        <div className="container">
          <div className="modules-header-row">
            <div className="modules-branch-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <ShieldBranchIllustration className="modules-branch-illustration" />
              <div className="mono" style={{ fontSize: '10px', letterSpacing: '2.4px', color: 'var(--muted)', textAlign: 'center', lineHeight: '1.7', borderTop: '1.5px solid var(--border)', paddingTop: '10px', minWidth: '140px' }}>
                <div style={{ color: 'var(--white)', fontWeight: 700, letterSpacing: '2.6px' }}>ONE CORE</div>
                <div style={{ fontSize: '9px', opacity: 0.85 }}>SEVEN SHIELDS</div>
                <div style={{ marginTop: '6px', fontSize: '9px', letterSpacing: '1.6px', color: 'var(--cyan)' }}>07 ACTIVE MODULES</div>
              </div>
            </div>
            <div className="modules-header-text">
              <div className="section-label-technical mono">
                <span className="idx">/03</span> // AI ENGINE CAPABILITIES
              </div>
              <h2 className="section-title technical-h2">
                Seven Active <br/>
                <span className="serif-highlight">Forensic Shields</span>
              </h2>
              <p className="modules-header-desc">
                One defense core, seven specialized shields — each module branches from the same threat-intelligence engine to guard a different part of your digital life.
              </p>
            </div>
          </div>
          <div className="grid-3-col module-grid">
            {MODULES.map((m, i) => (
              <div
                key={i}
                ref={(el) => (cardRefs.current[i] = el)}
                className={`module-card dossier-card ${launchingId === m.id ? "is-launching" : ""}`}
                onClick={() => handleModuleSelect(m, i)}
              >
                <div className="dossier-card-thumb">
                  {m.image ? (
                    <img src={m.image} alt={m.title} className="dossier-card-img" />
                  ) : (
                    m.icon
                  )}
                </div>
                <div className="dossier-card-body">
                  <div className="card-top mono">
                    <span>#MOD-0{i + 1}</span>
                    <span className="card-arrow">↗</span>
                  </div>
                  <h3 className="m-title">{m.title}</h3>
                  <div className="dossier-card-extra">
                    <p className="t-desc">{m.desc}</p>
                    <div className="m-tags mono">
                      {m.tags.map(tag => <span key={tag} className="m-tag">{tag}</span>)}
                    </div>
                    <div className="dossier-card-cta mono">OPEN SHIELD <span className="card-arrow">→</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHED JOURNEY PATH ── */}
      <div className="container" style={{ overflow: 'hidden' }}>
        <svg className="sweeping-dashed-path" viewBox="0 0 1200 60" fill="none" preserveAspectRatio="none">
          <path d="M 0 20 Q 400 50 800 15 T 1200 35" stroke="var(--border)" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
        </svg>
      </div>

      {/* ── SECTION 03: SYSTEM STATUS ── */}
      <section className="home-status technical-section scroll-3d-section" id="status">
        <div className="container">
          <div className="section-label-technical mono">
            <span className="idx">/04</span> // LIVE SYSTEM STATUS
          </div>

          <h2 className="section-title technical-h2">
            Engine <br/>
            <span className="serif-highlight">Diagnostics</span>
          </h2>

          <div className="status-panel-grid">
            <div className="status-panel-col">
              <StatusRow label="ML DETECTION ENGINE" pct={mlPct} value={sys ? `${mlLoaded}/${mlTotal} MODELS` : "…"} />
              <StatusRow label="THREAT DATABASE" pct={sys?.db?.connected ? 100 : 0} value={sys?.db?.connected ? "CONNECTED" : "DOWN"} />
              <StatusRow label="HONEYPOT AGENT" pct={sys?.agent ? 100 : 0} value={sys?.agent ? "READY" : "…"} />
              <div className="status-row latency-row">
                <span className="status-row-label">ML RESPONSE LATENCY</span>
                <div className="latency-indicator">
                  <span className="status-row-value">{sys?.ml?.latencyMs != null ? `${sys.ml.latencyMs}ms` : "—"}</span>
                  <span className="latency-nominal mono">{sys?.ml?.reachable ? "NOMINAL" : "UNREACHABLE"}</span>
                  <span className="latency-wave" aria-hidden><i></i><i></i><i></i></span>
                </div>
              </div>

              <div className={`status-operational-chip ${operational ? "lime-chip" : ""}`}>
                <span className="dot"></span> {sys ? (operational ? "ALL SYSTEMS OPERATIONAL" : "DEGRADED — CHECK ENGINE / DATABASE") : sysError ? "GATEWAY UNREACHABLE" : "CHECKING SYSTEMS…"}
              </div>
            </div>

            <div className="status-panel-col">
              <div className="status-feed-line">
                <span>[ML] CYBERRAKSHAK_ENGINE</span>
                <span className="text-cyan">{sys?.ml?.reachable ? `ONLINE${sys.ml.pid ? ` · PID ${sys.ml.pid}` : ""}` : "OFFLINE"}</span>
              </div>
              <div className="status-feed-line">
                <span>[DB] MONGODB_LINK</span>
                <span className="text-cyan">{sys?.db?.connected ? `CONNECTED · ${sys.db.latencyMs ?? "?"}ms` : "DISCONNECTED"}</span>
              </div>
              <div className="status-feed-line">
                <span>[AI] AGENT_MODE</span>
                <span className="text-cyan">{sys?.agent?.mode ? sys.agent.mode.toUpperCase() : "…"}</span>
              </div>
              <div className="status-feed-line">
                <span>[API] GATEWAY_UPTIME</span>
                <span className="text-cyan">{sys?.api ? fmtUptime(sys.api.uptimeSec) : "…"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TECH STACK ROW ── */}
      <section className="technical-section scroll-3d-section" style={{ paddingTop: "0", paddingBottom: "40px", borderTop: "none" }}>
        <div className="container">
          <div className="section-label-technical mono">
            <span className="idx">/05</span> // BUILT WITH
          </div>
          <div className="tech-stack-row" style={{ borderTop: "2px solid var(--border)", borderBottom: "2px solid var(--border)" }}>
            {TECH_STACK.map((t) => (
              <div className="tech-stack-item" key={t}>
                <span className="dot"></span> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EDITORIAL ARTWORK FOOTER ── */}
      <footer className="editorial-art-footer">
        <div className="container editorial-footer-container">
          <div className="editorial-footer-main">
            {/* Left Brand & Headline Column */}
            <div className="editorial-footer-brand">
              <div className="editorial-logo-badge">
                <svg className="editorial-logo-mark" viewBox="0 0 24 26" fill="none">
                  <path d="M12 1 L22 5 V13 C22 19 17.5 23 12 25 C6.5 23 2 19 2 13 V5 Z" stroke="currentColor" strokeWidth="2.2" />
                  <path d="M7.5 13 L10.5 16 L16.5 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="editorial-logo-text-group">
                  <span className="editorial-brand-name">CYBER RAKSHAK</span>
                  <span className="editorial-brand-sub">SAFER TOMORROW</span>
                </div>
              </div>

              <h2 className="editorial-footer-headline">
                A Safer <br />Digital Tomorrow.
              </h2>
              <p className="editorial-footer-sub">
                Together, we build a more trustworthy, aware and secure cyberspace.
              </p>
            </div>

            {/* Right Navigation & Social Columns */}
            <div className="editorial-footer-nav-wrap">
              <div className="editorial-nav-columns">
                <div className="editorial-nav-col">
                  <h4 className="editorial-col-title">Product</h4>
                  <ul className="editorial-link-list">
                    <li><button onClick={() => document.getElementById('modules').scrollIntoView({ behavior: 'smooth' })}>Features</button></li>
                    <li><button onClick={() => navigate("/dashboard")}>Use Cases</button></li>
                    <li><button onClick={() => document.getElementById('engine').scrollIntoView({ behavior: 'smooth' })}>How It Works</button></li>
                    <li><button onClick={() => navigate("/dashboard")}>Pricing</button></li>
                  </ul>
                </div>

                <div className="editorial-nav-col">
                  <h4 className="editorial-col-title">Company</h4>
                  <ul className="editorial-link-list">
                    <li><button onClick={() => navigate("/")}>About</button></li>
                    <li><button onClick={() => document.getElementById('modules').scrollIntoView({ behavior: 'smooth' })}>Our Mission</button></li>
                    <li><button onClick={() => navigate("/")}>Careers</button></li>
                    <li><button onClick={() => navigate("/dashboard")}>Contact</button></li>
                  </ul>
                </div>

                <div className="editorial-nav-col">
                  <h4 className="editorial-col-title">Resources</h4>
                  <ul className="editorial-link-list">
                    <li><button onClick={() => navigate("/dashboard")}>Blog</button></li>
                    <li><button onClick={() => navigate("/dashboard")}>Documentation</button></li>
                    <li><button onClick={() => document.getElementById('status').scrollIntoView({ behavior: 'smooth' })}>Security Updates</button></li>
                    <li><button onClick={() => navigate("/")}>FAQ</button></li>
                  </ul>
                </div>
              </div>

              {/* Social Round Buttons */}
              <div className="editorial-social-row">
                <a href="https://github.com" target="_blank" rel="noreferrer" className="social-round-btn" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="social-round-btn" aria-label="LinkedIn">
                  <span className="icon-text">in</span>
                </a>
                <a href="https://x.com" target="_blank" rel="noreferrer" className="social-round-btn" aria-label="X">
                  <span className="icon-text">𝕏</span>
                </a>
                <a href="https://youtube.com" target="_blank" rel="noreferrer" className="social-round-btn" aria-label="YouTube">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Divider Bar */}
          <div className="editorial-footer-bottom">
            <div className="editorial-copyright">
              © 2026 Cyber Rakshak. All rights reserved.
            </div>
            <div className="editorial-motto">
              Security &nbsp;•&nbsp; Awareness &nbsp;•&nbsp; Resilience
            </div>
          </div>
        </div>


      </footer>

      {/* ── Close 3D world wrappers ── */}
      </div>{/* scroll-3d-world */}
      </div>{/* scroll-3d-stage */}

    </div>
  );
}
