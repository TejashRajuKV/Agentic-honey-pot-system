import { useEffect, useState } from "react";
import { getAlertConfig, saveAlertConfig, testWebhook, getAlertHistory, getAlertTriage, getAlertStats, getIncidents, resolveIncident } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Chips, Status, errMsg, fmtDate, riskColor } from "./shared";

const TRIGGER_LABELS = {
    criticalRisk: "Critical risk (score ≥ 80)",
    newScammer: "New scammer identified",
    crossSessionMatch: "Same scammer across sessions",
    qualityDrop: "Agent reply quality drop",
    highVelocityAttack: "High-velocity pressure attack",
    multipleVictims: "Scammer hitting multiple victims",
};
const CHANNELS = ["log", "database", "webhook"];

export default function Alerts() {
    const config = useLoad(getAlertConfig, []);
    const history = useLoad(getAlertHistory, [], 10000);
    const triage = useLoad(getAlertTriage, [], 10000);
    const stats = useLoad(getAlertStats, [], 10000);
    const incidents = useLoad(getIncidents, [], 10000);
    const [form, setForm] = useState(null);
    const [msg, setMsg] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (config.data) setForm(config.data); }, [config.data]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const save = async () => {
        setBusy(true); setMsg(null);
        try {
            const saved = await saveAlertConfig({
                enabled: form.enabled,
                triggers: form.triggers,
                channels: form.channels,
                webhookUrl: form.webhookUrl || undefined,
                filters: form.filters,
                auth: form.auth,
                retryConfig: form.retryConfig,
            });
            setForm(saved);
            setMsg({ ok: true, text: "Configuration saved." });
        } catch (e) { setMsg({ ok: false, text: errMsg(e) }); } finally { setBusy(false); }
    };

    const test = async () => {
        setBusy(true); setMsg(null);
        try {
            const r = await testWebhook(form.webhookUrl, form.auth);
            setMsg({ ok: r.success !== false, text: `Webhook test: ${JSON.stringify(r)}` });
        } catch (e) { setMsg({ ok: false, text: errMsg(e) }); } finally { setBusy(false); }
    };

    const toggleChannel = (c) =>
        set({ channels: form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c] });

    return (
        <>
            <SectionLabel>ALERTING — the honeypot fires these automatically while it engages scammers</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel title="CONFIGURATION">
                        <Status loading={config.loading} error={config.error} />
                        {form && (
                            <>
                                <label className="hp-check mono">
                                    <input type="checkbox" checked={!!form.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> ALERTS_ENABLED
                                </label>
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>TRIGGERS</div>
                                {Object.entries(TRIGGER_LABELS).map(([k, label]) => (
                                    <label key={k} className="hp-check mono">
                                        <input type="checkbox" checked={!!form.triggers?.[k]} onChange={(e) => set({ triggers: { ...form.triggers, [k]: e.target.checked } })} /> {label}
                                    </label>
                                ))}
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>CHANNELS</div>
                                <div className="hp-actions">
                                    {CHANNELS.map((c) => (
                                        <label key={c} className="hp-check mono">
                                            <input type="checkbox" checked={form.channels?.includes(c)} onChange={() => toggleChannel(c)} /> {c}
                                        </label>
                                    ))}
                                </div>
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>WEBHOOK_URL</div>
                                <input className="forensic-input hp-input" placeholder="https://hooks.example.com/…" value={form.webhookUrl || ""} onChange={(e) => set({ webhookUrl: e.target.value })} />
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>WEBHOOK_AUTH</div>
                                <select className="forensic-input hp-input" value={form.auth?.type || "none"} onChange={(e) => set({ auth: { ...form.auth, type: e.target.value } })}>
                                    <option value="none">none</option>
                                    <option value="bearer">bearer token</option>
                                    <option value="api_key">API key header</option>
                                    <option value="hmac">HMAC-SHA256 signature</option>
                                </select>
                                {form.auth?.type && form.auth.type !== "none" && (
                                    <>
                                        {form.auth.type === "api_key" && (
                                            <input className="forensic-input hp-input" placeholder="Header name (default X-API-Key)" value={form.auth.headerName || ""} onChange={(e) => set({ auth: { ...form.auth, headerName: e.target.value } })} />
                                        )}
                                        <input className="forensic-input hp-input" type="password" placeholder={form.auth.type === "hmac" ? "Shared signing secret" : "Token / key"} value={form.auth.token || ""} onChange={(e) => set({ auth: { ...form.auth, token: e.target.value } })} />
                                    </>
                                )}
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>ONLY_ALERT_ABOVE_RISK_SCORE</div>
                                <input type="number" min="0" max="100" className="forensic-input hp-input hp-num" style={{ marginLeft: 0 }} value={form.filters?.minRiskScore ?? 0}
                                    onChange={(e) => set({ filters: { ...form.filters, minRiskScore: +e.target.value } })} />
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>ONLY_THESE_SCAM_TYPES (comma separated, empty = all)</div>
                                <input className="forensic-input hp-input" placeholder="OTP_FRAUD, BANK_IMPERSONATION" value={(form.filters?.scamTypes || []).join(", ")}
                                    onChange={(e) => set({ filters: { ...form.filters, scamTypes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} />
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>DELIVERY_RETRIES</div>
                                <label className="hp-check mono">
                                    <input type="checkbox" checked={!!form.retryConfig?.enabled} onChange={(e) => set({ retryConfig: { ...form.retryConfig, enabled: e.target.checked } })} /> retry failed webhooks
                                    <input type="number" min="1" max="10" className="forensic-input hp-input hp-num" value={form.retryConfig?.maxRetries ?? 3}
                                        onChange={(e) => set({ retryConfig: { ...form.retryConfig, maxRetries: +e.target.value } })} />
                                </label>
                                <div className="dossier-label mono" style={{ marginTop: 10 }}>RATE_LIMIT</div>
                                <div className="hp-actions">
                                    <label className="hp-check mono">per hour
                                        <input type="number" min="1" className="forensic-input hp-input hp-num" value={form.filters?.rateLimit?.maxAlertsPerHour ?? 10}
                                            onChange={(e) => set({ filters: { ...form.filters, rateLimit: { ...form.filters.rateLimit, maxAlertsPerHour: +e.target.value } } })} />
                                    </label>
                                    <label className="hp-check mono">per day
                                        <input type="number" min="1" className="forensic-input hp-input hp-num" value={form.filters?.rateLimit?.maxAlertsPerDay ?? 50}
                                            onChange={(e) => set({ filters: { ...form.filters, rateLimit: { ...form.filters.rateLimit, maxAlertsPerDay: +e.target.value } } })} />
                                    </label>
                                </div>
                                <div className="hp-actions" style={{ marginTop: 12 }}>
                                    <button className="btn-forensic-scan hp-link-btn" onClick={save} disabled={busy}>[ SAVE_CONFIG ]</button>
                                    <button className="btn-demo" onClick={test} disabled={busy || !form.webhookUrl}>TEST_WEBHOOK</button>
                                </div>
                                {msg && <div className="mono" style={{ marginTop: 8, color: msg.ok ? "var(--green)" : "var(--red)", wordBreak: "break-all" }}>{msg.text}</div>}
                            </>
                        )}
                    </Panel>
                </div>
                <div>
                    <Panel title="DELIVERY_STATS">
                        {stats.data ? (
                            <>
                                <Kv k="TOTAL_ALERTS" v={stats.data.total} />
                                <Kv k="DELIVERED" v={stats.data.successful} color="var(--green)" />
                                <Kv k="FAILED" v={stats.data.failed} color={stats.data.failed ? "var(--red)" : undefined} />
                                <Kv k="SUCCESS_RATE" v={`${stats.data.successRate}%`} />
                                <Kv k="LAST_ALERT" v={fmtDate(stats.data.lastAlert)} />
                                <Kv k="WEBHOOK_RETRIES" v={stats.data.retries} />
                                <Kv k="DEAD_LETTERS (gave up)" v={stats.data.deadLetters} color={stats.data.deadLetters ? "var(--red)" : undefined} />
                                <Kv k="WEBHOOK_LATENCY" v={stats.data.latency ? `avg ${stats.data.latency.avgMs}ms · p50 ${stats.data.latency.p50Ms}ms · p95 ${stats.data.latency.p95Ms}ms (${stats.data.latency.samples} sends)` : "no webhook sends yet"} />
                            </>
                        ) : <Status loading={stats.loading} error={stats.error} />}
                    </Panel>
                    <Panel title={`INCIDENTS (${incidents.data?.length ?? 0}) — related alerts collapsed into one`}>
                        <Status loading={incidents.loading && !incidents.data} error={incidents.error} empty={incidents.data && !incidents.data.length} emptyText="No incidents yet. Alerts for the same scammer are grouped here instead of repeating." />
                        <div className="hp-scroll" style={{ maxHeight: 320 }}>
                            {incidents.data?.map((i) => (
                                <div key={i.incidentId} className={`hp-incident ${i.status}`}>
                                    <div className="hp-panel-head">
                                        <div className="mono"><b style={{ color: riskColor(i.maxRisk) }}>{i.severity}</b> · {i.incidentId} · {i.status}</div>
                                        {i.status === "open" && <button className="btn-demo hp-small" onClick={async () => { await resolveIncident(i.incidentId).catch(() => {}); incidents.reload(); }}>RESOLVE</button>}
                                    </div>
                                    <div className="mono" style={{ fontSize: 12 }}>{i.title}</div>
                                    <div className="mono hp-muted">{i.sessions} session(s) · {i.eventCount} trigger(s) · alerts sent {i.alertsSent}, suppressed {i.alertsSuppressed} · last {fmtDate(i.lastEventAt)}</div>
                                    <Chips items={[...i.identifiers.upiIds, ...i.identifiers.phoneNumbers]} color="var(--red)" />
                                </div>
                            ))}
                        </div>
                    </Panel>
                    <Panel title={`PRIORITIZED_REVIEW_QUEUE (${triage.data?.count ?? triage.data?.length ?? 0})`}>
                        <Status loading={triage.loading && !triage.data} error={triage.error} empty={(triage.data?.data || triage.data || []).length === 0} emptyText="No alerts to prioritize yet." />
                        <div className="hp-scroll">
                            {(triage.data?.data || triage.data || []).map((a, i) => {
                                const item = a.triage || {};
                                const color = item.priority === "P1" ? "var(--red)" : item.priority === "P2" ? "var(--orange, #f0a34a)" : item.priority === "P3" ? "var(--yellow, #d9bd55)" : "var(--green)";
                                return (
                                    <div key={a.id || a._id || i} className="hp-row">
                                        <div className="hp-row-main">
                                            <div className="mono" style={{ color, fontWeight: 700 }}>{item.priority || "P4"} · {item.score ?? 0}/100 · {a.type || "alert"}</div>
                                            <div className="mono hp-muted">{a.sessionId || a.payload?.alert?.sessionId || "—"} · {fmtDate(a.timestamp || a.payload?.timestamp)}</div>
                                            <div className="mono hp-muted" style={{ whiteSpace: "normal" }}>
                                                {(item.factors || []).filter((f) => f.points > 0).map((f) => `${f.name.replace(/_/g, " ")} +${f.points}`).join(" · ") || "No additional risk factors recorded"}
                                            </div>
                                        </div>
                                        <div className="mono hp-risk" style={{ color }}>{item.recommendedAction || "monitor"}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mono hp-muted" style={{ fontSize: 11, marginTop: 8 }}>Priority supports analyst review; it is not proof of malicious activity or identity.</div>
                    </Panel>
                    <Panel title="ALERT_HISTORY">
                        <Status loading={history.loading && !history.data} error={history.error} empty={history.data && !history.data.length} emptyText="No alerts fired yet — they trigger when a session crosses a threshold." />
                        <div className="hp-scroll">
                            {[...(history.data || [])].reverse().map((a, i) => (
                                <div key={i} className="hp-row">
                                    <div className="hp-row-main">
                                        <div className="mono" style={{ color: "var(--red)" }}>{a.type}</div>
                                        <div className="mono hp-muted">{a.sessionId || "—"} · {fmtDate(a.timestamp)}</div>
                                    </div>
                                    <div className="mono hp-risk" style={{ color: a.delivered ? "var(--green)" : "var(--red)" }}>{a.delivered ? "SENT" : "FAILED"}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    );
}
