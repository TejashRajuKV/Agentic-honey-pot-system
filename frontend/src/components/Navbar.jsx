import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getSystemStatus } from "../api/api";
import "../styles/global.css";

const NAV_LINKS = [
  { label: "Home",      target: "/" },
  { label: "Modules",   target: "#modules" },
  { label: "Status",    target: "#status" },
  { label: "Dashboard", target: "/dashboard" },
  { label: "Honeypot",  target: "/dashboard", state: { tab: "honeypot" } },
];

export default function Navbar({ theme, toggleTheme }) {
  const [online, setOnline] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [clock, setClock] = useState(new Date());
  const navigate = useNavigate();
  const location = useLocation();

  // Hide the bar entirely while the hero video is the focus — only on
  // the home page, only until the user scrolls past it.
  const isHome = location.pathname === "/";
  const hideForVideo = isHome && !scrolled;

  useEffect(() => {
    // LIVE only when the whole platform is operational: gateway + ML engine + database
    const poll = () =>
      getSystemStatus()
        .then((st) => setOnline(Boolean(st?.operational)))
        .catch(() => setOnline(false));
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Scroll-aware condensed state ──
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Live clock ──
  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleNav = (target, state) => {
    if (target.startsWith("#")) {
      document.getElementById(target.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(target, state ? { state } : undefined);
    }
  };

  const timeStr = clock.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <nav className={`navbar technical-status-bar ${scrolled ? "is-scrolled" : ""} ${hideForVideo ? "is-hidden" : ""}`}>
      <div className="container nav-container-simplified">
        {/* ── Brand ── */}
        <Link to="/" className="navbar-brand">
          <svg className="brand-mark" viewBox="0 0 24 26" fill="none">
            <path d="M12 1 L22 5 V13 C22 19 17.5 23 12 25 C6.5 23 2 19 2 13 V5 Z" stroke="currentColor" strokeWidth="2" />
            <path d="M7.5 13 L10.5 16 L16.5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CYBERRAKSHAK
        </Link>

        {/* ── Nav Links ── */}
        <div className="navbar-links">
          {NAV_LINKS.map((link) => (
            <button key={link.label} className="navbar-link" onClick={() => handleNav(link.target, link.state)}>
              {link.label}
            </button>
          ))}
        </div>

        {/* ── Controls ── */}
        <div className="navbar-controls-group mono">

          <div className="navbar-clock">
            <span className="clock-time">{timeStr}</span>
            <span>UTC+5:30</span>
          </div>

          {/* ── Theme Toggle ── */}
          <div className="theme-toggle-container" onClick={toggleTheme}>
            <div className={`theme-switch-forensic ${theme}`}>
                <div className="switch-dial"></div>
            </div>
            <span className="label">{theme.toUpperCase()}</span>
          </div>

          <div className="status-divider">|</div>

          {/* ── Backend Status ── */}
          <div className="backend-status-wrap">
            <div className={`status-dot ${online ? 'online' : 'offline'}`}></div>
            <span className={`status-text ${online ? 'text-green' : 'text-red'}`}>
              {online ? "LIVE" : "OFFLINE"}
            </span>
          </div>

          <button className="navbar-cta" onClick={() => navigate("/dashboard")}>
            OPEN DASHBOARD →
          </button>

        </div>
      </div>
    </nav>
  );
}
