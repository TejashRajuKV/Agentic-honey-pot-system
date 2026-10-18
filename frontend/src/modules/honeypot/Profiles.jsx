import { useEffect, useState } from "react";
import { listProfiles, getThreatFeed, getKnownIdentifiers, getThreatReport, matchProfiles, getThreatNetwork, checkKnownThreat } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Chips, Status, errMsg, fmtDate } from "./shared";

const splitList = (s) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

/** Scammer profiles: behavioural fingerprint, psychology, linked sessions, look-alikes. */
export default function Profiles({ selected, onSelect }) {
    const [view, setView] = useState("all");       // all | threats
    const [minRisk, setMinRisk] = useState(0);
    const profiles = useLoad(
        () => (view === "threats" ? getThreatFeed(50) : listProfiles({ limit: 50, ...(minRisk ? { minRisk } : {}) })),
        [view, minRisk],
        20000
    );

    return (
        <>
            <SectionLabel>SCAMMER_PROFILES — fingerprints built automatically from every scam session</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel
                        title={`PROFILES (${profiles.data?.length ?? 0})`}
                        action={
                            <div className="hp-actions" style={{ margin: 0 }}>
                                <button className={`hp-tab mono ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>ALL</button>
                                <button className={`hp-tab mono ${view === "threats" ? "active" : ""}`} onClick={() => setView("threats")}>ACTIVE_THREAT_FEED</button>
                            </div>
                        }
                    >
                        {view === "all" && (
                            <label className="hp-check mono">MIN_RISK {minRisk}
                                <input type="range" min="0" max="100" step="5" value={minRisk} onChange={(e) => setMinRisk(+e.target.value)} />
                            </label>
                        )}
                        <Status loading={profiles.loading && !profiles.data} error={profiles.error} empty={profiles.data && !profiles.data.length} emptyText="NO_PROFILES — a profile is created as soon as a scam session yields a UPI ID, phone number or link." />
                        <div className="hp-scroll">
                            {profiles.data?.map((p) => (
                                <div key={p.profileId} className={`hp-row ${selected === p.profileId ? "active" : ""}`} onClick={() => onSelect(p.profileId)}>
                                    <div className="hp-row-main">
                                        <div className="mono" style={{ color: "var(--red)" }}>
                                            {[...(p.identifiers?.upiIds || []), ...(p.identifiers?.phoneNumbers || [])].slice(0, 2).join(" · ") || p.profileId}
                                        </div>
                                        <div className="mono hp-muted">{p.psychologicalProfile?.primaryTactic ?? "—"} · last seen {fmtDate(p.lastSeen)}</div>
                                    </div>
                                    <div className="mono hp-risk">RISK {p.riskScore}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
                <div>
                    {selected ? <ProfileDetail key={selected} id={selected} onSelect={onSelect} /> : (
                        <Panel><div className="mono hp-muted">Select a profile to see the behavioural fingerprint, psychological profile, linked sessions and similar scammers.</div></Panel>
                    )}
                </div>
            </div>
        </>
    );
}

function ProfileDetail({ id, onSelect }) {
    const report = useLoad(() => getThreatReport(id), [id]);
    const matches = useLoad(() => matchProfiles(id), [id]);
    const r = report.data;

    return (
        <>
            <Status loading={report.loading} error={report.error} />
            {r && (
                <>
                    <Panel title={`PROFILE ${r.profile.id}`}>
                        <Kv k="RISK_SCORE" v={r.profile.riskScore} color={r.profile.riskScore >= 60 ? "var(--red)" : "var(--amber)"} />
                        <Kv k="STATUS" v={r.profile.status} />
                        <Kv k="FIRST_SEEN" v={fmtDate(r.profile.firstSeen)} />
                        <Kv k="LAST_SEEN" v={fmtDate(r.profile.lastSeen)} />
                        <div className="dossier-label mono">UPI_IDS</div><Chips items={r.profile.identifiers?.upiIds} color="var(--red)" />
                        <div className="dossier-label mono" style={{ marginTop: 8 }}>PHONES</div><Chips items={r.profile.identifiers?.phoneNumbers} color="var(--red)" />
                        <div className="dossier-label mono" style={{ marginTop: 8 }}>LINKS</div><Chips items={r.profile.identifiers?.urls} color="var(--amber)" />
                    </Panel>
                    <div className="hp-grid-2">
                        <Panel title="PSYCHOLOGY">
                            <Kv k="PRIMARY_TACTIC" v={r.psychological?.primaryTactic} />
                            <Kv k="SOPHISTICATION" v={r.psychological?.sophistication} />
                            <Kv k="ADAPTABILITY" v={r.psychological?.adaptability} />
                            <Kv k="PERSISTENCE" v={r.psychological?.persistenceScore} />
                            <div className="dossier-label mono">TECHNIQUES</div><Chips items={r.psychological?.manipulationTechniques} />
                        </Panel>
                        <Panel title="BEHAVIOURAL_FINGERPRINT">
                            <Kv k="PRESSURE_VELOCITY" v={r.behavioral?.pressureVelocity} />
                            <Kv k="PRIMARY_EMOTION" v={r.behavioral?.emotionSignature?.primaryEmotion} />
                            <Kv k="ACTIVE_HOURS" v={r.behavioral?.timePatterns?.activeHours?.join(", ")} />
                            <Kv k="AVG_MSG_LENGTH" v={r.behavioral?.avgMessageLength} />
                            <div className="dossier-label mono">PRESSURE_TACTICS</div><Chips items={r.behavioral?.pressureTactics} />
                        </Panel>
                    </div>
                    <Panel title="SIGNATURE_PHRASES"><Chips items={r.behavioral?.signaturePhrases?.slice(0, 12)} /></Panel>
                    <Panel title={`LINKED_SESSIONS (${r.sessions?.total ?? 0})`}>
                        {r.sessions?.details?.map((s, i) => (
                            <div key={i} className="hp-tl mono">{s.sessionId} — {s.platform}, {s.probability}% ({s.phase}) · {fmtDate(s.date)}</div>
                        ))}
                    </Panel>
                    <Panel title="SIMILAR_SCAMMERS">
                        <Status loading={matches.loading} error={matches.error} empty={matches.data && !matches.data.length} emptyText="No similar profiles yet." />
                        {matches.data?.map((m, i) => (
                            <div key={i} className="hp-row" onClick={() => m.profileId && onSelect(m.profileId)}>
                                <div className="hp-row-main mono">{m.profileId}<div className="hp-muted">shared: {(m.sharedTraits || []).join(", ") || "—"}</div></div>
                                <div className="mono hp-risk">{Math.round((m.similarity ?? 0) * 100)}%</div>
                            </div>
                        ))}
                    </Panel>
                </>
            )}
        </>
    );
}

/** Cross-session UPI / phone database. */
export function KnownIdentifiersPanel() {
    const known = useLoad(() => getKnownIdentifiers(50), [], 20000);
    return (
        <Panel title={`KNOWN_IDENTIFIER_DATABASE (${known.data?.length ?? 0})`}>
            <Status loading={known.loading && !known.data} error={known.error} empty={known.data && !known.data.length} emptyText="No UPI IDs or phone numbers recorded yet." />
            <div className="hp-scroll" style={{ maxHeight: 280 }}>
                {known.data?.map((k) => (
                    <div key={k.id} className="hp-row" style={{ cursor: "default" }}>
                        <div className="hp-row-main">
                            <div className="mono" style={{ color: "var(--red)" }}>{k.kind} · {k.identifier}</div>
                            <div className="mono hp-muted">{k.sessionCount} session(s) · {k.scamTypes.slice(0, 3).join(", ") || "—"} · last seen {fmtDate(k.lastSeenAt)}{k.isBlacklisted ? " · BLACKLISTED" : ""}</div>
                        </div>
                        <div className="mono hp-risk" style={{ color: k.riskLevel === "CRITICAL" || k.riskLevel === "HIGH" ? "var(--red)" : "var(--amber)" }}>{k.riskLevel}</div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

/** Profiles linked to each other through shared identifiers. */
export function ThreatNetworkPanel() {
    const network = useLoad(getThreatNetwork, [], 30000);
    return (
        <Panel title="CROSS_SESSION_CORRELATION_NETWORK">
            {network.data ? (
                <>
                    <Kv k="PROFILES" v={network.data.statistics?.totalProfiles} />
                    <Kv k="LINKS_BETWEEN_PROFILES" v={network.data.statistics?.totalConnections} />
                    <Kv k="AVG_LINKS/PROFILE" v={network.data.statistics?.avgConnectionsPerProfile} />
                    {network.data.edges?.map((e, i) => (
                        <div key={i} className="mono hp-muted">{e.source} ↔ {e.target} ({e.type || e.reason || "linked"})</div>
                    ))}
                    {!network.data.edges?.length && <div className="mono hp-muted">No shared identifiers between different scammers yet.</div>}
                </>
            ) : <Status loading={network.loading} error={network.error} />}
        </Panel>
    );
}

/** Is this UPI / phone / URL already in the intelligence database? */
export function KnownThreatCheck() {
    const [upi, setUpi] = useState("");
    const [phone, setPhone] = useState("");
    const [url, setUrl] = useState("");
    const [res, setRes] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { setRes(null); }, [upi, phone, url]);

    const check = async () => {
        setBusy(true); setErr(null);
        try {
            setRes(await checkKnownThreat({ upiIds: splitList(upi), phoneNumbers: splitList(phone), urls: splitList(url) }));
        } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <Panel title="KNOWN_THREAT_LOOKUP">
            <input className="forensic-input hp-input" placeholder="UPI IDs (comma separated)" value={upi} onChange={(e) => setUpi(e.target.value)} />
            <input className="forensic-input hp-input" placeholder="Phone numbers" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="forensic-input hp-input" placeholder="URLs" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn-demo" style={{ marginTop: 8 }} onClick={check} disabled={busy || !(upi || phone || url).trim()}>{busy ? "CHECKING…" : "[ CHECK_AGAINST_INTEL_DB ]"}</button>
            {err && <div className="error-box mono">!! {err}</div>}
            {res && (
                <div className="mono" style={{ marginTop: 10, color: res.isKnownThreat ? "var(--red)" : "var(--green)" }}>
                    {res.isKnownThreat
                        ? `KNOWN THREAT — ${res.matches?.intelligence?.length ?? 0} intel record(s), ${res.matches?.profiles?.length ?? 0} profile(s)`
                        : "No matches — identifiers not seen before."}
                    {res.matches?.intelligence?.map((m, i) => (
                        <div key={i} className="hp-muted">{m.upiId || m.phoneNumber || m.url}: {m.riskLevel}, {m.sessionCount} session(s)</div>
                    ))}
                </div>
            )}
        </Panel>
    );
}
