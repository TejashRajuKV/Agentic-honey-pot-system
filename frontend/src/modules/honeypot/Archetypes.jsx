import { listSessions, listProfiles } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Status, Bar } from "./shared";

const tally = (rows, pick) =>
    Object.entries(rows.reduce((m, r) => { const k = pick(r) || "UNKNOWN"; m[k] = (m[k] || 0) + 1; return m; }, {}))
        .sort((a, b) => b[1] - a[1]);

function Dist({ title, entries, color }) {
    return (
        <Panel title={title}>
            {!entries.length ? <div className="mono hp-muted">no data yet</div> : entries.map(([k, n]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                    <Kv k={k} v={n} />
                    <Bar value={n} max={entries[0][1]} color={color} />
                </div>
            ))}
        </Panel>
    );
}

/** How scams are shaped: archetypes, how hard scammers push, and who they target. */
export default function Archetypes() {
    const sessions = useLoad(() => listSessions({ limit: 100, scam: "true" }), [], 30000);
    const profiles = useLoad(() => listProfiles({ limit: 100 }), [], 30000);
    const s = sessions.data || [];
    const p = profiles.data || [];

    return (
        <>
            <SectionLabel>SCAM_ARCHETYPES_&_VICTIM_VULNERABILITY — patterns across detected scam sessions</SectionLabel>
            <Status loading={sessions.loading && !sessions.data} error={sessions.error} empty={sessions.data && !s.length} emptyText="NO_SCAM_SESSIONS_YET — engage the honeypot first." />
            {s.length > 0 && (
                <div className="hp-grid-2">
                    <Dist title={`SCAM_ARCHETYPES (${s.length} sessions)`} entries={tally(s, (x) => x.scamType)} color="var(--red)" />
                    <Dist title="VICTIM_VULNERABILITY_TARGETED" entries={tally(s, (x) => x.userVulnerability)} color="var(--amber)" />
                    <Dist title="ENGAGEMENT_PHASE_REACHED" entries={tally(s, (x) => x.phase)} color="var(--cyan)" />
                    <Dist title="PERSONA_USED_BY_AGENT" entries={tally(s, (x) => x.persona)} color="var(--green)" />
                </div>
            )}
            <SectionLabel>SCAMMER_BEHAVIOUR — from {p.length} profiled scammers</SectionLabel>
            <Status loading={profiles.loading && !profiles.data} error={profiles.error} empty={profiles.data && !p.length} emptyText="NO_PROFILES_YET" />
            {p.length > 0 && (
                <div className="hp-grid-2">
                    <Dist title="PRESSURE_VELOCITY" entries={tally(p, (x) => x.behavioralFingerprint?.pressureVelocity)} color="var(--red)" />
                    <Dist title="PRIMARY_TACTIC" entries={tally(p, (x) => x.psychologicalProfile?.primaryTactic)} color="var(--amber)" />
                    <Dist title="SOPHISTICATION" entries={tally(p, (x) => x.psychologicalProfile?.sophistication)} color="var(--cyan)" />
                    <Dist title="DOMINANT_EMOTION_EXPLOITED" entries={tally(p, (x) => x.behavioralFingerprint?.emotionSignature?.primaryEmotion)} color="var(--green)" />
                </div>
            )}
        </>
    );
}
