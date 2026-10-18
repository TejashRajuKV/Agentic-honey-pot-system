import { useState, useEffect } from "react";
import { analyzeBehavior } from "../api/api";
import ResultPanel from "../components/ResultPanel";
import Loader from "../components/Loader";
import NeuralRadar from "../components/NeuralRadar";
import "../styles/modules.css";

const defaultData = {
  hour:          12,
  amount:        500,
  transactions:  3,
  new_device:    0,
  failed_logins: 0,
};

const anomalyData = {
  hour:          2,
  amount:        95000,
  transactions:  25,
  new_device:    1,
  failed_logins: 5,
};

// ─────────────────────────────────────────
// Analysis bars — REAL data only: the user's own previous analyses (kept in this browser)
// plus the one just performed. Height = the model's confidence; colour = the model's verdict.
// ─────────────────────────────────────────
const TXLOG_KEY = "bm_txlog";
const readTxLog = () => {
  try { return JSON.parse(localStorage.getItem(TXLOG_KEY)) || []; } catch { return []; }
};
const isAnomalyLabel = (label) => label === "ANOMALY" || label === "HIGH RISK";

const buildBars = (past, current) => [
  ...past.map((e, i) => ({
    height:    12 + (e.confidence / 100) * 68,
    anomalous: e.anomalous,
    label:     `A-${past.length - i}`,
    amount:    e.amount,
  })),
  {
    height:    12 + (current.confidence / 100) * 68,
    anomalous: current.anomalous,
    label:     "NOW",
    amount:    current.amount,
  },
];

