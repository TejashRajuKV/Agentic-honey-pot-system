import anime from "animejs";

// ─────────────────────────────────────────
// Greeting word — entrance
// ─────────────────────────────────────────
export const animateWordIn = (el) => {
    if (!el) return null;
    return anime({
        targets: el,
        opacity: [0, 1],
        scale: [0.85, 1],
        filter: ["blur(12px)", "blur(0px)"],
        duration: 550,
        easing: "easeOutQuint",
    });
};

// ─────────────────────────────────────────
// Greeting word — exit
// ─────────────────────────────────────────
export const animateWordOut = (el, onComplete) => {
    if (!el) {
        onComplete?.();
        return null;
    }
    return anime({
        targets: el,
        opacity: [1, 0],
        scale: [1, 1.12],
        filter: ["blur(0px)", "blur(12px)"],
        duration: 350,
        easing: "easeInQuart",
        complete: onComplete,
    });
};

// ─────────────────────────────────────────
// Shield SVG — stroke draw-in effect
// ─────────────────────────────────────────
export const drawShield = (pathEls) => {
    if (!pathEls || !pathEls.length) return null;
    anime.set(pathEls, { strokeDashoffset: (el) => el.getTotalLength() });

    return anime({
        targets: pathEls,
        strokeDashoffset: [anime.setDashoffset, 0],
        easing: "easeInOutSine",
        duration: 1200,
        delay: anime.stagger(120),
    });
};

// ─────────────────────────────────────────
// Shield fill glow — pulses in after the draw
// ─────────────────────────────────────────
export const glowShield = (el) => {
    if (!el) return null;
    return anime({
        targets: el,
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 600,
        easing: "easeOutBack",
    });
};

// ─────────────────────────────────────────
// Progress bar fill 0 → 100
// ─────────────────────────────────────────
export const animateProgress = (el, duration, onUpdate) => {
    if (!el) return null;
    const proxy = { value: 0 };
    return anime({
        targets: proxy,
        value: 100,
        duration,
        easing: "linear",
        update: () => {
            el.style.width = `${proxy.value}%`;
            onUpdate?.(Math.round(proxy.value));
        },
    });
};

// ─────────────────────────────────────────
// Turning-point flash — a quick radial pulse
// marking the story's pivot ("but then...")
// ─────────────────────────────────────────
export const flashPulse = (el) => {
    if (!el) return null;
    return anime({
        targets: el,
        opacity: [0, 1, 0],
        scale: [0.6, 1.6],
        duration: 650,
        easing: "easeOutExpo",
    });
};

// ─────────────────────────────────────────
// Saviour arrival — the mascot pops in
// ─────────────────────────────────────────
export const popInFigure = (el, onComplete) => {
    if (!el) {
        onComplete?.();
        return null;
    }
    return anime({
        targets: el,
        opacity: [0, 1],
        scale: [0.5, 1],
        translateY: [30, 0],
        duration: 750,
        easing: "easeOutBack",
        complete: onComplete,
    });
};

// ─────────────────────────────────────────
// Final overlay dismiss — scale + blur out
// ─────────────────────────────────────────
export const dismissOverlay = (el, onComplete) => {
    if (!el) {
        onComplete?.();
        return null;
    }
    return anime({
        targets: el,
        opacity: [1, 0],
        scale: [1, 1.05],
        filter: ["blur(0px)", "blur(20px)"],
        duration: 700,
        easing: "easeInOutQuad",
        complete: onComplete,
    });
};
