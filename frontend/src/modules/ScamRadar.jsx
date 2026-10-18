import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeScam } from "../api/api";
import ResultPanel from "../components/ResultPanel";
import GuardianAlert from "../components/GuardianAlert";
import ConfidenceBar from "../components/ConfidenceBar";
import Loader from "../components/Loader";
import { loadGuardian, sendGuardianAlert } from "../hooks/useGuardian";
import "../styles/modules.css";

export default function ScamRadar() {
  const [message,      setMessage]      = useState("");
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [moduleId,     setModuleId]     = useState("");
  const [guardianAlert, setGuardianAlert] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setModuleId(`UNIT-${Math.floor(Math.random() * 900 + 100)}-SR`);
  }, []);

  const handleAnalyze = async (manualText = null) => {
    const textToScan = typeof manualText === "string" ? manualText : message;
    if (!textToScan.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeScam(textToScan);
      setResult(data);

      // ── Guardian Alert on critical risk ──
      const risk = data?.confidence ?? data?.risk_score ?? 0;
      if (risk >= 90) {
        const guardian = loadGuardian();
        if (guardian) {
          const alertResult = await sendGuardianAlert({
            guardian,
            module:         "SCAM_RADAR",
            riskScore:      risk,
            suspectMessage: textToScan,
          });
          if (alertResult.success) setGuardianAlert(alertResult.payload);
        }
      }

    } catch (err) {
      setError("Pattern analysis failed. Metadata signature missing.");
    } finally {
      setLoading(false);
    }
  };

  const samples = [
    "Your KYC will be suspended. Update immediately to avoid account freeze.",
    "UPI collect request pending. Approve now or your account will be blocked.",
    "Digital arrest notice issued. Pay fine immediately to avoid legal action.",
  ];

  return (
    <div className="forensic-module">

      {/* ── Guardian Alert Modal ── */}
      <GuardianAlert
        alert={guardianAlert}
        onDismiss={() => setGuardianAlert(null)}
      />

      {/* ── Technical Header ── */}
      <div className="module-header-technical">
        <div className="module-id-label mono">// {moduleId} // PATTERN.PROBE</div>
        <h2 className="module-technical-title">
          SCAM <span className="text-cyan">RADAR</span>
        </h2>
        <div className="module-desc mono">SOCIAL_ENGINEERING_SCANNER_V4_ACTIVE</div>
      </div>

      {/* ── Demo Controls ── */}
      <div className="demo-controls">
        {samples.map((s, i) => (
          <button
            key={i}
            className="btn-demo"
            onClick={() => { setMessage(s); handleAnalyze(s); }}
          >
            [ PROBE_SIGNATURE_0{i + 1} ]
          </button>
        ))}
      </div>

      {/* ── Technical Input ── */}
      <div className="forensic-input-group">
        <span className="forensic-label mono">// SUSPICIOUS_MESSAGE_BODY</span>
        <div className="input-bracket-wrap">
          <textarea
            className="forensic-input"
            rows={5}
            placeholder="PASTE SMS, WHATSAPP, OR EMAIL CONTENT FOR PATTERN SCANNING..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>

      {/* ── Buttons ── */}
      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        <button
          className="btn-forensic-scan"
          onClick={handleAnalyze}
          disabled={loading || !message.trim()}
          style={{ flex: 1 }}
        >
          {loading ? "ANALYZING_PATTERNS..." : "[ LAUNCH_SCAM_PROBE ]"}
        </button>
        <button
          className="btn-demo"
          style={{ padding: "0 24px" }}
          onClick={() => { setMessage(""); setResult(null); setError(null); }}
        >
          CLEAR
        </button>
      </div>

      {/* ── Loading ── */}
      {/* ── Confidence Bar Animation ── */}
      {(loading || result) && (
        <ConfidenceBar
          confidence={result?.confidence || 0}
          color={result?.risk_color || "green"}
        />
      )}

      {loading && <Loader text="ISOLATING_THREAT_SIGNATURES..." />}

      {/* ── Error ── */}
      {error && (
        <div className="error-box mono">
          !! CRITICAL_ERROR: {error}
        </div>
      )}

      {/* ── Result ── */}
      {result && !loading && (
        <>
          {/* Main result panel */}
          <ResultPanel result={result} />

          {/* ── Scam Category Badge ── */}
          {result.scam_category && (
            <div style={{
              marginTop:    "12px",
              padding:      "12px 16px",
              background:   "var(--surface)",
              border:       `1px solid ${result.scam_category_color || "#FF2D55"}40`,
              borderRadius: "6px",
              display:      "flex",
              alignItems:   "center",
              gap:          "10px"
            }}>
              <span style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "9px",
                letterSpacing: "3px",
                color:         "var(--muted)"
              }}>
                // SCAM TYPE DETECTED
              </span>
              <span style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "13px",
                fontWeight:    "700",
                color:         result.scam_category_color || "#FF2D55",
                marginLeft:    "auto"
              }}>
                ⚠ {result.scam_category}
              </span>
            </div>
          )}

          {/* ── Hand the message to the honeypot agent ── */}
          {result.risk_color && result.risk_color !== "green" && (
            <button
              className="btn-forensic-scan"
              style={{ marginTop: "12px", width: "100%" }}
              onClick={() => navigate("/dashboard", { state: { tab: "honeypot", seedMessage: message } })}
            >
              [ ENGAGE_WITH_HONEYPOT_AGENT → ]
            </button>
          )}
        </>
      )}

    </div>
  );
}
