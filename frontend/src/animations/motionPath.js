import anime from "animejs";

// ─────────────────────────────────────────
// Animates `targetEl` so its local origin
// travels along `pathEl` (an SVG <path>),
// looping back and forth indefinitely.
// Returns the anime.js instance for cleanup.
// ─────────────────────────────────────────
export const animateAlongPath = (pathEl, targetEl, opts = {}) => {
    if (!pathEl || !targetEl) return null;

    const path = anime.path(pathEl);

    const params = {
        targets: targetEl,
        translateX: path("x"),
        translateY: path("y"),
        easing: opts.easing || "easeInOutSine",
        duration: opts.duration || 7000,
        direction: "alternate",
        loop: true,
    };

    // Only include `rotate` when requested — passing an explicit
    // `undefined` value (vs. omitting the key) breaks anime.js's tick loop.
    if (opts.rotate) {
        params.rotate = path("angle");
    }

    return anime(params);
};

// ─────────────────────────────────────────
// Gentle up/down bobbing loop for floating
// decorative icons (e.g. radar pings).
// ─────────────────────────────────────────
export const animateFloatBob = (targets, opts = {}) => {
    if (!targets) return null;

    return anime({
        targets,
        translateY: [0, opts.distance ?? -8, 0],
        duration: opts.duration ?? 2600,
        delay: anime.stagger(opts.stagger ?? 400),
        easing: "easeInOutSine",
        loop: true,
    });
};
