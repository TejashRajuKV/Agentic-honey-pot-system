import { useEffect, useRef } from "react";
import { animateAlongPath, animateFloatBob } from "../animations/motionPath";
import { IconRadar } from "./icons/BootIcons";
import "../styles/glidingScanner.css";

// A hand-drawn "scanner drone" that glides back and forth along a
// dotted flight path, with small floating radar-ping accents nearby —
// our themed take on the reference's paraglider-over-a-dotted-arc motif.
export default function GlidingScanner() {
    const pathRef  = useRef(null);
    const droneRef = useRef(null);
    const floatRef = useRef(null);

    useEffect(() => {
        const pathAnim  = animateAlongPath(pathRef.current, droneRef.current, { duration: 7000 });
        const floatAnim = animateFloatBob(floatRef.current?.querySelectorAll(".scanner-float-icon"), { stagger: 500 });

        return () => {
            pathAnim?.pause();
            floatAnim?.pause();
        };
    }, []);

    return (
        <div className="gliding-scanner-strip">
            <div className="gliding-scanner-label mono">// CONTINUOUS THREAT SCANNING</div>

            <svg className="gliding-scanner-svg" viewBox="0 0 800 140" fill="none">
                <path
                    ref={pathRef}
                    d="M 20 100 Q 200 20 400 60 T 780 90"
                    stroke="var(--border)"
                    strokeWidth="2"
                    strokeDasharray="6 8"
                    fill="none"
                />

                <g ref={floatRef}>
                    <IconRadar
                        className="scanner-float-icon"
                        x="150" y="18" width="24" height="24"
                        style={{ color: "var(--cyan)", opacity: 0.55 }}
                    />
                    <IconRadar
                        className="scanner-float-icon"
                        x="560" y="8" width="18" height="18"
                        style={{ color: "var(--amber)", opacity: 0.5 }}
                    />
                </g>

                {/* The gliding scanner drone */}
                <g ref={droneRef} style={{ filter: "url(#sketchy-wobble)" }}>
                    <path d="M-14 0 L0 -9 L14 0 L0 9 Z" stroke="var(--cyan)" strokeWidth="2" fill="var(--card)" />
                    <path d="M-5 0 L5 0 M0 -5 L0 5" stroke="var(--cyan)" strokeWidth="1.3" />
                    <circle cx="0" cy="0" r="2" fill="var(--cyan)" />
                </g>
            </svg>
        </div>
    );
}
