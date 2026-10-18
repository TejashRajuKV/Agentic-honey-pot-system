import { useEffect, useRef } from "react";
import { animateURLTrace } from "../animations/phishingAnimations";
import "../styles/modules.css";

export default function URLTrace({ loading, url, isPhishing }) {
  const traceRef = useRef(null);

  useEffect(() => {
    if (loading && traceRef.current) {
        animateURLTrace(traceRef.current, isPhishing);
    }
  }, [loading, isPhishing]);

  if (!loading && !url) return null;

  return (
    <div className="trace-container">
      <div className="trace-visual">
        <svg viewBox="0 0 400 100" className="trace-svg">
          {/* Path Line */}
          <path 
            className="trace-line"
            d="M 20 50 L 380 50" 
            fill="none" 
            stroke="var(--border)" 
            strokeWidth="2" 
            strokeDasharray="400"
            strokeDashoffset="400"
          />
          
          {/* Checkpoints */}
          <g className="checkpoint cp-1">
            <circle cx="50" cy="50" r="8" className="cp-bg" />
            <text x="50" y="75" className="cp-label">PROTOCOL</text>
          </g>
          <g className="checkpoint cp-2">
            <circle cx="200" cy="50" r="8" className="cp-bg" />
            <text x="200" y="75" className="cp-label">DOMAIN</text>
          </g>
          <g className="checkpoint cp-3">
            <circle cx="350" cy="50" r="8" className="cp-bg" />
            <text x="350" y="75" className="cp-label">AI_SCAN</text>
          </g>

          {/* Active Tracer */}
          <circle cx="20" cy="50" r="4" className="trace-indicator" />
        </svg>
      </div>
      
      <div className="url-deconstruction mono">
        {url && url.split(/(:\/\/|\/)/).map((part, i) => (
            <span key={i} className={`url-part ${i === 2 ? 'domain' : ''}`}>
                {part}
            </span>
        ))}
      </div>
    </div>
  );
}
