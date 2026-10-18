import { useState, useEffect } from "react";
import { scoreLoan, getLoanRules, checkLoanApp } from "../api/api";
import ResultPanel from "../components/ResultPanel";
import Loader from "../components/Loader";
import SecurityShield from "../components/SecurityShield";
import "../styles/modules.css";

// Labels live here; the point weights and explanations come from the ML engine (/api/v1/ml/loan/rules)
const RULES = [
  { key: "too_many_permissions", label: "APP_REQUESTS_EXCESSIVE_PERMISSIONS", score: 30 },
  { key: "no_rbi_registration",  label: "NO_RBI_REGISTRATION_DETECTED",       score: 40 },
  { key: "instant_approval",     label: "CLAIMS_INSTANT_APPROVAL_SCAM",       score: 20 },
  { key: "high_interest_rate",   label: "INTEREST_EXCEEDS_LEGAL_CAP",         score: 25 },
  { key: "not_on_playstore",     label: "UNOFFICIAL_DISTRIBUTION_SOURCE",     score: 15 },
  { key: "requests_contacts",    label: "DATA_HARVESTING: CONTACT_LIST",      score: 20 },
  { key: "requests_sms",         label: "DATA_HARVESTING: SMS_MESSAGES",      score: 20 },
  { key: "no_physical_address",  label: "ANONYMOUS_LENDER_ENTITY",            score: 15 },
  { key: "pressure_tactics",     label: "PSYCHOLOGICAL_PRESSURE_TACTICS",     score: 25 },
];

// ── RBI Status colors ──
const DB_STATUS_COLORS = {
  RBI_VERIFIED: { color: "#00FF9D", bg: "rgba(0,255,157,0.08)", border: "rgba(0,255,157,0.3)" },
  BLACKLISTED:  { color: "#FF2D55", bg: "rgba(255,45,85,0.08)",  border: "rgba(255,45,85,0.3)"  },
  UNVERIFIED:   { color: "#FFD000", bg: "rgba(255,208,0,0.08)",  border: "rgba(255,208,0,0.3)"  },
  NOT_CHECKED:  { color: "#4A7090", bg: "transparent",           border: "rgba(74,112,144,0.2)" },
};

