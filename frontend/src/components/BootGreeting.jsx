import { useEffect, useRef, useState, useCallback } from "react";
import {
    animateWordIn,
    animateProgress,
    dismissOverlay,
} from "../animations/bootAnimation";
import { revealLetters, splitLetters } from "../animations/textReveal";
import anime from "animejs";
import "../styles/bootGreeting.css";

// ── Ring geometry — same 8-segment, 4-color pattern as the hero's corner
// spectrum ring (components/SpectrumRing.jsx), for visual continuity. ──
const SEGMENTS = 8;
const R = 82;
const CIRCUMFERENCE = 2 * Math.PI * R;
const ARC_DEG = 32;
const ARC_LEN = (ARC_DEG / 360) * CIRCUMFERENCE;
// Hardcoded rather than var(--cyan) etc: this overlay is a fixed white/black
// design regardless of the site's light/dark theme. Dark, saturated jewel
// tones (not muted/greyed, not neon) for contrast and weight against the
// white background.
const COLORS = ["#4c1d95", "#b45309", "#991b1b", "#166534"];

// Each pair of segments (0+1, 2+3, 4+5, 6+7) activates together with one
// line of the script, positioned near that pair's arc on the ring.
const PAIRS = [
    { text: "THREATS ARE EVERYWHERE",   pos: "right" },
    { text: "I AM ALWAYS WATCHING.",     pos: "bottom" },
    { text: "I AM THE PROTECTOR.",       pos: "left" },
    { text: "I WILL STOP EVERY THREAT.", pos: "top" },
];

const STATUS_LINES = [
    "NEURAL SHIELDS ONLINE...",
    "THREAT MATRIX ACTIVE...",
    "GUARDIAN ENGAGED.",
];

const PAIR_HOLD = 750; // ms each pair's text stays up before the next pair starts

