import { useEffect, useRef } from "react";
import { animateGaugeNeedle } from "../animations/newsAnimations";
import { animateDecrypt } from "../animations/counterAnimation";
import "../styles/modules.css";

export default function TruthGauge({ confidence, loading }) {
  const needleRef = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    if (!loading) {
      if (needleRef.current) {
        // Invert: High confidence (Risk) = Left (Fake/Red)
        // 0 Risk -> 90deg (Right), 100 Risk -> -90deg (Left)
        const rotation = 90 - (confidence * 1.8);
        animateGaugeNeedle(needleRef.current, rotation);
      }
      if (labelRef.current) {
        animateDecrypt(labelRef.current, 100 - confidence);
      }
    }
  }, [confidence, loading]);

  return (
    <div className="gauge-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "60px 0 20px 0" }}>
      <div className="gauge-svg-container" style={{ width: "100%", maxWidth: "300px", padding: "10px" }}>
        <svg viewBox="0 0 200 120" className="gauge-svg" style={{ overflow: "visible" }}>
          {/* Background Arc */}
          <path 
            d="M 20 100 A 80 80 0 0 1 180 100" 
            fill="none" 
            stroke="var(--surface)" 
            strokeWidth="12" 
            strokeLinecap="round" 
          />
          {/* Spectrum Arc */}
          <path 
            d="M 20 100 A 80 80 0 0 1 180 100" 
            fill="none" 
            stroke="url(#gauge-gradient)" 
            strokeWidth="12" 
            strokeLinecap="round" 
            strokeDasharray="251"
            strokeDashoffset="0"
          />
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#FF2D55" />
              <stop offset="50%"  stopColor="#FFD60A" />
              <stop offset="100%" stopColor="#00FF9D" />
            </linearGradient>
          </defs>

          {/* Scale Markers */}
          <text 
            x="20" y="115" 
            style={{ fill: "var(--white)", fontSize: "10px", fontWeight: "bold", fontFamily: "var(--font-mono)" }} 
            textAnchor="middle"
          >
            FAKE
          </text>
          <text 
            x="180" y="115" 
            style={{ fill: "var(--white)", fontSize: "10px", fontWeight: "bold", fontFamily: "var(--font-mono)" }} 
            textAnchor="middle"
          >
            TRUE
          </text>

          {/* Needle */}
          <g ref={needleRef} className="needle-group" style={{ transform: "rotate(90deg)", transformOrigin: "100px 100px" }}>
            <line 
                x1="100" y1="100" x2="100" y2="50" 
                stroke="var(--white)" 
                strokeWidth="4" 
                strokeLinecap="round" 
            />
            <circle cx="100" cy="100" r="6" fill="var(--white)" />
          </g>
        </svg>
      </div>
      <div className="gauge-label">
        TRUTH PROBABILITY: <span ref={labelRef} className="mono">{loading ? "..." : "0%"}</span>
      </div>
    </div>
  );
}
