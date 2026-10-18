import { useState } from "react";
import axios from "axios";
import "../styles/guardian.css";

const SEVERITY_COLOR = {
  CRITICAL: "var(--red)",
  HIGH:     "var(--amber)",
  MEDIUM:   "var(--cyan)",
};

export default function DarkWebPulse() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");

  const handleScan = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("INVALID_EMAIL — enter a valid address");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const { data } = await axios.post("/api/v1/console/breach-check", { email }, { timeout: 15000 });
      setResult({ email, breaches: data.data.breaches });
    } catch (err) {
      setError(
        err.response?.data?.configured === false
          ? "LOOKUP_NOT_CONFIGURED — the server has no HIBP_API_KEY set, so no breach data is available."
          : `SCAN_ERROR: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const found = result?.breaches?.length > 0;

  return (
    <div className="dwp-wrap">
      {/* Header */}
      <div className="dwp-header">
        <div className="dwp-title mono">
          <span className="dwp-icon">⬛</span> DARK_WEB_PULSE
        </div>
        <div className="dwp-desc mono">
          Check an email against known data breaches (Have I Been Pwned)
        </div>
      </div>

      {/* Input */}
      <div className="dwp-input-row">
        <input
          className="forensic-input mono"
          placeholder="// ENTER_EMAIL_FOR_BREACH_SCAN"
          value={email}
          type="email"
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleScan()}
        />
        <button
          className="dwp-scan-btn mono"
          onClick={handleScan}
          disabled={loading}
        >
          {loading ? "SCANNING..." : "[ SCAN ]"}
        </button>
      </div>

      {error && <div className="dwp-error mono">{error}</div>}

      {/* Results */}
      {result && (
        <div className="dwp-result fade-up">
          {/* Verdict stamp */}
          <div className={`dwp-verdict ${found ? "breach-found" : "clean"}`}>
            {found
              ? `⚠ EXPOSURE DETECTED — ${result.breaches.length} BREACH${result.breaches.length > 1 ? "ES" : ""}`
              : "✓ NO EXPOSURE DETECTED"
            }
          </div>

          {found && (
            <>
              <div className="dwp-risk-note mono">
                ⚡ Your data was exposed in{" "}
                {result.breaches.filter(b => b.severity === "CRITICAL").length} critical breach(es).
                This significantly elevates your scam target profile.
              </div>

              {/* Breach table */}
              <div className="dwp-breach-list">
                {result.breaches.map((b, i) => (
                  <div key={i} className="dwp-breach-row">
                    <div className="dwp-breach-left">
                      <div className="dwp-breach-name mono">{b.name}</div>
                      <div className="dwp-breach-type mono">{b.type}</div>
                    </div>
                    <div className="dwp-breach-right">
                      <div className="dwp-breach-year mono">{b.year}</div>
                      <div className="dwp-breach-records mono">{b.records} records</div>
                      <div
                        className="dwp-severity mono"
                        style={{ color: SEVERITY_COLOR[b.severity] }}
                      >
                        {b.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dwp-advice mono">
                RECOMMENDATION: Change passwords immediately. Enable 2FA on all accounts.
                Avoid sharing OTPs or personal data via calls/messages.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
