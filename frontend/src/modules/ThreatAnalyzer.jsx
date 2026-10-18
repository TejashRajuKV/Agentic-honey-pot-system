import { useState, useEffect } from "react";
import api from "../api/api";
import ENDPOINTS from "../api/endpoints";
import Loader from "../components/Loader";
import ResultPanel from "../components/ResultPanel";
import GuardianAlert from "../components/GuardianAlert";
import DarkWebPulse from "../components/DarkWebPulse";
import { loadGuardian, sendGuardianAlert } from "../hooks/useGuardian";
import "../styles/modules.css";

export default function ThreatAnalyzer() {
  const [message,  setMessage]  = useState("");
  const [url,      setUrl]      = useState("");
  const [app,      setApp]      = useState("");
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [moduleId, setModuleId] = useState("");
  const [guardianAlert, setGuardianAlert] = useState(null);

  useEffect(() => {
    setModuleId(`CORE-${Math.floor(Math.random() * 999 + 1)}-ANALYZER`);
  }, []);

  const handleAnalyze = async () => {
    if (!message.trim() && !url.trim() && !app.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await api.post(ENDPOINTS.THREAT, {
        message, url, app
      });
      const data = response.data;
      setResult(data);

      // ── Guardian Alert on critical risk ──────────────────
      const risk = data?.overall_confidence ?? 0;
      if (risk >= 90) {
        const guardian = loadGuardian();
        if (guardian) {
          const alertResult = await sendGuardianAlert({
            guardian,
            module:        "THREAT_ANALYZER",
            riskScore:     risk,
            suspectMessage: message || url || app,
          });
          if (alertResult.success) setGuardianAlert(alertResult.payload);
        }
      }
      // ─────────────────────────────────────────────────────

    } catch (err) {
      setError("Multi-vector correlation failed. Core engine offline.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessage(""); setUrl(""); setApp("");
    setResult(null); setError(null);
  };

  return (
    <div className="forensic-module">
      {/* ── Guardian Alert Modal ── */}
      <GuardianAlert alert={guardianAlert} onDismiss={() => setGuardianAlert(null)} />

      {/* ── Technical Header ── */}
      <div className="module-header-technical">
        <div className="module-id-label mono">// {moduleId} // CENTRAL.HUB</div>
        <h2 className="module-technical-title">THREAT <span className="text-cyan">ANALYZER</span></h2>
        <div className="module-desc mono">UNIFIED_FORENSIC_FUSION_ENGINE_ACTIVE</div>
      </div>

      {/* ── Technical Inputs ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div className="forensic-input-group">
          <span className="forensic-label mono">// VECTOR_01: COMMUNICATION_STREAM</span>
          <div className="input-bracket-wrap">
            <textarea
              className="forensic-input"
              rows={3}
              placeholder="PASTE SUSPICIOUS MESSAGE CONTENT..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <div className="forensic-input-group">
          <span className="forensic-label mono">// VECTOR_02: NETWORK_ENDPOINTS</span>
          <div className="input-bracket-wrap">
            <input
              className="forensic-input"
              type="text"
              placeholder="https://suspicious-uri.com/target"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="forensic-input-group">
          <span className="forensic-label mono">// VECTOR_03: APPLICATION_ENTITY</span>
          <div className="input-bracket-wrap">
            <input
              className="forensic-input"
              type="text"
              placeholder="APP NAME (e.g. QuickCash, EasyLoan)"
              value={app}
              onChange={(e) => setApp(e.target.value)}
            />
          </div>
        </div>

      </div>

      {/* ── Buttons ── */}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <button
          className="btn-forensic-scan"
          onClick={handleAnalyze}
          disabled={loading || (!message.trim() && !url.trim() && !app.trim())}
          style={{ flex: 1 }}
        >
          {loading ? "CORRELATING_VECTORS..." : "[ START_MULTI_VECTOR_SCAN ]"}
        </button>
        <button className="btn-demo" style={{ padding: "0 24px" }} onClick={handleClear}>
          RESET
        </button>
      </div>

      {loading && <Loader text="EXECUTING_CROSS_MODULE_THREAT_FUSION..." />}

      {error && <div className="error-box mono">!! CRITICAL_ERROR: {error}</div>}

      {/* ── Results ── */}
      {result && !loading && (
        <div style={{ marginTop: "40px" }} className="fade-up">
          <div className="module-id-label mono" style={{ marginBottom: "16px" }}>// FUSION_REPORT_SUMMARY</div>
          
          <div className="result-dossier">
             <div className="verdict-stamp-wrap">
                <div className={`verdict-stamp ${result.overall_color === 'red' ? 'stamp-anomaly' : 'stamp-clear'}`}>
                  {result.overall_color === 'red' ? "THREAT" : "SECURE"}
                </div>
              </div>

              <div className="dossier-line">
                <div className="dossier-label">OVERALL_RISK</div>
                <div className="dossier-value" style={{ 
                  color: result.overall_color === 'red' ? 'var(--red)' : result.overall_color === 'yellow' ? 'var(--amber)' : 'var(--green)',
                  fontWeight: 900,
                  fontSize: '24px'
                }}>
                  {result.overall_label.toUpperCase()}
                </div>
              </div>

              <div className="dossier-line">
                <div className="dossier-label">FUSION_CONFIDENCE</div>
                <div className="dossier-value mono">{result.overall_confidence}%</div>
              </div>

              <div className="dossier-line">
                <div className="dossier-label">ACTIVE_THREATS</div>
                <div className="dossier-value">{result.threat_count} POSITIVE_DETECTIONS</div>
              </div>
          </div>

          {/* Individual Threat Details */}
          {result.threats.map((threat, i) => (
            <div key={i} className="result-dossier" style={{ marginTop: '20px', borderLeft: `4px solid ${threat.color === 'red' ? 'var(--red)' : 'var(--amber)'}` }}>
               <div className="dossier-line">
                  <div className="dossier-label">THREAT_TYPE</div>
                  <div className="dossier-value mono" style={{ color: threat.color === 'red' ? 'var(--red)' : 'var(--amber)' }}>
                    {threat.icon} {threat.type.toUpperCase()}
                  </div>
                </div>
                <div className="dossier-line">
                  <div className="dossier-label">REASONING</div>
                  <div className="dossier-value">
                    {threat.reason.split(" + ").map((r, j) => (
                      <div key={j} className="mono" style={{ fontSize: '12px' }}>» {r}</div>
                    ))}
                  </div>
                </div>
            </div>
          ))}

          {result.safe && (
             <div className="result-dossier" style={{ marginTop: '20px', textAlign: 'center' }}>
                <div className="text-green mono" style={{ fontSize: '20px', fontWeight: 900 }}>[ NO_THREATS_DETECTED ]</div>
                <div className="mono muted" style={{ marginTop: '8px' }}>SYSTEM_INTEL_CLEARED</div>
             </div>
          )}
        </div>
      )}

      {/* ── Dark Web Pulse Panel ── */}
      <DarkWebPulse />
    </div>
  );
}