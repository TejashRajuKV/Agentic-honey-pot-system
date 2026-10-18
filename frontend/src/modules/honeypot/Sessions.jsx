import { useEffect, useState } from "react";
import {
    listSessions, getSession, getTimeline, getQualityReport, buildProfile, correlateSession,
    pdfReportUrl, jsonReportUrl, getSessionLanguage,
    getAuditTrail, getQualityTurns, getRepetition, listReports, generateReport,
} from "../../api/honeypotApi";
import KillChainPanel from "./KillChain";
import { useLoad, SectionLabel, Panel, Kv, Chips, Status, Bar, errMsg, fmtDate, riskColor } from "./shared";

export default function Sessions({ selected, onSelect, openProfile }) {
    const [scamOnly, setScamOnly] = useState(false);
    const list = useLoad(() => listSessions({ limit: 50, scam: scamOnly ? "true" : undefined }), [scamOnly], 15000);

    return (
        <>
            <SectionLabel>CONVERSATIONS — every scam conversation the honeypot has handled (web console and evaluator API)</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel
                        title={`SESSIONS (${list.data?.length ?? 0})`}
                        action={
                            <label className="mono hp-muted" style={{ cursor: "pointer" }}>
                                <input type="checkbox" checked={scamOnly} onChange={(e) => setScamOnly(e.target.checked)} /> scams only
                            </label>
                        }
                    >
                        <Status loading={list.loading && !list.data} error={list.error} empty={list.data && !list.data.length} emptyText="NO_SESSIONS — start one in LIVE ENGAGEMENT." />
                        <div className="hp-scroll">
                            {list.data?.map((s) => (
                                <div key={s.sessionId} className={`hp-row ${selected === s.sessionId ? "active" : ""}`} onClick={() => onSelect(s.sessionId)}>
                                    <div className="hp-row-main">
                                        <div className="mono">{s.sessionId}</div>
                                        <div className="mono hp-muted">{s.platform} · {s.turns} turns · {fmtDate(s.lastActiveAt)}</div>
                                    </div>
                                    <div className="mono hp-risk" style={{ color: s.scamDetected ? riskColor(s.scamProbability) : "var(--green)" }}>
                                        {s.scamDetected ? `${s.scamProbability}%` : "CLEAN"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
                <div>
                    {selected ? <SessionDetail key={selected} id={selected} openProfile={openProfile} /> : (
                        <Panel><div className="mono hp-muted">Select a session to see its transcript, extracted intelligence, timeline, quality report and downloadable evidence report.</div></Panel>
                    )}
                </div>
            </div>
        </>
    );
}

function SessionDetail({ id, openProfile }) {
    const detail = useLoad(() => getSession(id), [id]);
    const timeline = useLoad(() => getTimeline(id), [id]);
    const quality = useLoad(() => getQualityReport(id).catch(() => null), [id]);
    const lang = useLoad(() => getSessionLanguage(id).catch(() => null), [id]);
    const turnsQ = useLoad(() => getQualityTurns(id), [id]);
    const rep = useLoad(() => getRepetition(id), [id]);
    const audit = useLoad(() => getAuditTrail(id), [id]);
    const [action, setAction] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { setAction(null); }, [id]);

    const run = async (label, fn) => {
        setBusy(true); setAction(null);
        try { setAction({ label, ok: true, data: await fn() }); }
        catch (e) { setAction({ label, ok: false, error: errMsg(e) }); }
        finally { setBusy(false); }
    };

    const d = detail.data;
    const s = d?.session;

    return (
        <>
            <Status loading={detail.loading} error={detail.error} />
            {s && (
                <>
                    <Panel title={`CASE ${s.sessionId}`}>
                        <Kv k="VERDICT" v={s.scamDetected ? "SCAM" : "NO SCAM DETECTED"} color={s.scamDetected ? "var(--red)" : "var(--green)"} />
                        <Kv k="RISK" v={`${s.scamProbability}%`} color={riskColor(s.scamProbability)} />
                        <Kv k="ARCHETYPE" v={s.scamType} />
                        <Kv k="PHASE / FSM" v={`${s.phase} / ${s.fsmState ?? "—"}`} />
                        <Kv k="PERSONA" v={s.persona} />
                        <Kv k="PLATFORM" v={`${s.platform} (${s.status})`} />
                        <Kv k="OPENED" v={fmtDate(s.createdAt)} />
                        <div className="hp-actions">
                            <a className="btn-forensic-scan hp-link-btn" href={pdfReportUrl(id)} download>[ DOWNLOAD_PDF ]</a>
                            <a className="btn-demo hp-link-btn" href={jsonReportUrl(id)} download>[ DOWNLOAD_JSON ]</a>
                            <button className="btn-demo" disabled={busy} onClick={() => run("REPORT", () => generateReport(id, "pdf"))}>GENERATE_PDF_ON_SERVER</button>
                            <button className="btn-demo" disabled={busy} onClick={() => run("PROFILE", () => buildProfile(id))}>BUILD_PROFILE</button>
                            <button className="btn-demo" disabled={busy} onClick={() => run("CORRELATE", () => correlateSession(id))}>CORRELATE_SESSIONS</button>
                        </div>
                        {action && (
                            <div className="hp-action-result mono">
                                {!action.ok ? <span style={{ color: "var(--red)" }}>!! {action.label}: {action.error}</span> : action.label === "REPORT" ? (
                                    <span>Report saved on server: {action.data.filename} ({Math.round((action.data.size || 0) / 1024)} KB) — listed in REPORT_ARCHIVE</span>
                                ) : action.label === "PROFILE" ? (
                                    <span>Profile updated: {action.data.profileId} (risk {action.data.riskScore}) — <a href="#profiles" onClick={(e) => { e.preventDefault(); openProfile(action.data.profileId); }}>open</a></span>
                                ) : (
                                    <span>{action.data.totalMatches} related session(s), confidence {Math.round((action.data.confidence || 0) * 100)}%{action.data.related?.length ? `: ${action.data.related.map((r) => r.sessionId || r).join(", ")}` : ""}</span>
                                )}
                            </div>
                        )}
                    </Panel>


                    <Panel title="AGENT_STATE (what the honeypot was thinking)">
                        <Kv k="PERSONA" v={s.agent?.personaDetail ? `${s.agent.personaDetail.name} (${s.agent.personaDetail.type ?? "—"})` : s.persona} />
                        <Kv k="RESPONSE_MODE" v={s.agent?.responseMode} />
                        <Kv k="FSM_SCENARIO" v={s.agent?.fsmScenario} />
                        <Kv k="BAITS_USED" v={`${s.agent?.baitUsedCount ?? 0}${s.agent?.lastBaitType ? ` (last: ${s.agent.lastBaitType})` : ""}`} />
                        <Kv k="EVASION_SCORE" v={s.evasionScore != null ? Number(s.evasionScore).toFixed(2) : null} />
                        <Kv k="SCAMMER_REVEALED_INTEL" v={s.agent?.triggeredReveal ? "YES" : "NO"} />
                        <Kv k="VICTIM_VULNERABILITY" v={s.agent?.userVulnerability} />
                        <Kv k="CONFIDENCE_LOCKED" v={s.agent?.confidenceLocked ? "YES" : "NO"} />
                        <Kv k="FINAL_CALLBACK_SENT" v={s.agent?.finalCallbackSent ? "YES" : "NO"} />
                        <Kv k="SAFETY_GOVERNOR_INTERVENTIONS" v={s.agent?.safetyInterventions ?? 0} color={s.agent?.safetyInterventions ? "var(--amber)" : undefined} />
                        <Kv k="PROMPT_INJECTION_ATTEMPTS" v={s.agent?.injectionAttempts ?? 0} color={s.agent?.injectionAttempts ? "var(--red)" : undefined} />
                        <div className="dossier-label mono" style={{ marginTop: 6 }}>EMOTION_HISTORY (scammer)</div>
                        <Chips items={s.agent?.emotionHistory?.slice(-12)} />
                    </Panel>

                    <KillChainPanel id={id} />

                    <Panel title="TRANSCRIPT">
                        <div className="hp-chat hp-scroll">
                            {d.turns.map((t) => (
                                <div key={t.index} className={`hp-msg ${t.role === "agent" ? "agent" : "scammer"}`}>
                                    <div className="hp-msg-who mono">{t.role === "agent" ? "AGENT" : "SCAMMER"} · {fmtDate(t.timestamp)}</div>
                                    <div className="hp-msg-body">{t.text}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="EXTRACTED_INTELLIGENCE">
                        <div className="dossier-label mono">UPI_IDS</div><Chips items={d.intelligence?.upiIds} color="var(--red)" />
                        <div className="dossier-label mono" style={{ marginTop: 8 }}>PHONE_NUMBERS</div><Chips items={d.intelligence?.phoneNumbers} color="var(--red)" />
                        <div className="dossier-label mono" style={{ marginTop: 8 }}>LINKS</div><Chips items={d.intelligence?.urls} color="var(--amber)" />
                        <div className="dossier-label mono" style={{ marginTop: 8 }}>SCAM_PHRASES</div><Chips items={d.intelligence?.scamPhrases} />
                        <div className="dossier-label mono" style={{ marginTop: 8 }}>BEHAVIOURS</div><Chips items={d.intelligence?.behavioralPatterns} />
                    </Panel>

                    <Panel title="TIMELINE">
                        <Status loading={timeline.loading} error={timeline.error} empty={timeline.data && !timeline.data.length} />
                        {timeline.data?.map((t) => (
                            <div key={t.turn} className="hp-tl mono">
                                <span className="hp-muted">#{t.turn}</span> <b>{t.role}</b> — {t.preview}
                            </div>
                        ))}
                    </Panel>


                    <Panel title="PER_TURN_REPLY_QUALITY">
                        <Status loading={turnsQ.loading} error={turnsQ.error} empty={turnsQ.data && !turnsQ.data.length} emptyText="No replies scored yet." />
                        {turnsQ.data?.map((m) => (
                            <div key={m.turnNumber} style={{ marginBottom: 8 }}>
                                <Kv k={`TURN ${m.turnNumber}`} v={`${m.scores.overall.toFixed(2)}${m.flags?.length ? ` · flags: ${m.flags.map((f) => f.type || f).join(", ")}` : ""}`} />
                                <div className="mono hp-muted">“{m.analysis?.agentMessage}”</div>
                                <Bar value={m.scores.overall} color={m.scores.overall >= 0.6 ? "var(--green)" : "var(--amber)"} />
                            </div>
                        ))}
                        {rep.data && (
                            <Kv k="REPEATED_AGENT_REPLIES" v={rep.data.hasRepetition ? `${rep.data.count} repeat(s)` : "none"} color={rep.data.hasRepetition ? "var(--red)" : "var(--green)"} />
                        )}
                    </Panel>

                    <Panel title={`AUDIT_TRAIL (${audit.data?.length ?? 0} events)`}>
                        <Status loading={audit.loading} error={audit.error} empty={audit.data && !audit.data.length} emptyText="No audit events recorded." />
                        <div className="hp-scroll">
                            {audit.data?.map((e, i) => (
                                <div key={i} className="hp-tl mono">
                                    <span className="hp-muted">{fmtDate(e.timestamp)}</span> <b style={{ color: e.eventType === "SCAM_DETECTED" ? "var(--red)" : undefined }}>{e.eventType}</b>
                                    {e.detection?.confidence != null && ` · conf ${Math.round(e.detection.confidence * 100)}%`}
                                    {e.agentState?.phase && ` · phase ${e.agentState.phase}`}
                                    {e.agentState?.baitType && ` · bait ${e.agentState.baitType}`}
                                    {e.knownScammer?.isKnown && " · KNOWN SCAMMER"}
                                    {e.safety?.length > 0 && ` · ${e.safety.map((x) => x.check).join(", ")}`}
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <div className="hp-grid-2">
                        <Panel title="REPLY_QUALITY">
                            {quality.data ? (
                                <>
                                    <Kv k="TURNS_SCORED" v={quality.data.totalTurns} />
                                    <Kv k="OVERALL" v={quality.data.averageScores?.overall} />
                                    <Kv k="NATURALNESS" v={quality.data.averageScores?.naturalness} />
                                    <Kv k="STRATEGIC_VALUE" v={quality.data.averageScores?.strategicValue} />
                                    <Kv k="VERDICT" v={quality.data.recommendation?.level} />
                                    <div className="mono hp-muted">{quality.data.recommendation?.message}</div>
                                </>
                            ) : <div className="mono hp-muted">{quality.loading ? "LOADING…" : "Not scored yet."}</div>}
                        </Panel>
                        <Panel title="LANGUAGE">
                            {lang.data ? <pre className="hp-pre mono">{JSON.stringify(lang.data, null, 2)}</pre> : <div className="mono hp-muted">{lang.loading ? "LOADING…" : "No language data recorded."}</div>}
                        </Panel>
                    </div>
                </>
            )}
        </>
    );
}

export function ReportsList({ onSelect }) {
    const reports = useLoad(listReports, [], 20000);
    return (
        <Panel title={`REPORT_ARCHIVE (${reports.data?.length ?? 0} PDFs generated on server)`}>
            <Status loading={reports.loading && !reports.data} error={reports.error} empty={reports.data && !reports.data.length} emptyText="No PDFs generated yet — open a session and download or generate one." />
            <div className="hp-scroll" style={{ maxHeight: 220 }}>
                {reports.data?.map((r) => (
                    <div key={r.filename} className="hp-row" onClick={() => r.sessionId !== "unknown" && onSelect(r.sessionId)}>
                        <div className="hp-row-main">
                            <div className="mono">{r.filename}</div>
                            <div className="mono hp-muted">{Math.round(r.size / 1024)} KB · {fmtDate(r.created)}</div>
                        </div>
                        {r.sessionId !== "unknown" && <div className="mono hp-risk">OPEN</div>}
                    </div>
                ))}
            </div>
        </Panel>
    );
}