export default function BehaviorMonitor() {
  const [formData, setFormData] = useState(defaultData);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [moduleId, setModuleId] = useState("");
  const [bars,     setBars]     = useState([]);
  const [history,  setHistory]  = useState(() => {
    const saved = localStorage.getItem("bm_history");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    setModuleId(`UNIT-${Math.floor(Math.random() * 900 + 100)}-BM`);
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: Number(value) }));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeBehavior(formData);
      setResult(data);

      // ── Chart: previous real analyses + this one (model verdicts, not simulated) ──
      const entry = { amount: formData.amount, confidence: data.confidence, anomalous: isAnomalyLabel(data.label) };
      const past = readTxLog().slice(-4);
      setBars(buildBars(past, entry));
      try { localStorage.setItem(TXLOG_KEY, JSON.stringify([...past, entry].slice(-5))); } catch { /* storage unavailable */ }

      // ── Update History (Local Persistence) ──
      const timestamp = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

      const historyEntry = {
        time: timestamp,
        verdict: data.label,
        confidence: data.confidence,
      };

      const newHistory = [historyEntry, ...history].slice(0, 3);
      setHistory(newHistory);
      localStorage.setItem("bm_history", JSON.stringify(newHistory));

    } catch (err) {
      setError("Forensic probe failed. Connection interrupted.");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "hour",          label: "LOGIN_HOUR [0-23]",           min: 0,  max: 23,     step: 1   },
    { key: "amount",        label: "TRANSACTION_AMOUNT [₹]",      min: 0,  max: 999999, step: 100 },
    { key: "transactions",  label: "DAILY_TRANSACTION_COUNT",     min: 0,  max: 100,    step: 1   },
    { key: "new_device",    label: "NEW_DEVICE [0=NO / 1=YES]",   min: 0,  max: 1,      step: 1   },
    { key: "failed_logins", label: "FAILED_LOGIN_ATTEMPTS",       min: 0,  max: 20,     step: 1   },
  ];

  return (
    <div className="forensic-module">

      {/* ── Technical Header ── */}
      <div className="module-header-technical">
        <div className="module-id-label mono">// {moduleId} // SYSTEM.PROBE</div>
        <h2 className="module-technical-title">
          BEHAVIOR <span className="text-cyan">MONITOR</span>
        </h2>
        <div className="module-desc mono">ANOMALY_DETECTION_ENGINE_V2_ACTIVE</div>
      </div>

      {/* ── Demo Controls ── */}
      <div className="demo-controls">
        <button className="btn-demo" onClick={() => {
          setFormData(defaultData);
          setResult(null);
          setBars([]);
          setError(null);
        }}>
          LOAD_BASELINE
        </button>
        <button className="btn-demo" onClick={() => {
          setFormData(anomalyData);
          setResult(null);
          setBars([]);
          setError(null);
        }}>
          LOAD_ANOMALY_VECTOR
        </button>
      </div>

      {/* ── Behavior Scanner Interface ── */}
      <div className="behavior-interface-wrap" style={{ display: "flex", flexWrap: "wrap", gap: "40px", alignItems: "flex-start", justifyContent: "center" }}>
        
        {/* ── Technical Inputs ── */}
        <div className="behavior-inputs-panel" style={{ flex: "1", minWidth: "300px", maxWidth: "600px" }}>
          <div className="behavior-grid">
            {fields.map((field) => (
              <div key={field.key} className="forensic-input-group">
                <span className="forensic-label mono">{field.label}</span>
                <div className="input-bracket-wrap">
                  <input
                    type="number"
                    className="forensic-input"
                    value={formData[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn-forensic-scan"
            onClick={handleAnalyze}
            disabled={loading}
            style={{ marginTop: "20px" }}
          >
            {loading ? "SCANNING_PACKETS..." : "[ START_BEHAVIOR_ANALYSIS ]"}
          </button>
        </div>

        {/* ── Animation Section ── */}
        <div className="behavior-viz-panel" style={{ flex: "1", minWidth: "320px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {(loading || result) && (
            <NeuralRadar
              loading={loading}
              confidence={result?.confidence || 0}
              flaggedFields={result?.flagged_words || []}
              isAnomalous={result?.label === "HIGH RISK" || result?.label === "ANOMALY"}
            />
          )}
          {!loading && !result && (
            <div className="radar-placeholder" style={{ width: "320px", height: "320px", border: "1px dashed var(--border)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontStyle: "italic", fontSize: "12px", margin: "40px auto" }}>
              WAITING_FOR_DATA_STREAM...
            </div>
          )}

          {/* ── Risk Timeline History ── */}
          {history.length > 0 && (
            <div className="risk-timeline">
              <div className="timeline-header mono">RISK_TIMELINE_HISTORY</div>
              <div className="timeline-items">
                {history.map((entry, idx) => (
                  <div key={idx} className={`timeline-entry ${entry.verdict === "HIGH RISK" ? "extreme" : ""}`}>
                    <span className="time">{entry.time}</span>
                    <span className="separator">→</span>
                    <span className={`verdict ${entry.verdict.replace(" ", "-").toLowerCase()}`}>
                      {entry.verdict} {entry.confidence}% {entry.verdict === "HIGH RISK" ? "⚠" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && <Loader text="CORRELATING_DATA_POINTS..." />}

      {error && (
        <div className="error-box mono">!! CRITICAL_ERROR: {error}</div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <>
          {/* Main result panel */}
          <ResultPanel result={result} />

          {/* ── Transaction Pattern Chart ── */}
          {bars.length > 0 && (
            <div style={{
              marginTop:    "12px",
              padding:      "20px",
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: "6px",
            }}>

              {/* Chart header */}
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "center",
                marginBottom:   "16px"
              }}>
                <span style={{
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "9px",
                  letterSpacing: "3px",
                  color:         "var(--muted)"
                }}>
                  // ANALYSIS_HISTORY
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize:   "9px",
                  color:      "var(--muted)"
                }}>
                  LAST_5_ANALYSES (THIS_BROWSER)
                </span>
              </div>

              {/* Bar chart */}
              <div style={{
                display:    "flex",
                gap:        "8px",
                alignItems: "flex-end",
                height:     "90px",
              }}>
                {bars.map((bar, i) => (
                  <div key={i} style={{
                    flex:          "1",
                    display:       "flex",
                    flexDirection: "column",
                    alignItems:    "center",
                    gap:           "6px",
                    height:        "100%",
                    justifyContent: "flex-end"
                  }}>
                    {/* Amount tooltip on hover */}
                    <div
                      title={`₹${Number(bar.amount).toLocaleString("en-IN")}`}
                      style={{
                        width:        "100%",
                        height:       `${bar.height}px`,
                        background:   bar.anomalous
                          ? "linear-gradient(180deg, #FF2D55, #FF2D5580)"
                          : "linear-gradient(180deg, #00FF9D, #00FF9D60)",
                        borderRadius: "3px 3px 0 0",
                        opacity:      i === bars.length - 1 ? 1 : 0.55,
                        transition:   "height 0.6s ease",
                        cursor:       "pointer",
                        position:     "relative",
                      }}
                    />
                    {/* Label */}
                    <span style={{
                      fontFamily:    "var(--font-mono)",
                      fontSize:      "8px",
                      color:         i === bars.length - 1
                        ? (bar.anomalous ? "#FF2D55" : "#00FF9D")
                        : "var(--muted)",
                      fontWeight:    i === bars.length - 1 ? "700" : "400"
                    }}>
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider line */}
              <div style={{
                height:     "1px",
                background: "var(--border)",
                margin:     "8px 0"
              }} />

              {/* Legend */}
              <div style={{
                display:    "flex",
                gap:        "16px",
                fontFamily: "var(--font-mono)",
                fontSize:   "9px"
              }}>
                <span style={{ color: "#00FF9D" }}>■ NORMAL</span>
                <span style={{ color: "#FF2D55" }}>■ ANOMALOUS</span>
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  HEIGHT=MODEL_CONFIDENCE · HOVER_FOR_AMOUNT
                </span>
              </div>

              {/* Anomaly count summary */}
              {bars.filter(b => b.anomalous).length > 0 && (
                <div style={{
                  marginTop:    "12px",
                  padding:      "8px 12px",
                  background:   "rgba(255,45,85,0.06)",
                  border:       "1px solid rgba(255,45,85,0.2)",
                  borderRadius: "4px",
                  fontFamily:   "var(--font-mono)",
                  fontSize:     "10px",
                  color:        "#FF2D55"
                }}>
                  ⚠ {bars.filter(b => b.anomalous).length}/{bars.length} ANALYSES_FLAGGED_AS_ANOMALOUS
                </div>
              )}

            </div>
          )}
        </>
      )}

    </div>
  );
}



