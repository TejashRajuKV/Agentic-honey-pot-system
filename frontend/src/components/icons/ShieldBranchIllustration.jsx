// A hand-drawn "one root, many shields" illustration — a central defense
// trunk branching into seven nodes (one per module), our security-themed
// reinterpretation of a botanical branch-with-leaves layout motif.
export default function ShieldBranchIllustration({ className }) {
    return (
        <svg
            className={className}
            viewBox="0 0 200 360"
            fill="none"
            style={{ filter: "url(#sketchy-wobble)" }}
        >
            {/* root shield at the base */}
            <path
                d="M100 300 L124 310 V330 C124 344 114 353 100 358 C86 353 76 344 76 330 V310 Z"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="var(--card)"
            />
            <path d="M90 328 L97 335 L112 317" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* trunk */}
            <path d="M100 300 V40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />

            {/* seven branches alternating left/right, each ending in a node */}
            <g strokeWidth="2" strokeLinecap="round">
                <path d="M100 280 Q60 270 38 250" stroke="currentColor" fill="none" />
                <path d="M100 245 Q142 236 166 214" stroke="currentColor" fill="none" />
                <path d="M100 210 Q58 200 34 178" stroke="currentColor" fill="none" />
                <path d="M100 175 Q144 165 170 142" stroke="currentColor" fill="none" />
                <path d="M100 140 Q60 128 36 106" stroke="currentColor" fill="none" />
                <path d="M100 105 Q142 94 164 70" stroke="currentColor" fill="none" />
                <path d="M100 70  Q70 55 56 32"   stroke="currentColor" fill="none" />
            </g>

            {/* branch-end nodes */}
            <g fill="var(--cyan)">
                <circle cx="38"  cy="250" r="5" />
                <circle cx="166" cy="214" r="5" />
                <circle cx="34"  cy="178" r="5" />
                <circle cx="170" cy="142" r="5" />
                <circle cx="36"  cy="106" r="5" />
                <circle cx="164" cy="70"  r="5" />
                <circle cx="56"  cy="32"  r="5" />
            </g>
        </svg>
    );
}
