import { getKillChain } from "../../api/honeypotApi";
import { useLoad, Panel, Kv, Chips, Status, fmtDate } from "./shared";

const pretty = (s) => s.toLowerCase().replace(/_/g, " ");

/** Scam kill chain for one conversation: stage progress, tactic timeline, pressure curve, adaptation. */
export default function KillChainPanel({ id }) {
    const kc = useLoad(() => getKillChain(id).catch((e) => (e?.response?.status === 404 ? null : Promise.reject(e))), [id]);
    const d = kc.data;

    return (
        <Panel title="SCAM_KILL_CHAIN">
            <Status loading={kc.loading && !d} error={kc.error} empty={kc.data === null && !kc.loading} emptyText="No scammer messages to analyse." />
            {d && (
                <>
                    <div className="hp-chain">
                        {d.stages.map((s, i) => {
                            const reached = i < d.stagesReached;
                            const current = s.id === d.peakStage;
                            return (
                                <div key={s.id} className={`hp-stage ${reached ? "reached" : ""} ${current ? "current" : ""}`} title={s.description}>
                                    <div className="hp-stage-dot">{reached ? "●" : "○"}</div>
                                    <div className="hp-stage-label mono">{s.label}</div>
                                </div>
                            );
                        })}
                    </div>
                    <Kv k="FURTHEST_STAGE" v={`${pretty(d.peakStage)} (${d.stageProgress}% of chain)`} color={d.stageProgress >= 80 ? "var(--red)" : "var(--amber)"} />
                    <Kv k="PRESSURE_TREND" v={`${d.pressure.trend} (peak ${d.pressure.peak})`} />
                    <div className="mono hp-muted" style={{ margin: "4px 0" }}>Pressure per scammer message:</div>
                    <div className="hp-spark">
                        {d.pressure.curve.map((v, i) => (
                            <div key={i} className="hp-spark-bar" title={`message ${i + 1}: pressure ${v}`} style={{ height: `${8 + v * 10}px`, background: v >= 3 ? "var(--red)" : v >= 1 ? "var(--amber)" : "var(--border)" }} />
                        ))}
                    </div>
                    <Kv k="ESCALATIONS" v={d.adaptation.escalations} />
                    <Kv k="STORY_CHANGES" v={d.adaptation.tacticSwitches} />
                    <Kv k="ADAPTATION_SCORE" v={`${d.adaptation.score}/100`} />
                    <div className="mono hp-muted" style={{ marginBottom: 8 }}>{d.adaptation.note}</div>

                    <div className="dossier-label mono">TACTIC_TIMELINE</div>
                    {d.timeline.map((t) => (
                        <div key={t.turn} className="hp-tl mono">
                            <span className="hp-muted">#{t.turn} {fmtDate(t.timestamp)}</span> <b style={{ color: "var(--amber)" }}>{pretty(t.stage)}</b>
                            <Chips items={t.tactics.map(pretty)} />
                            <div className="hp-muted">“{t.text}”</div>
                        </div>
                    ))}
                </>
            )}
        </Panel>
    );
}
