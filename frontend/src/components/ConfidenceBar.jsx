import { useEffect, useRef } from "react";
import { animateDecrypt, animateProgressBar } from "../animations/counterAnimation";
import { getRiskColor } from "../utils/riskHelpers";
import "../styles/modules.css";

export default function ConfidenceBar({ confidence, color }) {
  const fillRef    = useRef(null);
  const counterRef = useRef(null);

  useEffect(() => {
    if (fillRef.current) {
      // Animate bar fill
      animateProgressBar(fillRef.current, confidence);
    }
    if (counterRef.current) {
      // Animate decrypting counter
      animateDecrypt(counterRef.current, confidence);
    }
  }, [confidence]);

  return (
    <div className="confidence-wrap">
      <div className="confidence-label">
        <span>CONFIDENCE LEVEL</span>
        <span
          ref={counterRef}
          className="confidence-value"
          style={{ color: getRiskColor(color) }}
        >
          0%
        </span>
      </div>
      <div className="confidence-track">
        <div
          ref={fillRef}
          className="confidence-fill"
          style={{
            width:      "0%",
            background: getRiskColor(color),
          }}
        />
      </div>
    </div>
  );
}

