import anime from "animejs";

// ─────────────────────────────────────────
// URL Trace Animation
// ─────────────────────────────────────────
export const animateURLTrace = (selector, isPhishing) => {
    const timeline = anime.timeline({
        easing: 'easeInOutQuad'
    });

    timeline
        .add({
            targets: '.trace-line',
            strokeDashoffset: [anime.setDashoffset, 0],
            duration: 2000,
        })
        .add({
            targets: '.checkpoint',
            scale: [0, 1],
            opacity: [0, 1],
            delay: anime.stagger(400),
            duration: 600,
        }, '-=1500')
        .add({
            targets: '.trace-indicator',
            translateX: ['0%', '100%'],
            opacity: [1, 0],
            duration: 1000,
            easing: 'linear'
        }, '-=500');

    return timeline;
};
