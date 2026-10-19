import { useCallback, useEffect, useMemo, useState } from "react";
import { getThreatNetwork } from "../../api/honeypotApi";
import { SectionLabel, Panel, Kv, Status, errMsg, riskColor } from "./shared";

const pretty = (value) => String(value || "UNKNOWN").replace(/_/g, " ").toLowerCase();
const riskBand = (value) => Number(value) >= 80 ? "HIGH" : Number(value) >= 50 ? "MEDIUM" : "LOW";

/**
 * Analyst graph backed by /api/v1/intelligence/network.
 * Edges represent shared identifiers, not proof that two profiles are the same person.
 */
export default function ThreatGraph() {
    const [graph, setGraph] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [minRisk, setMinRisk] = useState("0");
    const [selectedId, setSelectedId] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getThreatNetwork();
            const next = {
                nodes: Array.isArray(result?.nodes) ? result.nodes : [],
                edges: Array.isArray(result?.edges) ? result.edges : [],
                statistics: result?.statistics || {},
            };
            setGraph(next);
            setSelectedId((current) => current && next.nodes.some((n) => n.id === current) ? current : next.nodes[0]?.id || null);
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const nodes = useMemo(() => {
        const term = query.trim().toLowerCase();
        return (graph?.nodes || []).filter((node) => {
            const text = `${node.id} ${node.label} ${node.tactics}`.toLowerCase();
            return Number(node.riskScore || 0) >= Number(minRisk) && (!term || text.includes(term));
        });
    }, [graph, query, minRisk]);

    const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
    const edges = useMemo(() => (graph?.edges || []).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)), [graph, nodeIds]);
    const positions = useMemo(() => {
        const cx = 450, cy = 245;
        const radius = Math.min(185, 65 + nodes.length * 5);
        return new Map(nodes.map((node, index) => {
            const angle = (2 * Math.PI * index / Math.max(nodes.length, 1)) - Math.PI / 2;
            return [node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }];
        }));
    }, [nodes]);
    const selected = nodes.find((node) => node.id === selectedId) || null;
    const linked = selected ? edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : [];

    const exportGraph = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            note: "Links indicate shared identifiers and are not proof of common identity.",
            nodes,
            edges,
            statistics: graph?.statistics || {},
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "cyberrakshak-threat-network.json";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <SectionLabel>THREAT_RELATIONSHIP_GRAPH — correlate active profiles by shared infrastructure</SectionLabel>
            <div className="hp-actions" style={{ marginTop: 0, marginBottom: 12 }}>
                <input className="forensic-input hp-input" style={{ maxWidth: 300, marginTop: 0 }} placeholder="Search profile, ID or tactic…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <label className="mono hp-muted">MIN RISK&nbsp;
                    <select className="forensic-input hp-input" style={{ display: "inline-block", width: 120, marginTop: 0 }} value={minRisk} onChange={(e) => setMinRisk(e.target.value)}>
                        <option value="0">ALL</option><option value="50">50+</option><option value="80">80+</option>
                    </select>
                </label>
                <button className="btn-demo" onClick={refresh} disabled={loading}>{loading ? "REFRESHING…" : "[ REFRESH_GRAPH ]"}</button>
                <button className="btn-demo" onClick={exportGraph} disabled={!nodes.length}>[ EXPORT_JSON ]</button>
            </div>

            <div className="hp-grid-4">
                <Panel title="ACTIVE_PROFILES"><div className="hp-stat mono hp-stat-num">{graph?.statistics?.totalProfiles ?? "—"}</div></Panel>
                <Panel title="SHARED-INFRASTRUCTURE LINKS"><div className="hp-stat mono hp-stat-num">{graph?.statistics?.totalConnections ?? "—"}</div></Panel>
                <Panel title="VISIBLE_NODES"><div className="hp-stat mono hp-stat-num">{nodes.length}</div></Panel>
                <Panel title="VISIBLE_LINKS"><div className="hp-stat mono hp-stat-num">{edges.length}</div></Panel>
            </div>

            <Status loading={loading && !graph} error={error} empty={Boolean(graph && !nodes.length)} emptyText="NO_MATCHING_PROFILES — active profiles appear here after the platform has collected enough intelligence." />

            {graph && nodes.length > 0 && (
                <div className="hp-split">
                    <Panel title="NETWORK_MAP — SELECT A NODE TO INSPECT">
                        <div style={{ width: "100%", overflowX: "auto" }}>
                            <svg viewBox="0 0 900 500" role="img" aria-label="Threat relationship graph showing active scammer profiles connected by shared identifiers" style={{ width: "100%", minWidth: 520, display: "block" }}>
                                <defs>
                                    <pattern id="threat-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                                        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="var(--border)" strokeWidth="0.6" opacity="0.5" />
                                    </pattern>
                                </defs>
                                <rect width="900" height="500" fill="url(#threat-grid)" />
                                {edges.map((edge, index) => {
                                    const a = positions.get(edge.source), b = positions.get(edge.target);
                                    if (!a || !b) return null;
                                    const active = selected && (edge.source === selected.id || edge.target === selected.id);
                                    return <line key={`${edge.source}-${edge.target}-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? "var(--amber)" : "var(--cyan)"} strokeWidth={active ? 2.5 : 1.2} opacity={active ? 0.9 : 0.28 + Math.min(Number(edge.weight || 1), 4) * 0.1} />;
                                })}
                                {nodes.map((node) => {
                                    const p = positions.get(node.id);
                                    const active = node.id === selected?.id;
                                    const radius = Math.max(11, Math.min(19, 10 + Number(node.sessionCount || 0)));
                                    return <g key={node.id} role="button" tabIndex={0} aria-label={`Select ${node.label}`} onClick={() => setSelectedId(node.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(node.id); }} style={{ cursor: "pointer", outline: "none" }}>
                                        <circle cx={p.x} cy={p.y} r={radius + (active ? 5 : 0)} fill="none" stroke={active ? "var(--amber)" : "transparent"} strokeWidth="2" />
                                        <circle cx={p.x} cy={p.y} r={radius} fill="var(--bg)" stroke={riskColor(node.riskScore)} strokeWidth={active ? 3 : 2} />
                                        <text x={p.x} y={p.y + 4} textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="700">{Math.round(Number(node.riskScore || 0))}</text>
                                        <text x={p.x} y={p.y + radius + 15} textAnchor="middle" fill="var(--text)" fontSize="10">{String(node.label || node.id).slice(0, 18)}</text>
                                    </g>;
                                })}
                            </svg>
                        </div>
                        <div className="hp-actions">
                            <span className="mono hp-muted">NODE COLOUR = RISK</span>
                            <span className="mono hp-muted">LINE = SHARED IDENTIFIER</span>
                            <span className="mono hp-muted">THICKER LINE = MORE SHARED INDICATORS</span>
                        </div>
                    </Panel>

                    <Panel title="SELECTED_PROFILE">
                        {selected ? <>
                            <Kv k="PROFILE_ID" v={selected.id} />
                            <Kv k="RISK_SCORE" v={`${Math.round(Number(selected.riskScore || 0))}% · ${riskBand(selected.riskScore)}`} color={riskColor(selected.riskScore)} />
                            <Kv k="SESSIONS" v={selected.sessionCount ?? 0} />
                            <Kv k="PRIMARY_TACTIC" v={pretty(selected.tactics)} />
                            <div className="dossier-label mono" style={{ marginTop: 12 }}>CONNECTED_PROFILES ({linked.length})</div>
                            {linked.length ? linked.map((edge) => {
                                const otherId = edge.source === selected.id ? edge.target : edge.source;
                                const other = nodes.find((n) => n.id === otherId);
                                return <div key={`${edge.source}-${edge.target}`} className="hp-incident">
                                    <button className="btn-demo hp-small" onClick={() => setSelectedId(otherId)}>{other?.label || otherId}</button>
                                    <div className="mono hp-muted" style={{ marginTop: 6 }}>Shared indicators: {(edge.sharedIdentifiers || []).map((item) => typeof item === "string" ? item : item.value || item.identifier || JSON.stringify(item)).join(", ") || "shared infrastructure detected"}</div>
                                </div>;
                            }) : <div className="mono hp-muted">No shared-identifier links are visible for this profile.</div>}
                        </> : <div className="mono hp-muted">Select a node to inspect its relationships.</div>}
                    </Panel>
                </div>
            )}

            <Panel title="INTERPRETATION_NOTE">
                <div className="mono hp-muted">A connection means the profiles share one or more observed identifiers. It is an investigative lead, not proof of common ownership or criminal attribution. Verify indicators against the underlying evidence before taking action.</div>
            </Panel>
        </>
    );
}
