import anime from "animejs";

// ─────────────────────────────────────────
// Risk Badge Pop-in Animation
// Triggered when result appears
// ─────────────────────────────────────────
export const animateRiskBadge = (selector) => {
    anime({
        targets: selector,
        scale: [0, 1.15, 1],
        opacity: [0, 1],
        duration: 600,
        easing: "easeOutElastic(1, .6)",
    });
};


// ─────────────────────────────────────────
// Risk Card Slide In
// ─────────────────────────────────────────
export const animateResultCard = (selector) => {
    anime({
        targets: selector,
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 500,
        easing: "easeOutCubic",
    });
};


// ─────────────────────────────────────────
// Flagged Words Highlight
// ─────────────────────────────────────────
export const animateFlaggedWords = (selector) => {
    anime({
        targets: selector,
        background: ["rgba(255,45,85,0)", "rgba(255,45,85,0.25)"],
        duration: 800,
        delay: anime.stagger(100),
        easing: "easeInOutQuad",
    });
};


// ─────────────────────────────────────────
// Shake Animation (for HIGH RISK)
// ─────────────────────────────────────────
export const animateShake = (selector) => {
    anime({
        targets: selector,
        translateX: [0, -8, 8, -6, 6, -4, 4, 0],
        duration: 500,
        easing: "easeInOutSine",
    });
};