export default function BootGreeting({ onFinish }) {
    const [visible, setVisible] = useState(true);
    const [phase, setPhase] = useState("ring"); // ring → unify → reveal
    const [pairIndex, setPairIndex] = useState(0);
    const [statusLine, setStatusLine] = useState(STATUS_LINES[0]);

    const overlayRef   = useRef(null);
    const ringStageRef = useRef(null);
    const ringSvgRef   = useRef(null);
    const segmentRefs  = useRef([]);
    const labelRefs    = useRef([]);
    const titleRef     = useRef(null);
    const taglineRef   = useRef(null);
    const progressRef  = useRef(null);
    const skippedRef   = useRef(false);

    const finish = useCallback(() => {
        if (skippedRef.current) return;
        skippedRef.current = true;
        dismissOverlay(overlayRef.current, () => {
            setVisible(false);
            onFinish?.();
        });
    }, [onFinish]);

    // ── Skip on click / keypress ──
    useEffect(() => {
        if (!visible) return;
        const skip = () => finish();
        window.addEventListener("click", skip);
        window.addEventListener("keydown", skip);
        return () => {
            window.removeEventListener("click", skip);
            window.removeEventListener("keydown", skip);
        };
    }, [visible, finish]);

    // ── ACT 1: ring builds in, two segments + one line per beat ──
    useEffect(() => {
        if (!visible || phase !== "ring") return;

        const [a, b] = [pairIndex * 2, pairIndex * 2 + 1];
        [a, b].forEach((i) => {
            const seg = segmentRefs.current[i];
            if (seg) {
                anime({
                    targets: seg,
                    strokeDashoffset: 0,
                    duration: 650,
                    easing: "easeOutCubic",
                });
            }
        });
        animateWordIn(labelRefs.current[pairIndex]);

        const timer = setTimeout(() => {
            if (pairIndex >= PAIRS.length - 1) {
                setPhase("unify");
            } else {
                setPairIndex((p) => p + 1);
            }
        }, PAIR_HOLD);

        return () => clearTimeout(timer);
    }, [phase, pairIndex, visible]);

    // ── ACT 2: the four lines converge away, then the completed ring
    // spins once to "lock in" before CYBER RAKSHAK appears ──
    useEffect(() => {
        if (phase !== "unify") return;

        anime({
            targets: labelRefs.current.filter(Boolean),
            opacity: [1, 0],
            scale: [1, 0.7],
            filter: ["blur(0px)", "blur(8px)"],
            duration: 500,
            delay: anime.stagger(40),
            easing: "easeInQuad",
        });

        // Only the ring itself spins — targeting the <svg>, not the whole
        // .boot-ring-stage, so the labels fading out beside it (and the
        // title that mounts afterward) never get dragged along with it.
        anime({
            targets: ringSvgRef.current,
            rotate: "+=360",
            scale: [1, 1.08, 1],
            duration: 950,
            easing: "easeInOutCubic",
        });

        // The stage (ring + the title-outside that mounts inside it) rises
        // toward the top of the screen while sweeping from its start point
        // out to the right and back past it to the left, ending parked in
        // the top-left — since the title sits just past the ring's right
        // edge on desktop, ending there opens up the top-right for "CYBER
        // RAKSHAK" to appear into. Skipped below the same 700px breakpoint
        // bootGreeting.css uses to move the title *below* the ring instead
        // — there's no room to spare sideways on a narrow screen, and
        // nothing to make room for.
        // Both transform sub-properties in ONE anime() call, not two: two
        // separate instances animating different sub-properties (translateX
        // in one, translateY in another) on the *same* element fight over
        // that element's single `transform` string — each instance rewrites
        // the whole thing frame by frame based only on the sub-property it
        // tracks, so they stomp on each other and neither is visible. This
        // was a real bug (confirmed: the ring never actually moved), not a
        // rendering artifact — undoing the earlier "fix" that introduced it.
        const isSideBySide = window.innerWidth > 700;
        // How far the ring can actually rise before its own top edge would
        // clip past the viewport's top — a fixed -190px clipped on shorter
        // windows (confirmed: the ring rendered cut off at the top edge).
        // Measured live off the ring's current position instead, capped at
        // a safe margin, so it can never travel further than the screen
        // actually has room for.
        const SAFE_TOP_MARGIN = 30;
        const currentTop = ringStageRef.current?.getBoundingClientRect().top ?? 0;
        const maxRise = Math.max(0, currentTop - SAFE_TOP_MARGIN);
        const riseY = Math.min(190, maxRise);
        anime({
            targets: ringStageRef.current,
            translateY: isSideBySide ? [0, -riseY] : 0,
            translateX: isSideBySide ? [0, 160, -100] : 0,
            duration: 1100,
            easing: "easeInOutCubic",
        });

        // Wait for the travel (the longer of the animations here) to fully
        // settle before CYBER RAKSHAK mounts, so the title doesn't appear
        // mid-motion.
        const timer = setTimeout(() => setPhase("reveal"), 1150);
        return () => clearTimeout(timer);
    }, [phase]);

    // ── ACT 3: CYBER RAKSHAK title + boot-up loading readout ──
    useEffect(() => {
        if (phase !== "reveal") return;

        setTimeout(() => revealLetters(titleRef.current, { stagger: 40 }), 100);
        setTimeout(() => {
            if (taglineRef.current) taglineRef.current.style.opacity = "1";
        }, 550);

        let statusIdx = 0;
        setStatusLine(STATUS_LINES[0]);
        const statusTimer = setInterval(() => {
            statusIdx = Math.min(statusIdx + 1, STATUS_LINES.length - 1);
            setStatusLine(STATUS_LINES[statusIdx]);
        }, 420);

        animateProgress(progressRef.current, 1300);

        const doneTimer = setTimeout(() => {
            clearInterval(statusTimer);
            finish();
        }, 1650);

        return () => {
            clearInterval(statusTimer);
            clearTimeout(doneTimer);
        };
    }, [phase, finish]);

    if (!visible) return null;

    return (
        <div className="boot-overlay" ref={overlayRef}>
            <div className="boot-content">
                <div className="boot-ring-stage" ref={ringStageRef}>
                    <svg viewBox="0 0 200 200" className="boot-ring-svg" ref={ringSvgRef}>
                        <circle cx="100" cy="100" r={R} className="boot-ring-track" strokeWidth="9" fill="none" />
                        {Array.from({ length: SEGMENTS }).map((_, i) => (
                            <circle
                                key={i}
                                ref={(el) => (segmentRefs.current[i] = el)}
                                className="boot-ring-segment"
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
                    </svg>

                    {PAIRS.map((pair, i) => (
                        <div key={i} className={`boot-ring-label pos-${pair.pos}`}>
                            {/* animateWordIn animates `scale`, which anime.js
                                writes as an inline `transform` — targeting a
                                nested span (not this positioned div) keeps
                                that from ever clobbering the CSS transform
                                this div uses to place itself by the ring. */}
                            <span ref={(el) => (labelRefs.current[i] = el)} className="boot-ring-label-inner">
                                {pair.text}
                            </span>
                        </div>
                    ))}

                    {phase === "reveal" && (
                        <div className="boot-title-outside">
                            <h1 className="boot-title" ref={titleRef}>
                                {"CYBER RAKSHAK".split(" ").map((word, wi) => (
                                    <span className="boot-title-word" key={wi}>
                                        {splitLetters(word).map((char, i) => (
                                            <span className="letter" key={i}>{char}</span>
                                        ))}
                                    </span>
                                ))}
                            </h1>
                            <div className="boot-tagline mono" ref={taglineRef}>
                                आपका डिजिटल रक्षक &nbsp;·&nbsp; YOUR DIGITAL GUARDIAN
                            </div>
                        </div>
                    )}
                </div>

                {phase === "reveal" && (
                    <div className="boot-progress-wrap">
                        <div className="boot-progress-track">
                            <div className="boot-progress-fill" ref={progressRef} />
                        </div>
                        <div className="boot-status mono">{statusLine}</div>
                    </div>
                )}
            </div>

            <div className="boot-skip mono">CLICK OR PRESS ANY KEY TO SKIP</div>
        </div>
    );
}
