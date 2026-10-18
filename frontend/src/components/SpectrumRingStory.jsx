import { useEffect, useRef } from "react";
import "../styles/spectrumRingStory.css";

// ── Geometry ──
// Three equal thirds of the full circle (not just a cluster on one side) —
// each segment's arc nearly fills its 120deg slot, so together they read
// as a pie-chart progressively completing, not a few thin dashes.
const R = 118;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * R;
const ARC_WIDTH_DEG = 104; // out of each 120deg slot

const STAGES = [
    {
        code: "V-PHISH_01",
        title: "Emerging Threats",
        desc: "Rapid rise in UPI scams, loan app frauds, and digital arrest scams targeting users across India.",
        meta: "IMPACT: CRITICAL // SCALE: NATIONAL",
        color: "var(--red)",
        bit: "red",
        centerDeg: -30, // starts the sweep from 12 o'clock
    },
    {
        code: "S-ENG_02",
        title: "Social Engineering",
        desc: "Exploitation of low digital literacy through psychological manipulation and fraudulent social engineering.",
        meta: "VECTOR: HUMAN // RISK: EXTREME",
        color: "var(--amber)",
        bit: "amber",
        centerDeg: 90,
    },
    {
        code: "I-THEFT_03",
        title: "Identity & Finance",
        desc: "Fake news dissemination and suspicious phishing links causing massive financial and identity theft.",
        meta: "TYPE: DATA_DRAIN // SEVERITY: HIGH",
        color: "var(--cyan)",
        bit: "cyan",
        centerDeg: 210,
    },
];

// ── Scroll-progress → timing ──
// Each stage has a "center" point in the 0..1 scroll range. The ring
// segment paints in just before it, the arrow draws in straddling it, and
// the card's visibility is a triangular crossfade peaking exactly at that
// center and fading out as the *next* stage's center approaches — so only
// one card owns the slot at a time, no matter how much text it holds.
// Every value below is a pure function of scroll progress: nothing here
// plays on a timer, so scrolling back up reverses it exactly.
const STAGE_START = 0.08;
const STAGE_GAP = 0.36;
const stageCenter = (i) => STAGE_START + i * STAGE_GAP;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const windowT = (progress, start, span) => easeOutCubic(clamp01((progress - start) / span));

