import { getSystemStatus } from "../../api/api";
import { useLoad, SectionLabel, Panel, Kv, Status } from "./shared";

const ok = (b, yes = "CONNECTED", no = "NOT CONFIGURED") => ({ v: b ? yes : no, color: b ? "var(--green)" : "var(--amber)" });

/** Everything CyberRakshak plugs into: GUVI evaluator, LLM, webhooks, ML engine, database, breach lookup. */
export default function Integrations() {
    const st = useLoad(getSystemStatus, [], 10000);
    const d = st.data;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    return (
        <>
            <SectionLabel>INTEGRATIONS — external systems and internal engines the platform depends on</SectionLabel>
            <Status loading={st.loading && !d} error={st.error} />
            {d && (
                <div className="hp-grid-2">
                    <Panel title="GUVI_EVALUATOR_API">
                        <Kv k="ENDPOINT" v={`POST ${origin}/api/v1/messages`} />
                        <Kv k="AUTH" v={d.integrations.evaluatorApiKeyConfigured ? "x-api-key header required" : "NO API_KEY SET"} color={d.integrations.evaluatorApiKeyConfigured ? "var(--green)" : "var(--red)"} />
                        <Kv k="PROBE (no auth)" v={`GET ${origin}/api/v1/messages`} />
                        <Kv k="FINAL_RESULT_CALLBACK" v={d.integrations.finalCallbackHost} color="var(--green)" />
                        <Kv k="CALLBACK_TARGET_SOURCE" v={d.integrations.finalCallbackSource === "env" ? "custom (EVALUATION_CALLBACK_URL)" : "GUVI default endpoint"} color={d.integrations.finalCallbackSource === "env" ? "var(--amber)" : undefined} />
                        <div className="mono hp-muted" style={{ marginTop: 6 }}>When a conversation ends, the extracted intelligence is posted to the callback URL. Per-session status is shown in Conversations → Agent State.</div>
                    </Panel>
                    <Panel title="LLM (agent brain)">
                        <Kv k="MODE" v={d.agent.mode} />
                        <Kv k="GEMINI_API_KEY" {...ok(d.agent.llmConfigured, "CONFIGURED", "NOT SET — rule-based replies")} />
                        <div className="mono hp-muted" style={{ marginTop: 6 }}>The persona agent uses the LLM when a key is set and falls back to the rule-based engine when it isn't (or on error).</div>
                    </Panel>
                    <Panel title="WEBHOOKS_&_ALERT_CHANNELS">
                        <Kv k="ALERTS" v={d.alerts.enabled === false ? "DISABLED" : "ENABLED"} color={d.alerts.enabled === false ? "var(--amber)" : "var(--green)"} />
                        <Kv k="WEBHOOK_URL" {...ok(d.alerts.webhookConfigured, "CONFIGURED", "NOT SET")} />
                        <Kv k="CHANNELS" v={d.alerts.channels.join(", ") || "—"} />
                        <div className="mono hp-muted" style={{ marginTop: 6 }}>Configure and test in Protection → Alerts.</div>
                    </Panel>
                    <Panel title="CYBERRAKSHAK_ML_ENGINE (Flask)">
                        <Kv k="STATUS" v={d.ml.reachable ? "ONLINE" : "OFFLINE"} color={d.ml.reachable ? "var(--green)" : "var(--red)"} />
                        <Kv k="LATENCY" v={d.ml.latencyMs != null ? `${d.ml.latencyMs} ms` : null} />
                        <Kv k="SUPERVISED_BY_GATEWAY" v={d.ml.managed ? `YES (pid ${d.ml.pid ?? "—"}, ${d.ml.restarts} restarts)` : "NO — external engine"} />
                        {Object.entries(d.ml.modules || {}).map(([k, v]) => {
                            const composite = k === "multi_vector_analyzer";
                            const ruleBased = k === "loan_scorer";
                            const label = composite
                                ? "ROUTE AVAILABLE (COMPOSITE)"
                                : ruleBased
                                    ? "AVAILABLE (RULE-BASED)"
                                    : v ? "MODEL LOADED" : "MODEL MISSING";
                            const color = composite || ruleBased
                                ? "var(--cyan)"
                                : v ? "var(--green)" : "var(--red)";
                            return <Kv key={k} k={k.toUpperCase()} v={label} color={color} />;
                        })}
                    </Panel>
                    <Panel title="DATABASE (MongoDB)">
                        <Kv k="STATUS" v={d.db.connected ? "CONNECTED" : "DOWN"} color={d.db.connected ? "var(--green)" : "var(--red)"} />
                        <Kv k="LATENCY" v={d.db.latencyMs != null ? `${d.db.latencyMs} ms` : null} />
                        <Kv k="SESSIONS_STORED" v={d.db.sessions} />
                        <Kv k="SCAM_SESSIONS" v={d.db.scamSessions} />
                    </Panel>
                    <Panel title="BREACH_LOOKUP (Have I Been Pwned)">
                        <Kv k="HIBP_API_KEY" {...ok(d.integrations.breachLookupConfigured, "CONFIGURED", "NOT SET — dark-web check disabled")} />
                        <div className="mono hp-muted" style={{ marginTop: 6 }}>Used by the DARK_WEB_PULSE scan in Threat Detection → Multi-Vector.</div>
                    </Panel>
                </div>
            )}
        </>
    );
}
