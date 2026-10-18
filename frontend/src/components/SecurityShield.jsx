import { useEffect, useRef, useState } from "react";
import { animateShieldLock, animateTickerScroll } from "../animations/loanAnimations";
import { animateDecrypt } from "../animations/counterAnimation";
import "../styles/modules.css";

export default function SecurityShield({ loading, riskScore, checkedFactors = [] }) {
  const ringRefs = [useRef(null), useRef(null), useRef(null)];
  const tickerRef = useRef(null);
  const [tickerLogs, setTickerLogs] = useState([]);

  useEffect(() => {
    if (loading) {
      // Mechanical locking animation
      animateShieldLock(ringRefs.map(r => r.current));
      
      // Generate some forensic logs for the ticker
      const logs = [
        "INITIALIZING AUDIT...",
        "SCANNING PERMISSIONS...",
        "CHECKING RBI REGISTRY...",
        "ANALYZING INTEREST RATES...",
        "VERIFYING DEVELOPER...",
        "DETECTING PRESSURE TACTICS...",
        "CALCULATING INTEGRITY..."
      ];
      setTickerLogs(logs);
      animateTickerScroll(".metadata-ticker");
    } else if (riskScore !== undefined) {
      // Animate integrity number on result
      animateDecrypt(".integrity-val .val-num", Math.max(0, 100 - riskScore));
    }
  }, [loading, riskScore]);

  const integrity = Math.max(0, 100 - riskScore);
  const isCompromised = riskScore > 40;

  return (
    <div className="sentinel-wrap">
      {/* ── Heatmap Grid Background ── */}
      <div className="heatmap-grid">
        {Array(20).fill(0).map((_, i) => (
            <div key={i} className={`grid-cell ${isCompromised ? 'hot' : ''}`}></div>
        ))}
      </div>

      <div className="sentinel-main">
        {/* ── Mechanical Shield SVG ── */}
        <div className="shield-viz">
          <svg viewBox="0 0 200 200" className="shield-svg">
            {/* Ring 1 */}
            <circle ref={ringRefs[0]} cx="100" cy="100" r="80" className="shield-ring outer" />
            {/* Ring 2 */}
            <circle ref={ringRefs[1]} cx="100" cy="100" r="60" className="shield-ring middle" />
            {/* Ring 3 */}
            <circle ref={ringRefs[2]} cx="100" cy="100" r="40" className="shield-ring inner" />
            
            {/* Central Icon */}
            <path 
                d="M100 70 L120 80 L120 110 L100 130 L80 110 L80 80 Z" 
                className={`shield-core ${isCompromised ? 'broken' : ''}`}
            />
          </svg>
          <div className="integrity-val mono">
            {loading ? "..." : <span className="val-num">0%</span>}
            <span className="sub">INTEGRITY</span>
          </div>
        </div>

        {/* ── Metadata Ticker ── */}
        <div className="metadata-ticker mono" ref={tickerRef}>
          {tickerLogs.map((log, i) => (
            <div key={i} className="ticker-line">{" > "} {log}</div>
          ))}
          {!loading && isCompromised && <div className="ticker-line err">!! SHIELD_COMPROMISED !!</div>}
          {!loading && !isCompromised && <div className="ticker-line ok">{" >> "} SYSTEM_SECURE</div>}
        </div>
      </div>
    </div>
  );
}
