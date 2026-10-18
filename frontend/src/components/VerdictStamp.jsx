import { useEffect, useRef } from "react";
import { animateStampSlam } from "../animations/newsAnimations";
import "../styles/modules.css";

export default function VerdictStamp({ label }) {
  const stampRef = useRef(null);
  const isFake  = label.includes("HIGH") || label.includes("MEDIUM");
  const text    = isFake ? "DEBUNKED" : "VERIFIED";

  useEffect(() => {
    if (stampRef.current) {
        animateStampSlam(stampRef.current);
    }
  }, []);

  return (
    <div className="stamp-wrapper">
        <div 
            ref={stampRef} 
            className={`verdict-stamp ${isFake ? "stamp-debunked" : "stamp-verified"}`}
        >
            <div className="stamp-inner">
                {text}
            </div>
            <div className="stamp-glitch-layer"></div>
        </div>
    </div>
  );
}
