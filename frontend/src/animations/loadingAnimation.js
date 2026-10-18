import anime from "animejs";

// ─────────────────────────────────────────
// Scan Ring Rotation
// Shown while waiting for API response
// ─────────────────────────────────────────
export const startLoadingAnimation = (selector) => {
    return anime({
        targets: selector,
        rotate: "1turn",
        duration: 1000,
        loop: true,
        easing: "linear",
    });
};


// ─────────────────────────────────────────
// Stop Loading Animation
// ─────────────────────────────────────────
export const stopLoadingAnimation = (animation) => {
    if (animation) {
        animation.pause();
    }
};


// ─────────────────────────────────────────
// Pulse Animation (idle state)
// ─────────────────────────────────────────
export const animatePulse = (selector) => {
    return anime({
        targets: selector,
        scale: [1, 1.05, 1],
        opacity: [0.7, 1, 0.7],
        duration: 1500,
        loop: true,
        easing: "easeInOutSine",
    });
};


// ─────────────────────────────────────────
// Page Load Stagger Animation
// ─────────────────────────────────────────
export const animatePageLoad = (selector) => {
    anime({
        targets: selector,
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 600,
        delay: anime.stagger(100),
        easing: "easeOutCubic",
    });
};