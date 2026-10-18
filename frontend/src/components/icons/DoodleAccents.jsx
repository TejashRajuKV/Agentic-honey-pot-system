// Small hand-inked doodle accents — squiggly underlines, arrows, stars.
// Each applies the "sketchy-wobble" SVG filter (see SketchDefs.jsx) for
// a hand-drawn, slightly imperfect line quality.

export function DoodleUnderline(props) {
    return (
        <svg viewBox="0 0 200 16" fill="none" style={{ filter: "url(#sketchy-wobble)" }} {...props}>
            <path d="M2 10 Q30 2 60 8 T120 6 T198 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

export function DoodleArrow(props) {
    return (
        <svg viewBox="0 0 90 44" fill="none" style={{ filter: "url(#sketchy-wobble)" }} {...props}>
            <path d="M4 34 Q34 6 76 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M62 9 L78 18 L64 29" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function DoodleStar(props) {
    return (
        <svg viewBox="0 0 40 40" fill="none" style={{ filter: "url(#sketchy-wobble)" }} {...props}>
            <path d="M20 3 L23.5 16.5 L37 20 L23.5 23.5 L20 37 L16.5 23.5 L3 20 L16.5 16.5 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
        </svg>
    );
}

export function DoodleCornerFlourish(props) {
    return (
        <svg viewBox="0 0 60 60" fill="none" style={{ filter: "url(#sketchy-wobble)" }} {...props}>
            <path d="M4 30 Q4 4 30 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="30" cy="4" r="2.5" fill="currentColor" />
        </svg>
    );
}
