import anime from "animejs";

// ─────────────────────────────────────────
// Scroll Reveal — IntersectionObserver driven
// Reveals matched elements with a staggered
// cinematic rise as they enter the viewport.
// Returns a cleanup function.
// ─────────────────────────────────────────
export const initScrollReveal = (selector, opts = {}) => {
    const els = typeof selector === "string"
        ? Array.from(document.querySelectorAll(selector))
        : Array.from(selector || []);

    if (!els.length) return () => {};

    els.forEach((el) => {
        el.style.opacity = "0";
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;

                anime({
                    targets: el,
                    opacity: [0, 1],
                    translateY: [opts.distance ?? 50, 0],
                    scale: [0.97, 1],
                    duration: opts.duration ?? 800,
                    easing: "easeOutCubic",
                });

                observer.unobserve(el);
            });
        },
        { threshold: opts.threshold ?? 0.15 }
    );

    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
};

// ─────────────────────────────────────────
// Staggered group reveal (e.g. grid of cards)
// Animates all matched children together with
// a stagger once the group container is visible.
// ─────────────────────────────────────────
export const initStaggerReveal = (containerSelector, itemSelector, opts = {}) => {
    const containers = Array.from(document.querySelectorAll(containerSelector));
    if (!containers.length) return () => {};

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const items = entry.target.querySelectorAll(itemSelector);

                anime({
                    targets: items,
                    opacity: [0, 1],
                    translateY: [opts.distance ?? 40, 0],
                    duration: 700,
                    delay: anime.stagger(opts.stagger ?? 90),
                    easing: "easeOutCubic",
                    complete: () => {
                        // anime.js leaves the final translateY baked into the inline
                        // `transform` style. That inline value outranks any CSS
                        // `:hover` transform on the same element (e.g. the module
                        // cards' Netflix-style hover-expand), silently blocking it.
                        // Clear it once the entrance settles so CSS can take over.
                        items.forEach((el) => { el.style.transform = ""; });
                    },
                });

                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.1 }
    );

    containers.forEach((c) => {
        c.querySelectorAll(itemSelector).forEach((el) => (el.style.opacity = "0"));
        observer.observe(c);
    });

    return () => observer.disconnect();
};

// ─────────────────────────────────────────
// Mouse Parallax — moves layered elements
// inside `containerEl` based on cursor offset
// from center. Returns a cleanup function.
// ─────────────────────────────────────────
export const initParallax = (containerEl, layerSelector = "[data-parallax]") => {
    if (!containerEl) return () => {};
    const layers = Array.from(containerEl.querySelectorAll(layerSelector));
    if (!layers.length) return () => {};

    let raf = null;

    const handleMove = (e) => {
        const rect = containerEl.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            layers.forEach((layer) => {
                const depth = parseFloat(layer.dataset.parallax) || 20;
                layer.style.transform = `translate3d(${relX * depth}px, ${relY * depth}px, 0)`;
            });
        });
    };

    const reset = () => {
        layers.forEach((layer) => {
            layer.style.transform = "translate3d(0,0,0)";
        });
    };

    containerEl.addEventListener("mousemove", handleMove);
    containerEl.addEventListener("mouseleave", reset);

    return () => {
        containerEl.removeEventListener("mousemove", handleMove);
        containerEl.removeEventListener("mouseleave", reset);
        if (raf) cancelAnimationFrame(raf);
    };
};

// ─────────────────────────────────────────
// Animated Counter — counts up to a target
// number when the element enters view.
// Preserves any non-numeric suffix (%, +, etc).
// ─────────────────────────────────────────
export const initAnimatedCounters = (selector = "[data-counter]") => {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return () => {};

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const raw = el.dataset.counter || el.textContent;
                const match = raw.match(/^([\d.]+)(.*)$/);

                if (!match) {
                    // Non-numeric label (e.g. "LIVE", "BHARAT") — just fade/pop it
                    anime({
                        targets: el,
                        scale: [0.5, 1],
                        opacity: [0, 1],
                        duration: 600,
                        easing: "easeOutBack",
                    });
                    observer.unobserve(el);
                    return;
                }

                const [, numStr, suffix] = match;
                const target = parseFloat(numStr);
                const decimals = (numStr.split(".")[1] || "").length;
                const proxy = { val: 0 };

                anime({
                    targets: proxy,
                    val: target,
                    duration: 1400,
                    easing: "easeOutExpo",
                    update: () => {
                        el.textContent = `${proxy.val.toFixed(decimals)}${suffix}`;
                    },
                });

                observer.unobserve(el);
            });
        },
        { threshold: 0.5 }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
};

