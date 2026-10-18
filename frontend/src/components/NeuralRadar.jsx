import { useEffect, useRef } from "react";
import { startRadarSweep, animateNeuralNodes } from "../animations/neuralAnimations";
import "../styles/modules.css";

export default function NeuralRadar({ loading, confidence = 0, flaggedFields = [], isAnomalous = false }) {
  const sweepRef = useRef(null);
  const nodesRef = useRef([]);

  useEffect(() => {
    let sweepAnim = null;
    if (loading && sweepRef.current) {
      sweepAnim = startRadarSweep(sweepRef.current);
    }
    return () => {
      if (sweepAnim) sweepAnim.pause();
    };
  }, [loading]);

  const nodes = [
    { id: "hour",         label: "TIME",    x: "50%",  y: "20%" },
    { id: "amount",       label: "AMOUNT",  x: "80%",  y: "50%" },
    { id: "transactions", label: "FREQ",    x: "65%",  y: "85%" },
    { id: "new_device",   label: "DEVICE",  x: "35%",  y: "85%" },
    { id: "failed_logins",label: "AUTH",    x: "20%",  y: "50%" },
  ];

  return (
    <div className="radar-container">
      {/* ── Background Radar Rings ── */}
      <div className="radar-ringring ring-1"></div>
      <div className="radar-ringring ring-2"></div>
      <div className="radar-ringring ring-3"></div>

      {/* ── Rotating Sweep ── */}
      {loading && <div ref={sweepRef} className="radar-sweep"></div>}

      {/* ── Central Hub ── */}
      <div className={`radar-hub ${loading ? "active" : ""}`}>
        <div className="hub-inner"></div>
        {!loading && (
            <div className="radar-status-readout mono" style={{
                position: 'absolute',
                top: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                color: isAnomalous ? 'var(--red)' : 'var(--cyan)',
                whiteSpace: 'nowrap',
                fontWeight: 900,
                textAlign: 'center'
            }}>
                ANOMALY_PROB: {confidence}%
            </div>
        )}
      </div>

      {/* ── Input Nodes ── */}
      {nodes.map((node, i) => {
        const isFlagged = flaggedFields.includes(node.id);
        return (
          <div
            key={node.id}
            className={`radar-node ${isFlagged ? "flagged" : ""}`}
            style={{ left: node.x, top: node.y }}
          >
            <div className="node-dot"></div>
            <span className="node-label">{node.label}</span>
          </div>
        );
      })}
    </div>
  );
}
