import anime from "animejs";

// ─────────────────────────────────────────
// Pulse Flagged Nodes
// ─────────────────────────────────────────
export const animateNeuralNodes = (selector, isAnomalous) => {
    anime({
        targets: selector,
        scale: [1, 1.2, 1],
        boxShadow: isAnomalous
            ? ["0 0 5px rgba(255,45,85,0.2)", "0 0 20px rgba(255,45,85,0.6)", "0 0 5px rgba(255,45,85,0.2)"]
            : ["0 0 5px rgba(0,255,157,0.2)", "0 0 20px rgba(0,255,157,0.6)", "0 0 5px rgba(0,255,157,0.2)"],
        duration: 1500,
        loop: true,
        easing: "easeInOutSine"
    });
};

// ─────────────────────────────────────────
// Scan Radar Sweep
// ─────────────────────────────────────────
export const startRadarSweep = (selector) => {
    return anime({
        targets: selector,
        rotate: [0, 360],
        duration: 2000,
        loop: true,
        easing: "linear"
    });
};
