import { listSessions, pdfReportUrl, jsonReportUrl, analyticsExportUrl, stixExportUrl } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Status, fmtDate, riskColor } from "./shared";
import { ReportsList } from "./Sessions";

/** Evidence reports: one PDF / JSON per conversation, plus analytics exports. */
export default function Reports({ openSession }) {
    const sessions = useLoad(() => listSessions({ limit: 50, scam: "true" }), [], 20000);

    return (
        <>
            <SectionLabel>EVIDENCE_REPORTS — PDF and JSON case files for every scam conversation</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel title={`SCAM_CASES (${sessions.data?.length ?? 0})`}>
                        <Status loading={sessions.loading && !sessions.data} error={sessions.error} empty={sessions.data && !sessions.data.length} emptyText="NO_SCAM_CASES — a report is available once the honeypot detects a scam." />
                        <div className="hp-scroll">
                            {sessions.data?.map((s) => (
                                <div key={s.sessionId} className="hp-row" style={{ cursor: "default" }}>
                                    <div className="hp-row-main">
                                        <div className="mono">{s.sessionId}</div>
                                        <div className="mono hp-muted">{s.scamType || "UNCLASSIFIED"} · {s.turns} turns · {fmtDate(s.lastActiveAt)}</div>
                                    </div>
                                    <div className="mono hp-risk" style={{ color: riskColor(s.scamProbability) }}>{s.scamProbability}%</div>
                                    <a className="btn-demo hp-small hp-link-btn" href={pdfReportUrl(s.sessionId)} download>PDF</a>
                                    <a className="btn-demo hp-small hp-link-btn" href={jsonReportUrl(s.sessionId)} download>JSON</a>
                                    <a className="btn-demo hp-small hp-link-btn" href={stixExportUrl(s.sessionId)} download>STIX</a>
                                    <button className="btn-demo hp-small" onClick={() => openSession(s.sessionId)}>CASE</button>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
                <div>
                    <ReportsList onSelect={openSession} />
                    <Panel title="STIX_2.1_INTELLIGENCE_EXPORT">
                        <div className="mono hp-muted" style={{ marginBottom: 8 }}>Indicators (UPI, phone, domain), campaigns and MITRE ATT&amp;CK techniques as a STIX 2.1 bundle — importable by CTI platforms such as MISP or OpenCTI.</div>
                        <a className="btn-forensic-scan hp-link-btn" href={stixExportUrl()} download>[ DOWNLOAD_STIX_BUNDLE ]</a>
                    </Panel>
                    <Panel title="ANALYTICS_EXPORT">
                        <div className="mono hp-muted" style={{ marginBottom: 8 }}>Daily roll-ups: sessions, scams, confidence, quality, new vs known scammers.</div>
                        <div className="hp-actions" style={{ marginTop: 0 }}>
                            {[7, 30, 90].map((d) => (
                                <span key={d} className="hp-actions" style={{ margin: 0 }}>
                                    <a className="btn-demo hp-link-btn" href={analyticsExportUrl("csv", d)} download>CSV · {d}d</a>
                                    <a className="btn-demo hp-link-btn" href={analyticsExportUrl("json", d)} download>JSON · {d}d</a>
                                </span>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    );
}
