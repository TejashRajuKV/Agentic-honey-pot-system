import { useEffect, useRef } from "react";
import { animateRiskBadge, animateShake } from "../animations/riskAnimation";
import { getRiskColor, getRiskBgColor, getRiskBorderColor, getRiskEmoji } from "../utils/riskHelpers";
import "../styles/modules.css";

export default function RiskBadge({ label, color, confidence }) {
  const badgeRef = useRef(null);

  useEffect(() => {
    if (badgeRef.current) {
      animateRiskBadge(badgeRef.current);
      if (color === "red") {
        setTimeout(() => animateShake(badgeRef.current), 700);
      }
    }
  }, [label, color]);

  return (
    <div
      ref={badgeRef}
      className="risk-badge"
      style={{
        color:           getRiskColor(color),
        background:      getRiskBgColor(color),
        borderColor:     getRiskBorderColor(color),
      }}
    >
      <span>{getRiskEmoji(color)}</span>
      <span>{label}</span>
      <span style={{ opacity: 0.6, fontSize: "12px" }}>
        {confidence}%
      </span>
    </div>
  );
}
