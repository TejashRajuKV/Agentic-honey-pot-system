import anime from "animejs";

// ─────────────────────────────────────────
// Gauge Needle Vibration & Swing
// ─────────────────────────────────────────
export const animateGaugeNeedle = (selector, targetRotation) => {
    // Vibration phase
    const timeline = anime.timeline();

    timeline.add({
        targets: selector,
        rotate: [-10, 10],
        duration: 100,
        direction: 'alternate',
        loop: 8,
        easing: 'easeInOutSine'
    }).add({
        targets: selector,
        rotate: [0, targetRotation],
        duration: 800,
        easing: 'easeOutElastic(1, .6)'
    });
};

// ─────────────────────────────────────────
// Verdict Stamp Slam Animation
// ─────────────────────────────────────────
export const animateStampSlam = (selector) => {
    anime({
        targets: selector,
        scale: [5, 1],
        opacity: [0, 1],
        rotate: [-15, -10],
        duration: 400,
        easing: 'easeInBack',
        complete: () => {
            // Glitch effect after slam
            anime({
                targets: selector,
                translateX: [-2, 2, 0],
                duration: 100,
                loop: 3
            });
        }
    });
};
