import { useState, useEffect } from "react";
import { analyzeNews } from "../api/api";
import ResultPanel from "../components/ResultPanel";
import Loader from "../components/Loader";
import TruthGauge from "../components/TruthGauge";
import "../styles/modules.css";

export default function FakeNewsChecker() {
  const [text,      setText]      = useState("");
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [moduleId,  setModuleId]  = useState("");

  useEffect(() => {
    setModuleId(`UNIT-${Math.floor(Math.random() * 900 + 100)}-FN`);
  }, []);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeNews(text);
      setResult(data);
    } catch (err) {
      setError("Source authentication failed. Data stream corrupted.");
    } finally {
      setLoading(false);
    }
  };

  const samples = [
    "Government gives free Rs 10000 to all Aadhaar card holders.",
    "RBI raises repo rate by 25 basis points to control inflation in India.",
    "WhatsApp will shut down next week unless you forward this message.",
  ];

  return (
    <div className="forensic-module">

      {/* ── Technical Header ── */}
      <div className="module-header-technical">
        <div className="module-id-label mono">// {moduleId} // LINGUISTIC.PROBE</div>
        <h2 className="module-technical-title">
          FAKE NEWS <span className="text-cyan">CHECKER</span>
        </h2>
        <div className="module-desc mono">STANCE_DETECTION_ENGINE_V1_ACTIVE</div>
      </div>

      {/* ── Demo Controls ── */}
      <div className="demo-controls">
        {samples.map((s, i) => (
          <button
            key={i}
            className="btn-demo"
            onClick={() => setText(s)}
          >
            LOAD_SAMPLE_0{i + 1}
          </button>
        ))}
      </div>

      {/* ── Technical Input ── */}
      <div className="forensic-input-group">
        <span className="forensic-label mono">// DATA_STREAM_INPUT</span>
        <div className="input-bracket-wrap">
          <textarea
            className="forensic-input"
            rows={5}
            placeholder="PASTE NEWS HEADLINE OR MESSAGE FOR SOURCE AUTHENTICATION..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      {/* ── Buttons ── */}
      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        <button
          className="btn-forensic-scan"
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
          style={{ flex: 1 }}
        >
          {loading ? "AUTHENTICATING_SOURCES..." : "[ INITIATE_SOURCE_VERIFICATION ]"}
        </button>
        <button
          className="btn-demo"
          style={{ padding: "0 24px" }}
          onClick={() => { setText(""); setResult(null); setError(null); }}
        >
          RESET
        </button>
      </div>

      {/* ── Truth Gauge ── */}
      {(loading || result) && (
        <TruthGauge
          confidence={result?.confidence || 50}
          loading={loading}
        />
      )}

      {loading && <Loader text="CROSS_REFERENCING_GLOBAL_INTEL..." />}

      {/* ── Error ── */}
      {error && (
        <div className="error-box mono">
          !! CRITICAL_ERROR: {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <>
          {/* Main result panel */}
          <ResultPanel result={result} />

          {/* ── WhatsApp Forward Detection Badge ── */}
          {result.forward_detection && (
            <div style={{
              marginTop:    "12px",
              padding:      "12px 16px",
              background:   "var(--surface)",
              border:       `1px solid ${
                result.forward_detection.is_forwarded
                  ? "rgba(255,208,0,0.4)"
                  : "rgba(0,255,157,0.2)"
              }`,
              borderRadius: "6px",
            }}>
              {/* Header row */}
              <div style={{
                display:       "flex",
                alignItems:    "center",
                justifyContent: "space-between",
                marginBottom:  result.forward_detection.is_forwarded ? "10px" : "0"
              }}>
                <span style={{
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "9px",
                  letterSpacing: "3px",
                  color:         "var(--muted)"
                }}>
                  // WHATSAPP_FORWARD_ANALYSIS
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize:   "11px",
                  fontWeight: "700",
                  color: result.forward_detection.is_forwarded
                    ? "var(--yellow)"
                    : "var(--green)"
                }}>
                  {result.forward_detection.is_forwarded
                    ? `⚠ VIRAL_CONTENT_DETECTED`
                    : `✓ NO_FORWARD_PATTERNS`
                  }
                </span>
              </div>

              {/* Viral risk level */}
              {result.forward_detection.is_forwarded && (
                <>
                  <div style={{
                    display:    "flex",
                    alignItems: "center",
                    gap:        "8px",
                    marginBottom: "8px"
                  }}>
                    <span style={{
                      fontFamily:    "var(--font-mono)",
                      fontSize:      "10px",
                      color:         "var(--muted)"
                    }}>
                      VIRAL_RISK:
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize:   "11px",
                      fontWeight: "700",
                      color: result.forward_detection.viral_risk === "HIGH"
                        ? "var(--red)"
                        : "var(--yellow)"
                    }}>
                      {result.forward_detection.viral_risk}
                    </span>
                  </div>

                  {/* Forward indicators */}
                  {result.forward_detection.forward_indicators.length > 0 && (
                    <div style={{
                      display:  "flex",
                      flexWrap: "wrap",
                      gap:      "6px"
                    }}>
                      {result.forward_detection.forward_indicators.map((ind, i) => (
                        <span key={i} style={{
                          fontFamily:    "var(--font-mono)",
                          fontSize:      "10px",
                          padding:       "3px 8px",
                          borderRadius:  "3px",
                          background:    "rgba(255,208,0,0.1)",
                          color:         "var(--yellow)",
                          border:        "1px solid rgba(255,208,0,0.3)"
                        }}>
                          {ind}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Viral Warning Banner ── */}
          {result.forward_detection?.viral_risk === "HIGH" && (
            <div style={{
              marginTop:    "8px",
              padding:      "12px 16px",
              background:   "rgba(255,45,85,0.08)",
              border:       "1px solid rgba(255,45,85,0.3)",
              borderRadius: "6px",
              fontFamily:   "var(--font-mono)",
              fontSize:     "11px",
              color:        "var(--red)",
              lineHeight:   "1.7"
            }}>
              ⚠ HIGH VIRAL RISK — This message is being mass-forwarded.
              Do NOT share without verification from official sources.
            </div>
          )}
        </>
      )}

    </div>
  );
}
