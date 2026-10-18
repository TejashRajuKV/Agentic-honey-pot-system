// Minimal line-art icons for the boot greeting sequence.
// Kept as plain inline SVG (no icon library dependency) so each
// matches the brand's shield/scan visual language exactly.

const base = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

export function IconShield(props) {
    return (
        <svg {...base} {...props}>
            <path d="M12 2.5 L20.5 6 V12 C20.5 17 16.8 20.5 12 21.5 C7.2 20.5 3.5 17 3.5 12 V6 Z" />
        </svg>
    );
}

export function IconLock(props) {
    return (
        <svg {...base} {...props}>
            <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
            <path d="M7.5 10.5 V7 a4.5 4.5 0 0 1 9 0 v3.5" />
            <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function IconRadar(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
            <path d="M12 12 L19 6" />
        </svg>
    );
}

export function IconEye(props) {
    return (
        <svg {...base} {...props}>
            <path d="M2.5 12 C5 7 9 4.5 12 4.5 C15 4.5 19 7 21.5 12 C19 17 15 19.5 12 19.5 C9 19.5 5 17 2.5 12 Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

export function IconNetwork(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="5" cy="6" r="2" />
            <circle cx="19" cy="6" r="2" />
            <circle cx="12" cy="18" r="2" />
            <path d="M6.7 7.2 L10.5 16.3 M17.3 7.2 L13.5 16.3 M7 6 H17" />
        </svg>
    );
}

export function IconBugSlash(props) {
    return (
        <svg {...base} {...props}>
            <rect x="8" y="8" width="8" height="10" rx="4" />
            <path d="M12 8 V5.5 M9 10 L6 8 M15 10 L18 8 M9 15 H5 M15 15 H19" />
            <path d="M3.5 3.5 L20.5 20.5" />
        </svg>
    );
}

export function IconCheckCircle(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5 L11 15.5 L16.5 9" />
        </svg>
    );
}

export function IconShieldCheck(props) {
    return (
        <svg {...base} {...props}>
            <path d="M12 2.5 L20.5 6 V12 C20.5 17 16.8 20.5 12 21.5 C7.2 20.5 3.5 17 3.5 12 V6 Z" />
            <path d="M8.5 12.2 L11 14.7 L15.5 9.8" />
        </svg>
    );
}

export function IconAlertTriangle(props) {
    return (
        <svg {...base} {...props}>
            <path d="M12 3.5 L21 19.5 H3 Z" />
            <path d="M12 9.5 V14" />
            <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </svg>
    );
}
