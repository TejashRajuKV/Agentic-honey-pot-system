// -----------------------------------------------------------------
//  scroll3D.js - Perspective horizon scroll + section Z-depth entry
//  + card 3D mouse tilt.  No extra deps - pure rAF + IntersectionObserver.
// -----------------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;

// ── 1. Perspective horizon scroll ────────────────────────────────
// Tilts `worldEl` on its X-axis as user scrolls, making the page
// feel like a 3D plane receding toward the horizon.
export const initPerspectiveScroll = (worldEl) => {
    if (!worldEl) return () => {};
    if (window.matchMedia("(hover: none)").matches) return () => {};

    let currentTilt = 0;
    let targetTilt  = 0;
    let rafId       = null;
    let running     = true;

    const MAX_TILT   = 4;      // max degrees of X-rotation
    const LERP_SPEED = 0.07;   // smoothing factor
    const SCROLL_CAP = 600;    // px before max tilt

    const tick = () => {
        if (!running) return;
        const scrollY   = window.scrollY;
        const progress  = Math.min(scrollY / SCROLL_CAP, 1);
        // sine arc: tilt peaks mid-scroll, flattens back at bottom
        const curve     = Math.sin(progress * Math.PI);
        targetTilt      = MAX_TILT * curve;
        currentTilt     = lerp(currentTilt, targetTilt, LERP_SPEED);
        worldEl.style.transform = `rotateX(${currentTilt.toFixed(3)}deg)`;
        rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        if (worldEl) worldEl.style.transform = "";
    };
};

// ── 2. Section Z-depth entrance ──────────────────────────────────
// Sections start buried in Z-space; fly forward when entering view.
export const initSection3DEntrance = (selector = ".scroll-3d-section") => {
    const sections = Array.from(document.querySelectorAll(selector));
    if (!sections.length) return () => {};

    const isMobile = window.matchMedia("(hover: none)").matches;

    sections.forEach((el) => {
        if (isMobile) {
            el.style.opacity   = "0";
            el.style.transform = "translateY(40px)";
        } else {
            el.style.opacity   = "0";
            el.style.transform = "translateZ(-180px) rotateX(7deg) scale(0.97)";
        }
        el.style.transition =
            "opacity 0.85s cubic-bezier(0.22,1,0.36,1), " +
            "transform 0.85s cubic-bezier(0.22,1,0.36,1)";
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                setTimeout(() => {
                    el.style.opacity   = "1";
                    el.style.transform = "translateZ(0) rotateX(0deg) scale(1)";
                }, 60);
                observer.unobserve(el);
            });
        },
        { threshold: 0.08 }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
};

// ── 3. Card 3D mouse tilt + specular glint ────────────────────────
// Cards tilt up to ±10° tracking the cursor; a violet glint follows.
export const initCard3DTilt = (selector = ".dossier-card") => {
    if (window.matchMedia("(hover: none)").matches) return () => {};

    const cards = Array.from(document.querySelectorAll(selector));
    if (!cards.length) return () => {};

    const MAX_ROT   = 10;
    const GLINT_PCT = 60;

    const cleanups = cards.map((card) => {
        card.style.transformStyle = "preserve-3d";
        card.style.transition     = "transform 0.1s ease, box-shadow 0.2s ease";

        let glint = card.querySelector(".card-3d-glint");
        if (!glint) {
            glint = document.createElement("div");
            glint.className = "card-3d-glint";
            Object.assign(glint.style, {
                position: "absolute",
                inset: "0",
                borderRadius: "inherit",
                pointerEvents: "none",
                zIndex: "10",
                opacity: "0",
                transition: "opacity 0.3s ease",
                background: `radial-gradient(circle at 50% 50%, rgba(139,107,255,0.18) 0%, rgba(139,107,255,0.04) ${GLINT_PCT}%, transparent 100%)`,
            });
            card.appendChild(glint);
        }

        const handleMove = (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width  - 0.5;
            const y = (e.clientY - rect.top)  / rect.height - 0.5;
            const rotY =  x * MAX_ROT;
            const rotX = -y * MAX_ROT;
            card.style.transform =
                `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03) translateZ(10px)`;
            glint.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(139,107,255,0.22) 0%, rgba(139,107,255,0.05) ${GLINT_PCT}%, transparent 100%)`;
            glint.style.opacity = "1";
        };

        const handleLeave = () => {
            card.style.transition = "transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s ease";
            card.style.transform  = "";
            glint.style.opacity   = "0";
            setTimeout(() => {
                card.style.transition = "transform 0.1s ease, box-shadow 0.2s ease";
            }, 550);
        };

        card.addEventListener("mousemove",  handleMove);
        card.addEventListener("mouseleave", handleLeave);

        return () => {
            card.removeEventListener("mousemove",  handleMove);
            card.removeEventListener("mouseleave", handleLeave);
            if (glint && glint.parentNode === card) card.removeChild(glint);
        };
    });

    return () => cleanups.forEach((fn) => fn());
};
