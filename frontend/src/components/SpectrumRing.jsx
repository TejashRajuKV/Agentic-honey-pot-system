import { useEffect, useRef } from "react";
import { drawSpectrumRing } from "../animations/spectrumRing";
import "../styles/spectrumRing.css";

const R = 82;
const CIRCUMFERENCE = 2 * Math.PI * R;
const SEGMENTS = 8;
const ARC_DEG = 32; // each segment's visible sweep out of its 45deg slot
const ARC_LEN = (ARC_DEG / 360) * CIRCUMFERENCE;
const COLORS = ["var(--cyan)", "var(--amber)", "var(--red)", "var(--green)"];

// Shared core of the animejs.com-inspired "spectrum ring" HUD dial — an
// on-brand color-coded ring (theme vars, not a literal rainbow) that draws
// itself in with a staggered sweep, then spins slowly as a live accent.
// `revealOn="mount"` draws in immediately (hero use); `revealOn="scroll"`
// waits until the ring scrolls into view (in-page section use).
export default function SpectrumRing({ size = 110, revealOn = "mount", className = "" }) {
    const svgRef = useRef(null);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (revealOn === "mount") {
            const anim = drawSpectrumRing(svgRef.current);
            return () => anim?.pause();
        }

        const el = wrapRef.current;
        if (!el) return;
        let anim;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    anim = drawSpectrumRing(svgRef.current);
                    observer.unobserve(el);
                });
            },
            { threshold: 0.4 }
        );
        observer.observe(el);
        return () => {
            observer.disconnect();
            anim?.pause();
        };
    }, [revealOn]);

    return (
        <div ref={wrapRef} className={`spectrum-ring-wrap ${className}`} style={{ width: size, height: size }}>
            <svg ref={svgRef} viewBox="0 0 200 200" className="spectrum-ring-svg">
                {Array.from({ length: SEGMENTS }).map((_, i) => (
                    <circle
                        key={i}
                        className="ring-segment"
                        cx="100"
                        cy="100"
                        r={R}
                        fill="none"
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE - ARC_LEN}`}
                        strokeDashoffset={ARC_LEN}
                        transform={`rotate(${i * (360 / SEGMENTS)} 100 100)`}
                    />
                ))}
                <circle className="ring-center-dot" cx="100" cy="100" r="4" />
            </svg>
        </div>
    );
}
