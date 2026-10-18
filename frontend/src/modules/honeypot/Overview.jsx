import { useState } from "react";
import { getDashboard, getTopScammers, getHeatmap, getQualityMetrics, getAlertStats, aggregateAnalytics, listSessions, getTrends, getAuditStats, analyticsExportUrl } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Stat, Status, Kv, Bar, errMsg, fmtDate } from "./shared";

export default function Overview({ openProfile }) {
    const dash = useLoad(getDashboard, [], 20000);
    const top = useLoad(() => getTopScammers(5), [], 20000);
    const heat = useLoad(() => getHeatmap(30), [], 60000);
    const quality = useLoad(getQualityMetrics, [], 20000);
    const alerts = useLoad(getAlertStats, [], 20000);
    const [days, setDays] = useState(30);
    const trends = useLoad(() => getTrends(days), [days], 60000);
    const audit = useLoad(getAuditStats, [], 20000);
    const recent = useLoad(() => listSessions({ limit: 100, scam: "true" }), [], 30000);
    const archetypes = Object.entries((recent.data || []).reduce((m, s) => { const k = s.scamType || "UNCLASSIFIED"; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const refresh = async () => {
        setBusy(true); setErr(null);
        try {
            await aggregateAnalytics();
            await Promise.all([dash.reload(), heat.reload(), top.reload(), trends.reload()]);
        } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
    };

    const d = dash.data;
    const hm = heat.data;
    const hmMax = hm ? Math.max(1, ...hm.data.flat()) : 1;

    return (
        <>
            <SectionLabel>HONEYPOT_OVERVIEW — live from the engagement database</SectionLabel>
            <Status loading={dash.loading && !d} error={dash.error} />
            {d && (
                <div className="hp-grid-4">
                    <Stat label="TOTAL_SESSIONS" value={d.totals?.sessions} />
                    <Stat label="SCAMS_DETECTED" value={d.totals?.scams} color="var(--red)" />
                    <Stat label="KNOWN_SCAMMERS" value={d.totals?.scammers} color="var(--amber)" />
                    <Stat label="DETECTION_RATE" value={d.totals?.detectionRate != null ? `${d.totals.detectionRate}%` : "—"} />
                </div>
            )}

            {d && (
                <div className="hp-grid-2">
                    <Panel title="TODAY">
                        <Kv k="SESSIONS" v={d.today?.sessions} />
                        <Kv k="SCAMS" v={d.today?.scams} />
                        <Kv k="AVG_CONFIDENCE" v={d.today?.confidence != null ? `${d.today.confidence.toFixed(1)}%` : null} />
                        <Kv k="AVG_REPLY_QUALITY" v={d.today?.quality != null ? d.today.quality.toFixed(2) : null} />
                    </Panel>
                    <Panel title="ENGINE_HEALTH">
                        <Kv k="REPLIES_SCORED" v={quality.data?.totalEvaluations} />
                        <Kv k="AVG_QUALITY" v={quality.data?.averageScores?.overall} />
                        <Kv k="ALERTS_SENT" v={alerts.data?.total} />
                        <Kv k="ALERT_SUCCESS" v={alerts.data?.successRate != null ? `${alerts.data.successRate}%` : null} />
                    </Panel>
                </div>
            )}

            <SectionLabel>AGENT_ACTIVITY</SectionLabel>
            <div className="hp-grid-2">
                <Panel title="AUDIT_COUNTERS (all sessions, all channels)">
                    {audit.data ? (
                        <>
                            <Kv k="SESSIONS_AUDITED" v={audit.data.totalSessions} />
                            <Kv k="SCAMS_DETECTED" v={audit.data.scamsDetected} />
                            <Kv k="BAITS_DEPLOYED" v={audit.data.baitsDeployed} />
                            <Kv k="REPEAT_SCAMMERS_SPOTTED" v={audit.data.repeatScammers} />
                        </>
                    ) : <Status loading={audit.loading} error={audit.error} />}
                </Panel>
            </div>

            <SectionLabel>SCAM_ARCHETYPES — last 100 scam sessions</SectionLabel>
            <Status loading={recent.loading && !recent.data} error={recent.error} empty={recent.data && !archetypes.length} emptyText="NO_SCAM_SESSIONS_YET" />
            {archetypes.length > 0 && (
                <Panel>
                    {archetypes.map(([k, n]) => (
                        <div key={k} style={{ marginBottom: 8 }}><Kv k={k} v={`${n} session(s)`} /><Bar value={n} max={archetypes[0][1]} color="var(--red)" /></div>
                    ))}
                </Panel>
            )}

            <SectionLabel>SCAM_PATTERN_TRENDS</SectionLabel>
            <div className="hp-actions" style={{ marginTop: 0, marginBottom: 10 }}>
                {[7, 30, 90].map((d) => (
                    <button key={d} className={`hp-tab mono ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>{d} DAYS</button>
                ))}
                <a className="btn-demo hp-link-btn" href={analyticsExportUrl("csv", days)} download>[ EXPORT_CSV ]</a>
                <a className="btn-demo hp-link-btn" href={analyticsExportUrl("json", days)} download>[ EXPORT_JSON ]</a>
            </div>
            <Status loading={trends.loading && !trends.data} error={trends.error} empty={trends.data && !trends.data.length} emptyText="NO_TREND_DATA — trends appear once analytics are aggregated for at least one day with scam patterns." />
            {trends.data?.length > 0 && (
                <Panel>
                    {trends.data.slice(0, 10).map((t) => (
                        <div key={t.pattern} style={{ marginBottom: 10 }}>
                            <Kv k={t.pattern} v={`${t.totalFrequency} hits · avg conf ${(t.avgConfidence * (t.avgConfidence <= 1 ? 100 : 1)).toFixed(0)}%`} />
                            <Bar value={t.totalFrequency} max={trends.data[0].totalFrequency} color="var(--amber)" />
                        </div>
                    ))}
                </Panel>
            )}

            <SectionLabel>TOP_SCAMMER_PROFILES</SectionLabel>
            <Status loading={top.loading && !top.data} error={top.error} empty={top.data && !top.data.length} emptyText="NO_PROFILES_YET — engage the honeypot to build some." />
            {top.data?.length > 0 && (
                <Panel>
                    {top.data.map((p) => (
                        <div key={p.profileId} className="hp-row" onClick={() => openProfile?.(p.profileId)}>
                            <div className="hp-row-main">
                                <div className="mono" style={{ color: "var(--red)" }}>
                                    {[...(p.identifiers?.upiIds || []), ...(p.identifiers?.phoneNumbers || [])].slice(0, 2).join(" · ") || p.profileId}
                                </div>
                                <div className="mono hp-muted">
                                    tactic: {p.psychologicalProfile?.primaryTactic ?? "—"} · sophistication: {p.psychologicalProfile?.sophistication ?? "—"} · last seen {fmtDate(p.lastSeen)}
                                </div>
                            </div>
                            <div className="mono hp-risk" style={{ color: p.riskScore >= 60 ? "var(--red)" : "var(--amber)" }}>RISK {p.riskScore}</div>
                        </div>
                    ))}
                </Panel>
            )}

            <SectionLabel>SCAM_ACTIVITY_HEATMAP — last 30 days (day × hour)</SectionLabel>
            <Status loading={heat.loading && !hm} error={heat.error} />
            {hm && (
                <Panel>
                    <div className="hp-heat">
                        {hm.data.map((row, di) => (
                            <div key={di} className="hp-heat-row">
                                <span className="mono hp-heat-day">{hm.labels.days[di].slice(0, 3).toUpperCase()}</span>
                                {row.map((v, hi) => (
                                    <i key={hi} title={`${hm.labels.days[di]} ${hm.labels.hours[hi]} — ${v}`}
                                       style={{ background: v ? `rgba(255,45,85,${0.25 + 0.75 * (v / hmMax)})` : undefined }} />
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="mono hp-muted" style={{ marginTop: 8 }}>{hm.totalScams} scam messages in window</div>
                </Panel>
            )}

            <div style={{ marginTop: 16 }}>
                <button className="btn-demo" onClick={refresh} disabled={busy}>{busy ? "AGGREGATING…" : "[ RE-AGGREGATE_ANALYTICS ]"}</button>
                {err && <span className="mono" style={{ color: "var(--red)", marginLeft: 12 }}>{err}</span>}
            </div>
        </>
    );
}
