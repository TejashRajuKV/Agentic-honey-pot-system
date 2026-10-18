import { useEffect, useState } from "react";
import "../styles/Forensic3DScene.css";

export default function Forensic3DScene({ isBackground = false }) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollProgress(Math.min(1, window.scrollY / (window.innerHeight * 1.5)));
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const rotation = scrollProgress * 180;
  const opacity = isBackground ? 0.15 : 0.8;

  return (
    <div className={`forensic-blueprint-container ${isBackground ? 'as-bg' : ''}`} style={{ opacity }}>
      <div className="blueprint-wireframe" style={{ transform: `rotateX(60deg) rotateZ(${rotation}deg)` }}>
        {/* ── Blueprint Grid ── */}
        <div className="grid-plane"></div>
        
        {/* ── Point Cloud / Wireframe Core ── */}
        <div className="wireframe-core">
          <div className="core-ring-wire cyan"></div>
          <div className="core-ring-wire cyan"></div>
          <div className="core-ring-wire cyan"></div>
          
          <div className="pillar p1"></div>
          <div className="pillar p2"></div>
          <div className="pillar p3"></div>
          <div className="pillar p4"></div>
          
          <div className="data-points">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="point" style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}></div>
            ))}
          </div>
        </div>

        {/* ── Coordinate Labels ── */}
        <div className="coord-labels mono">
          <span className="x">X: {rotation.toFixed(1)}</span>
          <span className="y">Y: 0.0</span>
          <span className="z">Z: { (scrollProgress * 100).toFixed(1) }</span>
        </div>
      </div>
      
      {/* ── Scanning Beam ── */}
      <div className="scanning-beam"></div>
    </div>
  );
}
