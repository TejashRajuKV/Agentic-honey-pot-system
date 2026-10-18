import anime from "animejs";

// ─────────────────────────────────────────
// Shield Ring Locking Animation
// ─────────────────────────────────────────
export const animateShieldLock = (selectors) => {
    selectors.forEach((selector, i) => {
        anime({
            targets: selector,
            rotate: [0, (i + 1) * 360 + 45],
            duration: 1500 + (i * 500),
            easing: 'easeInOutQuart',
            delay: i * 200
        });
    });
};

// ─────────────────────────────────────────
// Heatmap Pulse Animation
// ─────────────────────────────────────────
export const animateHeatmapPulse = (selector, intensity) => {
    anime({
        targets: selector,
        backgroundColor: [
            `rgba(255, 45, 85, 0)`,
            `rgba(255, 45, 85, ${intensity * 0.1})`,
            `rgba(255, 45, 85, 0)`
        ],
        duration: 1000,
        easing: 'easeInOutSine'
    });
};

// ─────────────────────────────────────────
// Metadata Ticker Scroll
// ─────────────────────────────────────────
export const animateTickerScroll = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return;

    anime({
        targets: el,
        scrollTop: [0, el.scrollHeight],
        duration: 2000,
        easing: 'linear'
    });
};
