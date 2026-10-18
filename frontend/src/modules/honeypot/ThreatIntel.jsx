import { getIntelSummary } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Stat, Status } from "./shared";
import { KnownIdentifiersPanel, KnownThreatCheck, ThreatNetworkPanel } from "./Profiles";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function Table({ title, rows, color }) {
    return (
        <Panel title={title}>
            {!rows?.length ? <div className="mono hp-muted">none harvested yet</div> : (
                <div className="hp-scroll" style={{ maxHeight: 260 }}>
                    {rows.map((r) => (
                        <div key={r.value} className="hp-row" style={{ cursor: "default" }}>
                            <div className="hp-row-main mono" style={color ? { color } : undefined}>{r.value}</div>
                            <div className="mono hp-muted">{r.count}× · {r.sessions} session(s)</div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

/**
 * Threat intelligence: everything harvested from scammers (UPI, phone, URLs, amounts, keywords, tactics)
 * plus the cross-session identifier database and correlation.
 */
export default function ThreatIntel({ view = "indicators" }) {
    const sum = useLoad(getIntelSummary, [], 20000);
    const d = sum.data;

    if (view === "database") {
        return (
            <>
                <SectionLabel>IDENTIFIER_DATABASE — cross-session UPI / phone records, lookup and correlation</SectionLabel>
                <div className="hp-split">
                    <div><KnownIdentifiersPanel /></div>
                    <div><KnownThreatCheck /><ThreatNetworkPanel /></div>
                </div>
            </>
        );
    }

    return (
        <>
            <SectionLabel>HARVESTED_INDICATORS — extracted from scammer messages across all honeypot sessions</SectionLabel>
            <Status loading={sum.loading && !d} error={sum.error} />
            {d && (
                <>
                    <div className="hp-grid-4">
                        <Stat label="UPI_IDS" value={d.totals.upiIds} color="var(--red)" />
                        <Stat label="PHONE_NUMBERS" value={d.totals.phoneNumbers} color="var(--red)" />
                        <Stat label="URLS" value={d.totals.urls} color="var(--amber)" />
                        <Stat label="KEYWORDS_&_TACTICS" value={d.totals.scamPhrases + d.totals.behavioralPatterns} />
                    </div>
                    <Panel title="MONEY_REQUESTED (amounts named by scammers)">
                        <Kv k="AMOUNTS_MENTIONED" v={d.amounts.count} />
                        <Kv k="TOTAL_ASKED" v={inr(d.amounts.total)} color="var(--red)" />
                        <Kv k="LARGEST_SINGLE_ASK" v={inr(d.amounts.max)} />
                        <Kv k="AVERAGE_ASK" v={inr(d.amounts.average)} />
                    </Panel>
                    <div className="hp-grid-2">
                        <Table title="UPI_IDS" rows={d.upiIds} color="var(--red)" />
                        <Table title="PHONE_NUMBERS" rows={d.phoneNumbers} color="var(--red)" />
                        <Table title="URLS" rows={d.urls} color="var(--amber)" />
                        <Table title="SCAM_KEYWORDS" rows={d.scamPhrases} />
                    </div>
                    <Table title="BEHAVIOURAL_TACTICS" rows={d.behavioralPatterns} />
                    <div className="mono hp-muted">Based on the {d.turnsAnalyzed} most recent scammer messages.</div>
                </>
            )}
        </>
    );
}
