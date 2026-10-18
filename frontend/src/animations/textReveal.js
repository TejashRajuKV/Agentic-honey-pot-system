import anime from "animejs";

// ─────────────────────────────────────────
// Split a string into an array of characters,
// preserving spaces as non-breaking so layout
// doesn't collapse when rendered as spans.
// ─────────────────────────────────────────
export const splitLetters = (text = "") =>
    text.split("").map((char) => (char === " " ? " " : char));

// ─────────────────────────────────────────
// Cinematic letter-by-letter reveal.
// Targets all `.letter` children of `container`.
// ─────────────────────────────────────────
export const revealLetters = (container, opts = {}) => {
    if (!container) return null;
    const letters = container.querySelectorAll(".letter");
    if (!letters.length) return null;

    return anime({
        targets: letters,
        translateY: [opts.from ?? 60, 0],
        rotateX: [opts.rotate ?? 60, 0],
        opacity: [0, 1],
        duration: opts.duration ?? 900,
        delay: anime.stagger(opts.stagger ?? 35, { start: opts.delay ?? 0 }),
        easing: opts.easing ?? "easeOutExpo",
    });
};

// ─────────────────────────────────────────
// Reverse / exit animation for letters
// ─────────────────────────────────────────
export const hideLetters = (container, opts = {}) => {
    if (!container) return null;
    const letters = container.querySelectorAll(".letter");
    if (!letters.length) return null;

    return anime({
        targets: letters,
        translateY: [0, -30],
        opacity: [1, 0],
        duration: opts.duration ?? 400,
        delay: anime.stagger(15),
        easing: "easeInExpo",
    });
};
