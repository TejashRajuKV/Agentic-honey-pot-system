import { useEffect, useRef } from "react";
import { animateResultCard } from "../animations/riskAnimation";
import { getRiskColor } from "../utils/riskHelpers";
import "../styles/modules.css";

export default function ResultPanel({ result }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) {
      animateResultCard(panelRef.current);
    }
  }, [result]);

  if (!result) return null;

  const {
    label,
    confidence,
    risk_color,
    reason,
    flagged_words = [],
    explanation   = {}
  } = result;

  const isAnomalous = label === "ANOMALY" || label === "HIGH RISK";

  return (
    <div ref={panelRef} className="result-dossier fade-up">
      {/* ── Dossier Header Detailing ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <div className="mono" style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '2px' }}>
          CASE_ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}
        </div>
        <div className="mono" style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '2px' }}>
          PROBE_TIME: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* ── Verdict Stamp ── */}
      <div className="verdict-stamp-wrap">
        <div className={`verdict-stamp ${isAnomalous ? 'stamp-anomaly' : 'stamp-clear'}`}>
          {isAnomalous ? "DETECTED" : "CLEARED"}
        </div>
      </div>

      <div className="dossier-line">
        <div className="dossier-label">{">>"} CASE_VERDICT</div>
        <div className="dossier-value" style={{ color: getRiskColor(risk_color), fontWeight: 900, fontSize: '18px' }}>
          {label.toUpperCase()}
        </div>
      </div>

      <div className="dossier-line">
        <div className="dossier-label">{">>"} PRIMARY_INDICATORS</div>
        <div className="dossier-value">
          {reason.split(" + ").map((r, i) => (
            <div key={i} className="mono" style={{ fontSize: '12px', marginBottom: '6px', color: 'var(--text)' }}>
              <span className="text-cyan">»</span> {r.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {flagged_words.length > 0 && (
        <div className="dossier-line">
          <div className="dossier-label">{">>"} FLAGGED_SIGNATURES</div>
          <div className="dossier-value">
            <div className="flagged-words">
              {flagged_words.map((word, i) => (
                <span key={i} className="flagged-word">{word}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {explanation.template && (
        <div className="dossier-line">
          <div className="dossier-label">{">>"} NEURAL_DEBRIEF</div>
          <div className="dossier-value italic" style={{ fontSize: '13px', opacity: 0.9, lineHeight: '1.6' }}>
            {explanation.template}
          </div>
        </div>
      )}

      {explanation.tip && (
        <div className="safety-tip-container">
          <div className="safety-tip-header mono">{">>"} RESOLUTION_PROTOCOL</div>
          <div className="safety-tip-body">
            {explanation.tip}
          </div>
        </div>
      )}
    </div>
  );
}