// ─────────────────────────────────────────
// Magnetic Buttons — button subtly follows
// the cursor within its bounds, snaps back
// on leave. Classic premium-site micro-interaction.
// ─────────────────────────────────────────
export const initMagneticButtons = (selector) => {
    const buttons = Array.from(document.querySelectorAll(selector));
    if (!buttons.length) return () => {};

    const cleanups = buttons.map((btn) => {
        const strength = 0.35;

        const handleMove = (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            anime({
                targets: btn,
                translateX: x * strength,
                translateY: y * strength,
                duration: 400,
                easing: "easeOutQuad",
            });
        };

        const handleLeave = () => {
            anime({
                targets: btn,
                translateX: 0,
                translateY: 0,
                duration: 500,
                easing: "easeOutElastic(1, 0.5)",
            });
        };

        btn.addEventListener("mousemove", handleMove);
        btn.addEventListener("mouseleave", handleLeave);

        return () => {
            btn.removeEventListener("mousemove", handleMove);
            btn.removeEventListener("mouseleave", handleLeave);
        };
    });

    return () => cleanups.forEach((fn) => fn());
};

// ─────────────────────────────────────────
// Card Launch Transition — Pokémon-style "select
// card, it pops up big toward the viewer" effect.
// Pins the clicked card to its current on-screen
// spot with `position: fixed`, then animates it up
// to a large centered size before calling back.
// ─────────────────────────────────────────
export const launchCardTransition = (el, onComplete) => {
    if (!el) {
        onComplete?.();
        return null;
    }

    const rect = el.getBoundingClientRect();

    // Re-parent to <body> BEFORE pinning. The page wraps everything below
    // the hero in `.scroll-3d-world`, which has a continuous (even if
    // currently identity) `transform: rotateX()` applied by the parallax
    // scroll effect — and ANY non-`none` transform on an ancestor turns
    // it into the containing block for `position: fixed` descendants,
    // silently resolving our top/left against the wrong box. Moving the
    // element out from under it first makes `fixed` resolve against the
    // real viewport again. This is safe because we navigate away right
    // after the animation completes, unmounting this element anyway.
    document.body.appendChild(el);

    // Pin the real element exactly where it visually sat a moment ago,
    // so the re-parent + promotion to `position: fixed` causes no jump.
    // Also clear any existing mouse-tilt transform (initCard3DTilt) and
    // block further hover interaction so it can't fight this animation.
    Object.assign(el.style, {
        position: "fixed",
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "9999",
        transform: "none",
        pointerEvents: "none",
        transition: "box-shadow 0.4s ease",
        boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
    });

    // Force a reflow so the browser commits the pinned start position
    // before anime.js starts animating away from it.
    void el.offsetWidth;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    // Netflix's card-to-page transition fills nearly the whole viewport —
    // a small centered box reads as a modal, not a page takeover.
    const targetW = viewportW * 0.94;
    const targetH = viewportH * 0.94;

    return anime({
        targets: el,
        top: (viewportH - targetH) / 2,
        left: (viewportW - targetW) / 2,
        width: targetW,
        height: targetH,
        duration: 620,
        easing: "easeInOutCubic",
        complete: () => {
            // We re-parented this node to <body>, outside the React root —
            // React's own unmount cleanup won't reliably find/remove it
            // from its new location, so it would otherwise leak onto
            // whatever page we navigate to next as a stuck overlay.
            // Remove it ourselves before handing off.
            el.remove();
            onComplete?.();
        },
    });
};
