import { getQualityMetrics } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Status, Bar, fmtDate } from "./shared";

const AXES = [
    ["naturalness", "NATURALNESS — sounds like a real person"],
    ["coherence", "COHERENCE — consistent with the conversation"],
    ["relevance", "RELEVANCE — answers what was said"],
    ["strategicValue", "STRATEGIC_VALUE — keeps the scammer talking / extracts intel"],
    ["overall", "OVERALL"],
];

export default function Quality({ openSession }) {
    const q = useLoad(getQualityMetrics, [], 15000);
    const d = q.data;

    return (
        <>
            <SectionLabel>AGENT_QUALITY — every honeypot reply is scored automatically after it is sent</SectionLabel>
            <Status loading={q.loading && !d} error={q.error} empty={d && !d.totalEvaluations} emptyText="NO_REPLIES_SCORED_YET — engage the honeypot first." />
            {d?.totalEvaluations > 0 && (
                <>
                    <Panel title={`AVERAGE_SCORES (${d.totalEvaluations} replies)`}>
                        {AXES.map(([k, label]) => (
                            <div key={k} style={{ marginBottom: 10 }}>
                                <Kv k={label} v={d.averageScores[k]} />
                                <Bar value={parseFloat(d.averageScores[k])} color={k === "overall" ? "var(--amber)" : "var(--cyan)"} />
                            </div>
                        ))}
                    </Panel>
                    <Panel title="RECENT_REPLIES">
                        <div className="hp-scroll">
                            {d.recentMetrics.map((m, i) => (
                                <div key={i} className="hp-row" onClick={() => openSession(m.sessionId)}>
                                    <div className="hp-row-main">
                                        <div className="mono">“{m.analysis?.agentMessage}”</div>
                                        <div className="mono hp-muted">
                                            reply to “{(m.analysis?.scammerMessage || "").slice(0, 60)}…” · {m.sessionId} · {fmtDate(m.timestamp)}
                                            {m.flags?.length ? ` · flags: ${m.flags.map((f) => f.type || f).join(", ")}` : ""}
                                        </div>
                                    </div>
                                    <div className="mono hp-risk">{m.scores.overall.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </>
            )}
        </>
    );
}
