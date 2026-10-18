import { useState } from "react";
import { getCampaigns, stixExportUrl } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Chips, Status, fmtDate, riskColor } from "./shared";

const pretty = (s) => String(s).toLowerCase().replace(/_/g, " ");

/**
 * Campaigns: honeypot sessions grouped by shared infrastructure (same UPI / phone / domain).
 * "Linked" means shared infrastructure — evidence of a common operation, not proof of one person.
 */
export default function Campaigns({ openSession }) {
    const [linkedOnly, setLinkedOnly] = useState(false);
    const camps = useLoad(() => getCampaigns(linkedOnly ? 2 : 1), [linkedOnly], 30000);

    return (
        <>
            <SectionLabel>CAMPAIGNS — sessions grouped by shared scammer infrastructure</SectionLabel>
            <div className="hp-actions" style={{ marginTop: 0, marginBottom: 12 }}>
                <label className="hp-check mono">
                    <input type="checkbox" checked={linkedOnly} onChange={(e) => setLinkedOnly(e.target.checked)} /> only campaigns spanning 2+ sessions
                </label>
                <a className="btn-demo hp-link-btn" href={stixExportUrl()} download>[ EXPORT_ALL_AS_STIX_2.1 ]</a>
            </div>
            <Status loading={camps.loading && !camps.data} error={camps.error} empty={camps.data && !camps.data.length} emptyText="NO_CAMPAIGNS — campaigns appear once sessions yield UPI IDs, phone numbers or links." />
            {camps.data?.map((c) => (
                <Panel key={c.campaignId} title={`${c.campaignId} — ${pretty(c.scamType)}`} action={<span className="mono hp-risk" style={{ color: riskColor(c.maxRisk) }}>PEAK {c.maxRisk}%</span>}>
                    <div className="hp-grid-2">
                        <div>
                            <Kv k="SESSIONS / VICTIMS_TARGETED" v={c.sessions} />
                            <Kv k="LINKED" v={c.linked ? "YES — shared infrastructure" : "single session"} color={c.linked ? "var(--red)" : undefined} />
                            <Kv k="ACTIVE" v={`${c.activeDays} day(s)`} />
                            <Kv k="FIRST → LAST_SEEN" v={`${fmtDate(c.firstSeen)} → ${fmtDate(c.lastSeen)}`} />
                            <div className="dossier-label mono" style={{ marginTop: 6 }}>DOMINANT_TACTICS</div>
                            <Chips items={c.dominantTactics.map((t) => `${pretty(t.tactic)} ×${t.count}`)} />
                        </div>
                        <div>
                            <div className="dossier-label mono">UPI_IDS</div><Chips items={c.identifiers.upiIds} color="var(--red)" />
                            <div className="dossier-label mono" style={{ marginTop: 6 }}>PHONES</div><Chips items={c.identifiers.phoneNumbers} color="var(--red)" />
                            <div className="dossier-label mono" style={{ marginTop: 6 }}>DOMAINS</div><Chips items={c.identifiers.domains} color="var(--amber)" />
                        </div>
                    </div>
                    {c.linkEvidence.length > 0 && (
                        <div className="mono hp-muted" style={{ marginTop: 8 }}>
                            Link evidence: {c.linkEvidence.map((e) => `${e.identifier} (${e.sessions} sessions)`).join(" · ")}
                        </div>
                    )}
                    <div className="hp-actions">
                        {c.sessionIds.slice(0, 8).map((sid) => <button key={sid} className="btn-demo hp-small" onClick={() => openSession(sid)}>{sid}</button>)}
                    </div>
                    <div className="mono hp-muted" style={{ marginTop: 6 }}>{c.caveat}</div>
                </Panel>
            ))}
        </>
    );
}
