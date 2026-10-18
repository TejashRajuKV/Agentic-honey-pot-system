import { useEffect, useRef, useState } from "react";
import "../styles/cursor.css";

const HOVER_SELECTOR = "a, button, .dossier-card, .report-card, .tab-item, .m-tag, [role='button']";
const TEXT_SELECTOR = "input, textarea, select";

export default function CustomCursor() {
    const dotRef  = useRef(null);
    const ringRef = useRef(null);
    const [enabled, setEnabled] = useState(false);
    const [hidden, setHidden]   = useState(false);
    const [hover, setHover]     = useState(false);

    // Only enable on fine-pointer (mouse/trackpad) devices
    useEffect(() => {
        const isFine = window.matchMedia("(pointer: fine)").matches;
        setEnabled(isFine);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let ringX = mouseX;
        let ringY = mouseY;
        let raf;

        const onMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (dotRef.current) {
                dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
            }
        };

        const loop = () => {
            ringX += (mouseX - ringX) * 0.18;
            ringY += (mouseY - ringY) * 0.18;
            if (ringRef.current) {
                ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
            }
            raf = requestAnimationFrame(loop);
        };

        const onOver = (e) => {
            if (e.target.closest?.(TEXT_SELECTOR)) { setHidden(true); return; }
            setHidden(false);
            setHover(!!e.target.closest?.(HOVER_SELECTOR));
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        document.addEventListener("mouseover", onOver);
        raf = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseover", onOver);
            cancelAnimationFrame(raf);
        };
    }, [enabled]);

    if (!enabled) return null;

    return (
        <>
            <div
                ref={dotRef}
                className={`custom-cursor-dot ${hidden ? "is-hidden" : ""}`}
            />
            <div
                ref={ringRef}
                className={`custom-cursor-ring ${hover ? "is-hover" : ""} ${hidden ? "is-hidden" : ""}`}
            />
        </>
    );
}