export default function LoanRiskScanner() {
  const [checked,  setChecked]  = useState({});
  const [appName,  setAppName]  = useState("");
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [moduleId, setModuleId] = useState("");
  const [serverRules, setServerRules] = useState({});
  const [lookup,   setLookup]   = useState(null);
  const [looking,  setLooking]  = useState(false);

  useEffect(() => {
    setModuleId(`UNIT-${Math.floor(Math.random() * 900 + 100)}-LR`);
    getLoanRules().then(setServerRules).catch(() => setServerRules({}));
  }, []);

  const handleLookup = async () => {
    if (!appName.trim()) return;
    setLooking(true);
    setLookup(null);
    try {
      setLookup(await checkLoanApp(appName.trim()));
    } catch {
      setLookup({ db_status: "NOT_CHECKED", error: true });
    } finally {
      setLooking(false);
    }
  };

  const toggleRule = (key) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScore = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const appData = Object.fromEntries(
        RULES.map((r) => [r.key, !!checked[r.key]])
      );

      // ── Include app name ──
      if (appName.trim()) {
        appData.app_name = appName.trim();
      }

      const data = await scoreLoan(appData);
      setResult(data);
    } catch (err) {
      setError("Audit failed. Regulatory dataset inaccessible.");
    } finally {
      setLoading(false);
    }
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;

  // ── Get DB status style ──
  const getDbStyle = (status) =>
    DB_STATUS_COLORS[status] || DB_STATUS_COLORS.NOT_CHECKED;

  // ── DB Status label ──
  const getDbLabel = (status) => ({
    RBI_VERIFIED: "✓ RBI VERIFIED — SAFE",
    BLACKLISTED:  "✗ BLACKLISTED — DANGEROUS",
    UNVERIFIED:   "⚠ UNVERIFIED — CHECK MANUALLY",
    NOT_CHECKED:  "// NO APP NAME PROVIDED",
  }[status] || "// UNKNOWN");

  return (
    <div className="forensic-module">

      {/* ── Technical Header ── */}
      <div className="module-header-technical">
        <div className="module-id-label mono">// {moduleId} // REGULATORY.AUDIT</div>
        <h2 className="module-technical-title">
          LOAN RISK <span className="text-cyan">AUDITOR</span>
        </h2>
        <div className="module-desc mono">PREDATORY_LENDING_DETECTION_CORE_ACTIVE</div>
      </div>

      {/* ── App Name Input ── */}
      <div className="forensic-input-group" style={{ marginBottom: "20px" }}>
        <span className="forensic-label mono">// APP_NAME_DATABASE_LOOKUP (OPTIONAL)</span>
        <div className="input-bracket-wrap">
          <input
            className="forensic-input"
            type="text"
            placeholder="ENTER LOAN APP NAME e.g. CashNow, PhonePe, KreditBee..."
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            style={{ padding: "12px 16px" }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
        </div>
        <button className="btn-demo" style={{ marginTop: "8px" }} onClick={handleLookup} disabled={looking || !appName.trim()}>
          {looking ? "LOOKING_UP..." : "[ QUICK_DATABASE_LOOKUP ]"}
        </button>
        {lookup && (
          <div className="mono" style={{ marginTop: "8px", fontSize: "11px", color: getDbStyle(lookup.db_status).color }}>
            {lookup.error ? "!! LOOKUP_FAILED" : `${getDbLabel(lookup.db_status)}${lookup.app_type ? ` · ${lookup.app_type}` : ""}${lookup.danger_reason ? ` · ${lookup.danger_reason}` : ""}`}
          </div>
        )}
        <div style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "9px",
          color:         "var(--muted)",
          marginTop:     "6px",
          letterSpacing: "1px"
        }}>
          // CHECKS AGAINST RBI VERIFIED + BLACKLISTED DATABASE
        </div>
      </div>

      {/* ── Checklist ── */}
      <div className="checklist-technical">
        {RULES.map((rule) => (
          <div
            key={rule.key}
            className={`checklist-item-forensic ${checked[rule.key] ? "checked" : ""}`}
            onClick={() => toggleRule(rule.key)}
          >
            <div className="check-box mono">{checked[rule.key] ? "[X]" : "[ ]"}</div>
            <div className="check-text mono" title={serverRules[rule.key]?.reason}>{rule.label}</div>
            <div className="check-score mono">+{serverRules[rule.key]?.score ?? rule.score}</div>
          </div>
        ))}
      </div>

      {/* ── Selected Count ── */}
      <div className="module-id-label mono" style={{ margin: "24px 0" }}>
        // {checkedCount} RISK_FACTORS_FLAGGED
      </div>

      {/* ── Buttons ── */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          className="btn-forensic-scan"
          onClick={handleScore}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? "AUDITING_COMPLIANCE..." : "[ INITIATE_SECURITY_AUDIT ]"}
        </button>
        <button
          className="btn-demo"
          style={{ padding: "0 24px" }}
          onClick={() => {
            setChecked({});
            setResult(null);
            setAppName("");
            setError(null);
          }}
        >
          RESET
        </button>
      </div>

      {/* ── Security Shield Visual ── */}
      {(loading || result) && (
        <SecurityShield
          loading={loading}
          riskScore={result?.confidence || 0}
          checkedFactors={Object.keys(checked).filter((k) => checked[k])}
        />
      )}

      {loading && <Loader text="VALIDATING_RBI_COMPLIANCE_PARAMETERS..." />}

      {error && (
        <div className="error-box mono">!! CRITICAL_ERROR: {error}</div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <>
          {/* Main result panel */}
          <ResultPanel result={result} />

          {/* ── RBI Database Badge ── */}
          {result.app_database && (
            <div style={{
              marginTop:    "12px",
              padding:      "14px 16px",
              background:   getDbStyle(result.app_database.db_status).bg,
              border:       `1px solid ${getDbStyle(result.app_database.db_status).border}`,
              borderRadius: "6px",
            }}>

              {/* Header row */}
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "center",
                marginBottom:   "8px"
              }}>
                <span style={{
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "9px",
                  letterSpacing: "3px",
                  color:         "var(--muted)"
                }}>
                  // RBI_DATABASE_LOOKUP
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize:   "11px",
                  fontWeight: "700",
                  color:      getDbStyle(result.app_database.db_status).color
                }}>
                  {getDbLabel(result.app_database.db_status)}
                </span>
              </div>

              {/* App name + type row */}
              <div style={{
                display:    "flex",
                gap:        "16px",
                flexWrap:   "wrap",
                marginBottom: result.app_database.danger_reason ? "8px" : "0"
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize:   "11px",
                  color:      "var(--text)"
                }}>
                  APP: <span style={{
                    color:      getDbStyle(result.app_database.db_status).color,
                    fontWeight: "700"
                  }}>
                    {result.app_database.app_name}
                  </span>
                </div>

                {result.app_database.app_type && (
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize:   "11px",
                    color:      "var(--muted)"
                  }}>
                    TYPE: <span style={{ color: "var(--text)" }}>
                      {result.app_database.app_type}
                    </span>
                  </div>
                )}
              </div>

              {/* Message */}
              <div style={{
                fontFamily:  "var(--font-mono)",
                fontSize:    "11px",
                color:       "var(--muted)",
                marginTop:   "4px"
              }}>
                {result.app_database.message}
              </div>

              {/* Danger reason if blacklisted */}
              {result.app_database.danger_reason && (
                <div style={{
                  marginTop:    "10px",
                  padding:      "8px 12px",
                  background:   "rgba(255,45,85,0.1)",
                  border:       "1px solid rgba(255,45,85,0.3)",
                  borderRadius: "4px",
                  fontFamily:   "var(--font-mono)",
                  fontSize:     "11px",
                  color:        "#FF2D55"
                }}>
                  ⚠ REASON: {result.app_database.danger_reason}
                </div>
              )}

            </div>
          )}

          {/* ── Blacklisted Warning Banner ── */}
          {result.app_database?.db_status === "BLACKLISTED" && (
            <div style={{
              marginTop:    "8px",
              padding:      "12px 16px",
              background:   "rgba(255,45,85,0.08)",
              border:       "1px solid rgba(255,45,85,0.4)",
              borderRadius: "6px",
              fontFamily:   "var(--font-mono)",
              fontSize:     "11px",
              color:        "#FF2D55",
              lineHeight:   "1.8"
            }}>
              🚨 DO NOT USE THIS APP — Report to RBI at sachet.rbi.org.in
              or call 14440 (RBI Helpline)
            </div>
          )}

          {/* ── RBI Verified Banner ── */}
          {result.app_database?.db_status === "RBI_VERIFIED" && (
            <div style={{
              marginTop:    "8px",
              padding:      "12px 16px",
              background:   "rgba(0,255,157,0.05)",
              border:       "1px solid rgba(0,255,157,0.2)",
              borderRadius: "6px",
              fontFamily:   "var(--font-mono)",
              fontSize:     "11px",
              color:        "#00FF9D",
              lineHeight:   "1.8"
            }}>
              ✓ VERIFIED SAFE — Registered with RBI. Always use official app from Play Store.
            </div>
          )}
        </>
      )}

    </div>
  );
}



