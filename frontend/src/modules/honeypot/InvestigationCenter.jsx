import { useCallback, useEffect, useState } from "react";
import api from "../../api/api";

const ROOT = "/api/v1/investigations";
const tabs = ["overview", "cases", "copilot", "url triage", "rule lab", "simulation", "privacy", "quality drift", "feedback"];
const card = { border: "1px solid var(--border-color, rgba(127,127,127,.28))", borderRadius: 12, padding: 16, minWidth: 0 };
const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color, #8886)", background: "var(--panel-bg, transparent)", color: "inherit", font: "inherit" };
const button = { padding: "9px 13px", borderRadius: 8, border: "1px solid var(--border-color, #8886)", background: "var(--panel-bg, transparent)", color: "inherit", cursor: "pointer", font: "inherit" };

export default function InvestigationCenter() {
  const [active, setActive] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [cases, setCases] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [assignees, setAssignees] = useState({});
  const [caseNotes, setCaseNotes] = useState({});
  const [caseEvidence, setCaseEvidence] = useState({});
  const [url, setUrl] = useState("");
  const [urlResult, setUrlResult] = useState(null);
  const [samples, setSamples] = useState("Urgent: verify your account immediately\nVisit https://example.com/verify\nPlease pay to sample123@bank\nNormal customer question");
  const [replay, setReplay] = useState(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("phrase_any");
  const [ruleTerms, setRuleTerms] = useState("urgent, immediately");
  const [ruleSeverity, setRuleSeverity] = useState("HIGH");
  const [feedbackSession, setFeedbackSession] = useState("");
  const [feedbackLabel, setFeedbackLabel] = useState("uncertain");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [copilotSession, setCopilotSession] = useState("");
  const [copilotResult, setCopilotResult] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [privacyText, setPrivacyText] = useState("Contact me at example@example.com or use token=abc123.");
  const [redactionResult, setRedactionResult] = useState(null);
  const [retentionPreview, setRetentionPreview] = useState(null);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [driftResult, setDriftResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [o, c, i, r] = await Promise.all([
        api.get(`${ROOT}/operations/overview`),
        api.get(`${ROOT}/cases?limit=100`),
        api.get(`${ROOT}/indicators?limit=100`),
        api.get(`${ROOT}/rules?limit=100`)
      ]);
      setOverview(o.data?.data || null);
      setCases(c.data?.data || []);
      setIndicators(i.data?.data || []);
      setRules(r.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Unable to load investigation data. Confirm console authentication and database connectivity.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const timer = setInterval(() => { load(); }, 30000); return () => clearInterval(timer); }, [load]);

  const run = async (work, success) => {
    setError(""); setMessage("");
    try { await work(); setMessage(success); await load(); }
    catch (e) { setError(e?.response?.data?.message || "Action failed. Please review the input and retry."); }
  };

  const createCase = (event) => {
    event.preventDefault();
    if (!title.trim()) return setError("A case title is required.");
    run(async () => {
      await api.post(`${ROOT}/cases`, { title: title.trim(), summary, severity });
      setTitle(""); setSummary(""); setSeverity("MEDIUM");
      setActive("cases");
    }, "Investigation case created.");
  };

  const analyzeUrl = (event) => {
    event.preventDefault();
    run(async () => {
      const response = await api.post(`${ROOT}/url-analysis`, { url });
      setUrlResult(response.data?.data || null);
      setActive("url triage");
    }, "Static URL triage completed. The URL was not contacted.");
  };

  const replayRules = (event) => {
    event.preventDefault();
    run(async () => {
      const response = await api.post(`${ROOT}/rules/replay`, {
        samples: samples.split("\n").map((s) => s.trim()).filter(Boolean)
      });
      setReplay(response.data?.data || null);
      setActive("rule lab");
    }, "Rule replay completed without changing production detection.");
  };

  const compareBehavior = () => run(async () => {
    const response = await api.get(`${ROOT}/sessions/${encodeURIComponent(copilotSession.trim())}/similarities`);
    setSimilarityResult(response.data?.data || null);
    setActive("copilot");
  }, "Cross-session lexical comparison completed.");

  const loadDrift = () => run(async () => {
    const response = await api.get(`${ROOT}/quality/drift`);
    setDriftResult(response.data?.data || null);
    setActive("quality drift");
  }, "Detection quality signals loaded.");

  const createRule = (event) => {
    event.preventDefault();
    if (!ruleName.trim()) return setError("Rule name is required.");
    const terms = ruleTerms.split(",").map((term) => term.trim()).filter(Boolean);
    if (["contains", "phrase_any", "starts_with"].includes(ruleType) && !terms.length) return setError("This rule type requires at least one term.");
    run(async () => {
      await api.post(`${ROOT}/rules`, { name: ruleName.trim(), type: ruleType, terms, severity: ruleSeverity, description: "Created in the analyst rule lab." });
      setRuleName(""); setRuleTerms("");
    }, "Rule saved as a draft. Enable it after reviewing its behavior.");
  };

  const runSimulation = () => run(async () => {
    const response = await api.post(`${ROOT}/simulation/run`, {});
    setSimulationResult(response.data?.data || null);
    setActive("simulation");
  }, "Synthetic offline simulation completed.");

  const runRedaction = () => run(async () => {
    const response = await api.post(`${ROOT}/privacy/redact`, { text: privacyText });
    setRedactionResult(response.data?.data || null);
    setActive("privacy");
  }, "PII redaction preview completed.");

  const previewRetention = () => run(async () => {
    const response = await api.get(`${ROOT}/privacy/retention/preview`);
    setRetentionPreview(response.data?.data || null);
    setActive("privacy");
  }, "Retention preview completed. No records were changed.");

  const investigateSession = (event) => {
    event.preventDefault();
    if (!copilotSession.trim()) return setError("Enter the session ID to investigate.");
    run(async () => {
      const response = await api.post(`${ROOT}/copilot/investigate`, { sessionId: copilotSession.trim() });
      setCopilotResult(response.data?.data || null);
      setActive("copilot");
    }, "Evidence-backed investigation completed.");
  };

  const submitFeedback = (event) => {
    event.preventDefault();
    if (!feedbackSession.trim()) return setError("Enter the session ID to review.");
    run(async () => {
      await api.post(`${ROOT}/feedback`, { sessionId: feedbackSession.trim(), label: feedbackLabel, note: feedbackNote });
      setFeedbackSession(""); setFeedbackNote("");
    }, "Analyst feedback recorded.");
  };

  const heading = active.toUpperCase();
  return (
    <section style={{ display: "grid", gap: 18, color: "inherit" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", opacity: .65 }}>CYBERRAKSHAK / INCIDENT OPERATIONS</div>
          <h2 style={{ margin: "8px 0 4px", fontSize: "clamp(22px, 3vw, 32px)" }}>Investigation Center</h2>
          <p style={{ margin: 0, opacity: .72 }}>Cases, evidence triage, rule replay and analyst feedback in one workspace.</p>
        </div>
        <button style={button} onClick={load} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh data"}</button>
      </header>

      {error && <div role="alert" style={{ ...card, borderColor: "#d44", color: "#d44" }}>{error}</div>}
      {message && <div role="status" style={{ ...card, borderColor: "#28966b" }}>{message}</div>}

      <nav aria-label="Investigation tools" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tabs.map((tab) => <button key={tab} style={{ ...button, background: active === tab ? "var(--accent-bg, rgba(40,150,107,.16))" : "transparent", borderColor: active === tab ? "#28966b" : undefined }} onClick={() => setActive(tab)}>{tab.toUpperCase()}</button>)}
      </nav>

      {active === "overview" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
          {[
            ["SESSIONS", overview?.totals?.sessions],
            ["TOTAL CASES", overview?.totals?.cases],
            ["OPEN CASES", overview?.totals?.openCases],
            ["INDICATORS", overview?.totals?.indicators],
            ["ANALYST REVIEWS", overview?.totals?.analystFeedback]
          ].map(([label, value]) => <div key={label} style={card}><div style={{ fontSize: 11, opacity: .65, letterSpacing: ".12em" }}>{label}</div><div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{value ?? "—"}</div></div>)}
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Recent audit activity</h3>
          {(overview?.recentEvents || []).length ? <div style={{ display: "grid", gap: 8 }}>{overview.recentEvents.map((event, index) => <div key={`${event.timestamp}-${index}`} style={{ display: "flex", gap: 12, justifyContent: "space-between", borderBottom: "1px solid #8883", paddingBottom: 8, flexWrap: "wrap" }}><span><strong>{event.eventType}</strong> <span style={{ opacity: .7 }}>{event.sessionId || ""}</span></span><small>{event.timestamp ? new Date(event.timestamp).toLocaleString() : "—"}</small></div>)}</div> : <p style={{ opacity: .7 }}>No audit events available yet.</p>}
        </div>
      </>}

      {active === "cases" && <div style={{ display: "grid", gap: 14 }}>
        <form onSubmit={createCase} style={{ ...card, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Open an investigation</h3>
          <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Case title" required />
          <textarea style={{ ...field, minHeight: 80, resize: "vertical" }} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={5000} placeholder="Summary and initial evidence (optional)" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select style={{ ...field, maxWidth: 220 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v}>{v}</option>)}</select>
            <button style={button} type="submit">+ Create case</button>
          </div>
        </form>
        <div style={{ display: "grid", gap: 10 }}>
          {cases.map((item) => <article key={item.caseId} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div><strong>{item.title}</strong><div style={{ fontSize: 11, opacity: .65, marginTop: 5 }}>{item.caseId}</div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}><span style={{ fontSize: 11, border: "1px solid #8886", padding: "4px 7px", borderRadius: 6 }}>{item.severity}</span><span style={{ fontSize: 11, border: "1px solid #8886", padding: "4px 7px", borderRadius: 6 }}>{item.status}</span></div>
            </div>
            {item.summary && <p style={{ opacity: .8 }}>{item.summary}</p>}
            <div style={{ fontSize: 12, opacity: .7 }}>{(item.sessionIds || []).length} sessions · {(item.indicators || []).length} indicators · {(item.evidence || []).length} evidence items · updated {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 6 }}><input style={field} value={assignees[item.caseId] ?? item.assignedTo ?? ""} onChange={(e) => setAssignees((prev) => ({ ...prev, [item.caseId]: e.target.value }))} maxLength={120} placeholder="Assign to analyst"/><button style={button} onClick={() => run(() => api.patch(`${ROOT}/cases/${encodeURIComponent(item.caseId)}`, { assignedTo: assignees[item.caseId] ?? item.assignedTo ?? "" }), "Case assignment updated.")}>Assign</button></div>
              <div style={{ display: "flex", gap: 6 }}><input style={field} value={caseNotes[item.caseId] || ""} onChange={(e) => setCaseNotes((prev) => ({ ...prev, [item.caseId]: e.target.value }))} maxLength={5000} placeholder="Add analyst note"/><button style={button} onClick={() => { const note = (caseNotes[item.caseId] || "").trim(); if (!note) return setError("Enter a note before saving."); run(() => api.post(`${ROOT}/cases/${encodeURIComponent(item.caseId)}/notes`, { text: note }), "Case note added."); setCaseNotes((prev) => ({ ...prev, [item.caseId]: "" })); }}>Add note</button></div>
              <div style={{ display: "flex", gap: 6 }}><input style={field} value={caseEvidence[item.caseId] || ""} onChange={(e) => setCaseEvidence((prev) => ({ ...prev, [item.caseId]: e.target.value }))} maxLength={500} placeholder="Session / indicator reference"/><button style={button} onClick={() => { const reference = (caseEvidence[item.caseId] || "").trim(); if (!reference) return setError("Enter an evidence reference."); run(() => api.post(`${ROOT}/cases/${encodeURIComponent(item.caseId)}/evidence`, { type: "session", reference, label: "Analyst-linked evidence" }), "Evidence reference attached."); setCaseEvidence((prev) => ({ ...prev, [item.caseId]: "" })); }}>Attach evidence</button></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {["investigating", "contained", "resolved", "false_positive"].map((status) => <button key={status} style={button} onClick={() => run(() => api.patch(`${ROOT}/cases/${encodeURIComponent(item.caseId)}`, { status }), `Case status updated to ${status}.`)}>{status.replace("_", " ")}</button>)}
            </div>
          </article>)}
          {!cases.length && <div style={card}>No cases yet. Create one when you have a session or indicator that needs investigation.</div>}
        </div>
      </div>}

      {active === "copilot" && <div style={{ display: "grid", gap: 14 }}>
        <form onSubmit={investigateSession} style={{ ...card, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Evidence-backed investigation</h3>
          <p style={{ margin: 0, opacity: .72 }}>Builds findings from stored conversation turns and audit events. It does not claim identity attribution or invent missing evidence.</p>
          <input style={field} value={copilotSession} onChange={(e) => setCopilotSession(e.target.value)} maxLength={200} placeholder="Session ID" required />
          <div><button style={button} type="submit">Investigate session</button></div>
          <div><button style={button} type="button" onClick={compareBehavior} disabled={!copilotSession.trim() || loading}>Compare behavior with other sessions</button></div>
        </form>
        {copilotResult && <div style={{ display: "grid", gap: 12 }}>
          <div style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h3 style={{ marginTop: 0 }}>{copilotResult.session.sessionId}</h3><strong>{Math.round((copilotResult.session.riskScore || 0) * 100)}% recorded risk</strong></div><p>{copilotResult.summary}</p><div style={{ fontSize: 12, opacity: .7 }}>Type: {copilotResult.session.scamType} · Phase: {copilotResult.session.phase} · Evidence records: {copilotResult.evidenceInventory.totalRecords}</div></div>
          <div style={card}><h3 style={{ marginTop: 0 }}>Findings ({copilotResult.findings.length})</h3>{copilotResult.findings.map((finding, index) => <article key={`${finding.type}-${index}`} style={{ borderTop: "1px solid #8883", padding: "12px 0" }}><strong>{finding.type.replaceAll("_", " ").toUpperCase()}</strong><p>{finding.statement}</p><small>Severity: {finding.severity} · Confidence: {finding.confidence === null ? "not scored" : `${Math.round(finding.confidence * 100)}%`}</small><div style={{ marginTop: 6, fontSize: 12, opacity: .72 }}>{finding.evidence.length} evidence references: {finding.evidence.slice(0, 3).map((e) => e.reference).join(", ")}</div></article>)}{!copilotResult.findings.length && <p>No findings could be derived from the stored evidence.</p>}</div>
          {similarityResult && <div style={card}><h3 style={{ marginTop: 0 }}>Similar wording signals</h3><p>Compared with {similarityResult.comparedSessions} candidate sessions. This is lexical similarity only, not proof of shared authorship.</p>{similarityResult.results.map((item) => <div key={item.sessionId} style={{ borderTop: "1px solid #8883", padding: "9px 0" }}><strong>{item.sessionId}</strong> · {Math.round(item.similarity * 100)}% overlap<div style={{ fontSize: 12, opacity: .7 }}>Shared terms: {item.sharedTerms.join(", ") || "none"}</div></div>)}{!similarityResult.results.length && <p>No non-zero lexical overlaps found in the sampled sessions.</p>}</div>}
          <div style={card}><h3 style={{ marginTop: 0 }}>Extracted indicators</h3>{Object.entries(copilotResult.indicators).map(([kind, values]) => <div key={kind} style={{ padding: "8px 0", borderTop: "1px solid #8883" }}><strong>{kind}</strong><div style={{ overflowWrap: "anywhere", opacity: .8 }}>{values.length ? values.join(", ") : "None recorded"}</div></div>)}<ul>{copilotResult.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>
        </div>}
      </div>}

      {active === "url triage" && <div style={{ display: "grid", gap: 14 }}>
        <form onSubmit={analyzeUrl} style={{ ...card, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Static URL triage</h3>
          <p style={{ margin: 0, opacity: .72 }}>Analyzes URL structure only. It does not open, resolve or fetch the URL.</p>
          <input style={field} type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2048} placeholder="https://example.com/path" required />
          <div><button style={button} type="submit">Analyze URL</button></div>
        </form>
        {urlResult && <div style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h3 style={{ marginTop: 0 }}>{urlResult.assessment.replaceAll("_", " ").toUpperCase()}</h3><strong>Heuristic score: {urlResult.heuristicScore}/100</strong></div><p style={{ overflowWrap: "anywhere" }}>{urlResult.normalizedUrl}</p><p>Host: <strong>{urlResult.hostname}</strong> · Protocol: {urlResult.protocol} · Query parameters: {urlResult.queryParameterCount}</p><h4>Signals</h4>{urlResult.signals.length ? <ul>{urlResult.signals.map((signal) => <li key={signal}>{signal.replaceAll("_", " ")}</li>)}</ul> : <p>No obvious static signals were found.</p>}<small>{urlResult.disclaimer}</small></div>}
      </div>}

      {active === "rule lab" && <div style={{ display: "grid", gap: 14 }}>
        <form onSubmit={replayRules} style={{ ...card, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Detection rule replay</h3>
          <p style={{ margin: 0, opacity: .72 }}>Replays currently enabled deterministic rules against sample text. Replay is read-only and does not modify production detection.</p>
          <textarea style={{ ...field, minHeight: 150, resize: "vertical", fontFamily: "monospace" }} value={samples} onChange={(e) => setSamples(e.target.value)} placeholder="One sample message per line" />
          <div><button style={button} type="submit">Replay enabled rules</button></div>
        </form>
        {replay && <div style={card}><h3 style={{ marginTop: 0 }}>Replay results</h3><p>{replay.ruleCount} rules · {replay.sampleCount} samples · {replay.matchedSamples} samples matched at least one rule</p>{replay.results.map((result) => <div key={result.ruleId || result.name} style={{ borderTop: "1px solid #8883", padding: "10px 0" }}><strong>{result.name}</strong> — {result.matches} matches ({Math.round(result.matchRate * 100)}%)<div style={{ opacity: .7, fontSize: 12 }}>{result.type} · {result.severity}</div></div>)}</div>}
        <form onSubmit={createRule} style={{ ...card, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Create a detection rule</h3>
          <input style={field} value={ruleName} onChange={(e) => setRuleName(e.target.value)} maxLength={120} placeholder="Rule name" required />
          <select style={field} value={ruleType} onChange={(e) => setRuleType(e.target.value)}>{[["contains","Contains phrase"],["phrase_any","Any phrase"],["starts_with","Starts with"],["url_present","URL present"],["upi_present","UPI-like value present"],["phone_present","Phone-like value present"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          {["contains","phrase_any","starts_with"].includes(ruleType) && <input style={field} value={ruleTerms} onChange={(e) => setRuleTerms(e.target.value)} maxLength={3000} placeholder="Comma-separated terms" />}
          <select style={{ ...field, maxWidth: 220 }} value={ruleSeverity} onChange={(e) => setRuleSeverity(e.target.value)}>{["LOW","MEDIUM","HIGH","CRITICAL"].map((v) => <option key={v}>{v}</option>)}</select>
          <div><button style={button} type="submit">Save draft rule</button></div>
        </form>
        <div style={card}><h3 style={{ marginTop: 0 }}>Saved rules ({rules.length})</h3>{rules.map((rule) => <div key={rule.ruleId} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid #8883", padding: "8px 0", flexWrap: "wrap" }}><span>{rule.name} <small style={{ opacity: .65 }}>v{rule.version}</small></span><span style={{ display: "flex", gap: 6, alignItems: "center" }}>{rule.status} · {rule.severity}<button style={button} onClick={() => run(() => api.patch(`${ROOT}/rules/${encodeURIComponent(rule.ruleId)}/status`, { status: rule.status === "enabled" ? "disabled" : "enabled" }), `Rule ${rule.status === "enabled" ? "disabled" : "enabled"}.`)}>{rule.status === "enabled" ? "Disable" : "Enable"}</button></span></div>)}{!rules.length && <p style={{ opacity: .7 }}>No saved rules yet. Rules can be created through the authenticated API.</p>}</div>
      </div>}

      {active === "simulation" && <div style={{ display: "grid", gap: 14 }}>
        <div style={card}><h3 style={{ marginTop: 0 }}>Offline attack-pattern simulator</h3><p style={{ opacity: .72 }}>Run synthetic phishing, payment-impersonation and benign examples against enabled detection rules. No external systems are contacted and no production settings are changed.</p><button style={button} onClick={runSimulation} disabled={loading}>Run all synthetic scenarios</button></div>
        {simulationResult && <><div style={card}><h3 style={{ marginTop: 0 }}>Simulation summary</h3><p>{simulationResult.summary.scenarios} scenarios · {simulationResult.summary.messages} messages · {simulationResult.summary.messagesMatched} matched · {Math.round(simulationResult.summary.messageMatchRate * 100)}% message match rate</p><p>Benign messages matched: {simulationResult.summary.benignMessagesMatched}</p><small>{simulationResult.disclaimer}</small></div><div style={card}>{simulationResult.scenarios.map((scenario) => <div key={scenario.id} style={{ borderTop: "1px solid #8883", padding: "10px 0" }}><strong>{scenario.name}</strong><div>{scenario.outcome.replaceAll("_", " ")} · coverage {Math.round(scenario.coverage * 100)}%</div><small style={{ opacity: .7 }}>Expected category: {scenario.expected} · {scenario.matches.join(", ") || "No rule matches"}</small></div>)}</div></>}
      </div>}

      {active === "privacy" && <div style={{ display: "grid", gap: 14 }}>
        <div style={card}><h3 style={{ marginTop: 0 }}>Privacy redaction preview</h3><p style={{ opacity: .72 }}>Mask common email, phone, UPI and sensitive URL parameter values before sharing text with an external service.</p><textarea style={{ ...field, minHeight: 120 }} value={privacyText} onChange={(e) => setPrivacyText(e.target.value)} maxLength={50000}/><div style={{ marginTop: 10 }}><button style={button} onClick={runRedaction} disabled={loading}>Preview redaction</button></div>{redactionResult && <div style={{ marginTop: 12 }}><strong>Redacted output</strong><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{redactionResult.redactedText}</pre><small>Redactions: {Object.entries(redactionResult.counts).map(([key,value]) => `${key} ${value}`).join(" · ")}</small></div>}</div>
        <div style={card}><h3 style={{ marginTop: 0 }}>Retention policy preview</h3><p style={{ opacity: .72 }}>The default target is 365 days. This preview estimates old records; it does not delete anything.</p><button style={button} onClick={previewRetention} disabled={loading}>Preview records older than policy</button>{retentionPreview && <div style={{ marginTop: 12 }}><p>Cutoff: {new Date(retentionPreview.cutoff).toLocaleString()} · {retentionPreview.retentionDays} days</p>{Object.entries(retentionPreview.candidateCounts).map(([key,value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #8883", padding: "7px 0" }}><span>{key.replaceAll(/([A-Z])/g, " $1")}</span><strong>{value}</strong></div>)}<strong>Total candidate records: {retentionPreview.totalCandidateRecords}</strong><p><small>{retentionPreview.note}</small></p></div>}</div>
      </div>}

      {active === "quality drift" && <div style={{ display: "grid", gap: 14 }}>
        <div style={card}><h3 style={{ marginTop: 0 }}>Detection quality signals</h3><p style={{ opacity: .72 }}>Uses analyst feedback from the last 90 days. It is a monitoring signal, not a statistically validated model-drift detector.</p><button style={button} onClick={loadDrift} disabled={loading}>Refresh quality signals</button></div>
        {driftResult && <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>{[["TRUE POSITIVES", driftResult.counts.true_positive || 0],["FALSE POSITIVES",driftResult.counts.false_positive || 0],["MISSED DETECTIONS",driftResult.counts.missed_detection || 0],["FALSE POSITIVE RATE",driftResult.falsePositiveRate === null ? "N/A" : `${Math.round(driftResult.falsePositiveRate * 100)}%`]].map(([label,value]) => <div key={label} style={card}><div style={{ fontSize: 11, opacity: .65 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>{value}</div></div>)}</div><div style={card}><strong>Signal: {driftResult.signal.replaceAll("_", " ")}</strong><h3>Monthly review trend</h3>{driftResult.monthlyTrend.map((item) => <div key={item.month} style={{ borderTop: "1px solid #8883", padding: "8px 0" }}>{item.month} · TP {item.truePositives} · FP {item.falsePositives} · missed {item.missedDetections}</div>)}<h3>By model version</h3>{driftResult.byModelVersion.map((item) => <div key={item.modelVersion} style={{ borderTop: "1px solid #8883", padding: "8px 0" }}>{item.modelVersion} · {item.reviews} reviews · {item.falsePositives} false positives · avg reviewed confidence {item.averageReviewedConfidence == null ? "N/A" : Math.round(item.averageReviewedConfidence * 100) + "%"}</div>)}<ul>{driftResult.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div></>}
      </div>}

      {active === "feedback" && <div style={{ display: "grid", gap: 14 }}>
        <form onSubmit={submitFeedback} style={{ ...card, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Review a detection</h3>
          <input style={field} value={feedbackSession} onChange={(e) => setFeedbackSession(e.target.value)} maxLength={200} placeholder="Session ID" required />
          <select style={field} value={feedbackLabel} onChange={(e) => setFeedbackLabel(e.target.value)}>{[["true_positive","True positive"],["false_positive","False positive"],["missed_detection","Missed detection"],["uncertain","Uncertain"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          <textarea style={{ ...field, minHeight: 90 }} value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} maxLength={3000} placeholder="Evidence or reason for this review (optional)" />
          <div><button style={button} type="submit">Save analyst review</button></div>
        </form>
        <div style={card}><h3 style={{ marginTop: 0 }}>Indicator reputation</h3>{indicators.slice(0, 30).map((item) => <div key={item._id || `${item.kind}:${item.normalizedValue}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #8883", padding: "9px 0", flexWrap: "wrap" }}><span style={{ overflowWrap: "anywhere" }}><strong>{item.kind.toUpperCase()}</strong> · {item.value}</span><span>{item.effectiveStatus || item.status} · confidence {Math.round((item.confidence || 0) * 100)}%</span></div>)}{!indicators.length && <p style={{ opacity: .7 }}>No reputation records yet.</p>}</div>
      </div>}
    </section>
  );
}
