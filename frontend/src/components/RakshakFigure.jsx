import { forwardRef } from "react";

// The hand-inked shield-being artwork used in the boot-sequence story reveal.
const RakshakFigure = forwardRef(function RakshakFigure(
    { className, style, bodyFill = "var(--card)", accentColor = "var(--green)" },
    ref
) {
    return (
        <svg ref={ref} className={className} viewBox="0 0 160 190" fill="none" style={style}>
            {/* left arm */}
            <path d="M24 92 Q4 78 8 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* right arm, waving */}
            <path d="M136 92 Q158 82 150 55" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* body — shield silhouette */}
            <path
                d="M80 12 L136 32 V88 C136 130 112 158 80 172 C48 158 24 130 24 88 V32 Z"
                stroke="currentColor"
                strokeWidth="3"
                fill={bodyFill}
            />
            {/* face */}
            <circle cx="64" cy="76" r="4.5" fill="currentColor" />
            <circle cx="96" cy="76" r="4.5" fill="currentColor" />
            <path d="M62 98 Q80 112 98 98" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* chest checkmark badge */}
            <circle cx="80" cy="135" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M72 135 L78 142 L90 126" stroke={accentColor} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* little ground scribble */}
            <path d="M40 182 Q80 176 120 182" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </svg>
    );
});

export default RakshakFigure;
