import SpectrumRing from "./SpectrumRing";
import "../styles/heroSpectrumRing.css";

// Hero-corner placement of the shared spectrum ring: big, draws in
// immediately on load, sits over a blurred chip for contrast against the
// painted hero artwork.
export default function HeroSpectrumRing() {
    return (
        <div className="hero-spectrum-ring">
            <SpectrumRing size={110} revealOn="mount" />
        </div>
    );
}