export default function SpectrumRingStory() {
    const wrapperRef = useRef(null);
    const segmentRefs = useRef([]);
    const arrowSvgRefs = useRef([]);
    const arrowPathRefs = useRef([]);
    const arrowHeadRefs = useRef([]);
    const cardRefs = useRef([]);
    const centerCodeRef = useRef(null);
    const centerIdxRef = useRef(null);
    const progressBarRef = useRef(null);
    const lastActiveIndex = useRef(-1);
    const arrowLengths = useRef([]);

    useEffect(() => {
        // Measure each hand-authored arrow path's real length once, so the
        // dash-draw animation is exact regardless of the curve's shape.
        arrowLengths.current = arrowPathRefs.current.map((p) => p?.getTotalLength?.() || 100);

        let rafId = null;

        const applyProgress = (progress) => {
            const activeFloat = clamp01((progress - STAGE_START) / (STAGE_GAP * (STAGES.length - 1))) * (STAGES.length - 1);

            STAGES.forEach((stage, i) => {
                const center = stageCenter(i);
                const tSeg = windowT(progress, center - 0.16, 0.14);
                const tArrow = windowT(progress, center - 0.08, 0.14);
                // Triangular crossfade: 1 exactly at this stage's center,
                // falling to 0 by the time the neighboring stage takes over.
                const proximity = clamp01(1 - Math.abs(activeFloat - i));
                const tCard = easeOutCubic(proximity);

                const seg = segmentRefs.current[i];
                if (seg) {
                    const arcLen = (ARC_WIDTH_DEG / 360) * CIRCUMFERENCE;
                    seg.style.strokeDashoffset = String(arcLen * (1 - tSeg));
                }

                const arrowSvg = arrowSvgRefs.current[i];
                if (arrowSvg) arrowSvg.style.opacity = String(tCard);
                const arrowPath = arrowPathRefs.current[i];
                if (arrowPath) {
                    const len = arrowLengths.current[i] || 100;
                    arrowPath.style.strokeDashoffset = String(len * (1 - tArrow));
                }
                const arrowHead = arrowHeadRefs.current[i];
                if (arrowHead) {
                    arrowHead.style.opacity = tArrow > 0.85 ? String((tArrow - 0.85) / 0.15) : "0";
                }

                const card = cardRefs.current[i];
                if (card) {
                    card.style.opacity = String(tCard);
                    const dx = (1 - tCard) * 30;
                    const scale = 0.96 + 0.04 * tCard;
                    card.style.transform = `translateX(${dx}px) scale(${scale})`;
                    card.style.filter = `blur(${(1 - tCard) * 3}px)`;
                    card.style.zIndex = String(Math.round(tCard * 10));
                    card.style.pointerEvents = tCard > 0.6 ? "auto" : "none";
                }
            });

            const active = Math.round(activeFloat);
            if (active !== lastActiveIndex.current) {
                lastActiveIndex.current = active;
                if (centerCodeRef.current) centerCodeRef.current.textContent = STAGES[active].code;
                if (centerIdxRef.current) centerIdxRef.current.textContent = `0${active + 1} / 0${STAGES.length}`;
            }

            if (progressBarRef.current) {
                progressBarRef.current.style.width = `${clamp01(progress) * 100}%`;
            }
        };

        const handleScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const el = wrapperRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const total = rect.height - window.innerHeight;
                const progress = total > 0 ? clamp01(-rect.top / total) : 0;
                applyProgress(progress);
            });
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <section className="ring-story-wrapper" ref={wrapperRef} id="engine">
            <div className="ring-story-sticky">
                <div className="container ring-story-container">
                    <div className="section-label-technical mono">
                        <span className="idx">/02</span> // THREAT VECTOR ANALYSIS
                    </div>
                    <h2 className="section-title technical-h2 ring-story-heading">
                        Critical Threat <span className="serif-highlight">Intel Report</span>
                    </h2>

                    <div className="ring-story-main">
                        <div className="ring-story-visual">
                            <svg viewBox="0 0 300 300" className="ring-story-svg">
                                <circle cx="150" cy="150" r={R} className="ring-track" strokeWidth={STROKE} fill="none" />
                                {STAGES.map((stage, i) => {
                                    const arcLen = (ARC_WIDTH_DEG / 360) * CIRCUMFERENCE;
                                    const rotate = stage.centerDeg - ARC_WIDTH_DEG / 2;
                                    return (
                                        <circle
                                            key={i}
                                            ref={(el) => (segmentRefs.current[i] = el)}
                                            cx="150"
                                            cy="150"
                                            r={R}
                                            fill="none"
                                            stroke={stage.color}
                                            strokeWidth={STROKE}
                                            strokeLinecap="round"
                                            strokeDasharray={`${arcLen} ${CIRCUMFERENCE - arcLen}`}
                                            strokeDashoffset={arcLen}
                                            transform={`rotate(${rotate} 150 150)`}
                                        />
                                    );
                                })}
                            </svg>
                            <div className="ring-center-label mono">
                                <div className="ring-center-idx" ref={centerIdxRef}>01 / 03</div>
                                <div className="ring-center-code" ref={centerCodeRef}>V-PHISH_01</div>
                                <div className="ring-center-sub">SCANNING</div>
                            </div>
                        </div>

                        {/* Fixed-height slot — cards crossfade in place instead of
                            stacking, so total section height never depends on
                            how much report text there is. */}
                        <div className="ring-story-cards">
                            {STAGES.map((stage, i) => (
                                <div className="ring-story-row" key={i}>
                                    <svg
                                        ref={(el) => (arrowSvgRefs.current[i] = el)}
                                        viewBox="0 0 90 40"
                                        className="ring-story-arrow"
                                        style={{ color: stage.color, opacity: 0 }}
                                    >
                                        <path
                                            ref={(el) => (arrowPathRefs.current[i] = el)}
                                            d="M2 20 C 28 6, 55 6, 76 19"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                        />
                                        <path
                                            ref={(el) => (arrowHeadRefs.current[i] = el)}
                                            d="M69 12 L80 19 L68 26"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ opacity: 0 }}
                                        />
                                    </svg>

                                    <div
                                        className="threat-card report-card ring-story-card"
                                        ref={(el) => (cardRefs.current[i] = el)}
                                        style={{ borderLeft: `3px solid ${stage.color}` }}
                                    >
                                        <div className="report-header mono">
                                            <span className={`status-bit ${stage.bit}`}></span> ALERT: {stage.code}
                                        </div>
                                        <h3 className="t-title">{stage.title}</h3>
                                        <p className="t-desc">{stage.desc}</p>
                                        <div className="t-meta mono">{stage.meta}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="ring-story-progress mono">
                        <span>SCAN PROGRESS</span>
                        <div className="ring-story-progress-track">
                            <div className="ring-story-progress-bar" ref={progressBarRef} />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
