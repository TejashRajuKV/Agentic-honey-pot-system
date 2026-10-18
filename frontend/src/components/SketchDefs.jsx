// Hidden SVG defs providing a reusable "hand-drawn wobble" filter.
// Apply via CSS: filter: url(#sketchy-wobble);
// Render this once per page — the filter is referenced by id globally.
export default function SketchDefs() {
    return (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <defs>
                <filter id="sketchy-wobble" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.018 0.025" numOctaves="2" seed="7" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
                </filter>
                <filter id="sketchy-wobble-lg" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </defs>
        </svg>
    );
}
