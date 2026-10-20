import { useCallback, useEffect, useState } from "react";
import api from "../../api/api";

const ROOT = "/api/v1/investigations";
const tabs = ["overview", "cases", "url triage", "rule lab", "feedback"];
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
  const [url, setUrl] = useState("");
  const [urlResult, setUrlResult] = useState(null);
  const [samples, setSamples] = useState("Urgent: verify your account immediately\nVisit https://example.com/verify\nPlease pay to sample123@bank\nNormal customer question");
  const [replay, setReplay] = useState(null);
  const [feedbackSession, setFeedbackSession] = useState("");
  const [feedbackLabel, setFeedbackLabel] = useState("uncertain");
  const [feedbackNote, setFeedbackNote] = useState("");

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
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {["investigating", "contained", "resolved", "false_positive"].map((status) => <button key={status} style={button} onClick={() => run(() => api.patch(`${ROOT}/cases/${encodeURIComponent(item.caseId)}`, { status }), `Case status updated to ${status}.`)}>{status.replace("_", " ")}</button>)}
            </div>
          </article>)}
          {!cases.length && <div style={card}>No cases yet. Create one when you have a session or indicator that needs investigation.</div>}
        </div>
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
        <div style={card}><h3 style={{ marginTop: 0 }}>Saved rules ({rules.length})</h3>{rules.map((rule) => <div key={rule.ruleId} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid #8883", padding: "8px 0", flexWrap: "wrap" }}><span>{rule.name} <small style={{ opacity: .65 }}>v{rule.version}</small></span><span>{rule.status} · {rule.severity}</span></div>)}{!rules.length && <p style={{ opacity: .7 }}>No saved rules yet. Rules can be created through the authenticated API.</p>}</div>
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
