import anime from "animejs";

// Sweeps each colored arc segment of the hero spectrum ring in, one after
// another, like a HUD dial powering on. Once fully drawn, sets the ring
// spinning slowly so it reads as a live "always scanning" accent rather
// than a one-off intro flourish.
export const drawSpectrumRing = (svgEl) => {
    if (!svgEl) return null;
    const segments = svgEl.querySelectorAll(".ring-segment");
    if (!segments.length) return null;

    return anime({
        targets: segments,
        strokeDashoffset: 0,
        easing: "easeOutCubic",
        duration: 700,
        delay: anime.stagger(90, { start: 200 }),
        complete: () => {
            svgEl.classList.add("is-spinning");
        },
    });
};
