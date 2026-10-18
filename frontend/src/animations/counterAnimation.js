import anime from "animejs";

// ─────────────────────────────────────────
// Confidence % Count-up Animation
// Triggered when confidence value appears
// ─────────────────────────────────────────
export const animateCounter = (target, targetValue) => {
    const obj = { value: 0 };
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;

    anime({
        targets: obj,
        value: targetValue,
        duration: 1000,
        easing: "easeOutCubic",
        round: 1,
        update: () => {
            el.textContent = `${Math.round(obj.value)}%`;
        },
    });
};


// ─────────────────────────────────────────
// Progress Bar Fill Animation
// ─────────────────────────────────────────
export const animateProgressBar = (target, targetWidth) => {
    anime({
        targets: target,
        width: [`0%`, `${targetWidth}%`],
        duration: 1000,
        easing: "easeOutCubic",
    });
};


// ─────────────────────────────────────────
// Score Number Animate
// ─────────────────────────────────────────
export const animateScore = (target, from, to) => {
    const obj = { value: from };
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;

    anime({
        targets: obj,
        value: to,
        duration: 800,
        easing: "easeOutQuad",
        round: 1,
        update: () => {
            el.textContent = Math.round(obj.value);
        },
    });
};
// ─────────────────────────────────────────
// Decrypting / Shuffling Animation
// ─────────────────────────────────────────
export const animateDecrypt = (target, targetValue) => {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;

    const symbols = "01$#!?%&@#*";
    let iterations = 0;
    const maxIterations = 12; // Slightly faster

    const interval = setInterval(() => {
        el.textContent = Array(3)
            .fill(0)
            .map(() => symbols[Math.floor(Math.random() * symbols.length)])
            .join("") + "%";

        iterations++;
        if (iterations >= maxIterations) {
            clearInterval(interval);
            // After shuffling, trigger the standard count up
            animateCounter(el, targetValue);
        }
    }, 40);
};
