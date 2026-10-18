import { useState } from "react";
import { analyzeMessage, assessRisk } from "../../api/honeypotApi";
import { SectionLabel, Panel, Kv, Chips, Bar, errMsg, riskColor } from "./shared";

const SAMPLES = [
    { message: "URGENT: Your SBI account will be blocked in 2 hours. Share OTP and pay ₹10 to verify@okaxis or call +91 9876543210", url: "http://sbi-kyc-update.xyz/login", app: "" },
    { message: "Sir I am from cyber police. Parcel in your name has drugs. Transfer Rs 50,000 now to avoid arrest.", url: "", app: "" },
    { message: "Instant loan approved, no documents needed. Install the app and grant access to contacts.", url: "", app: "cashnow" },
];

const VERDICT_COLOR = { HIGH_RISK: "var(--red)", SUSPICIOUS: "var(--amber)", LOW_RISK: "var(--amber)", LIKELY_SAFE: "var(--green)" };
const SIGNAL_LABEL = { message: "MESSAGE", url: "URL", app: "APP", behavior: "BEHAVIOUR", intel: "THREAT_INTEL", identity: "IMPERSONATION", history: "HISTORY", peak_signal_boost: "STRONGEST_SIGNAL_BOOST" };
const ACTION_TEXT = {
    HONEYPOT: "Engage the scammer with the honeypot agent to extract intelligence.",
    BLOCK_AND_REPORT: "Block the sender/resource and report it.",
    VERIFY_INDEPENDENTLY: "Do not act on it. Verify through the organisation's official app or number.",
    NONE: "No action needed.",
};

/**
 * Risk Fusion: message + URL + app (+ known identifiers) → ONE explainable score.
 * Every point of the score is attributed to a signal and to the evidence behind it.
 */
export default function Protection() {
    const [f, setF] = useState({ message: "", url: "", app: "", upi: "", phone: "" });
    const [risk, setRisk] = useState(null);
    const [advice, setAdvice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const list = (s) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    const hasInput = f.message.trim() || f.url.trim() || f.app.trim() || f.upi.trim() || f.phone.trim();

    const run = async (input = f) => {
        setBusy(true); setErr(null);
        try {
            const body = {
                message: input.message || undefined, url: input.url || undefined, app: input.app || undefined,
                upiIds: list(input.upi || ""), phoneNumbers: list(input.phone || ""),
            };
            const [r, a] = await Promise.all([
                assessRisk(body),
                input.message?.trim() ? analyzeMessage(input.message).catch(() => null) : Promise.resolve(null),
            ]);
            setRisk(r); setAdvice(a);
        } catch (e) { setErr(errMsg(e)); setRisk(null); setAdvice(null); } finally { setBusy(false); }
    };

    const useSample = (s) => { const next = { ...f, ...s, upi: "", phone: "" }; setF(next); run(next); };

    return (
        <>
            <SectionLabel>RISK_FUSION_ENGINE — every detector, one explainable score</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel title="INPUTS (any combination)">
                        <textarea className="forensic-input" rows={5} placeholder="SUSPICIOUS MESSAGE (SMS / WhatsApp / email)…" value={f.message} onChange={set("message")} />
                        <input className="forensic-input hp-input" placeholder="URL (optional — links inside the message are checked automatically)" value={f.url} onChange={set("url")} />
                        <input className="forensic-input hp-input" placeholder="App name (optional) e.g. CashNow" value={f.app} onChange={set("app")} />
                        <input className="forensic-input hp-input" placeholder="Known UPI IDs (optional, comma separated)" value={f.upi} onChange={set("upi")} />
                        <input className="forensic-input hp-input" placeholder="Known phone numbers (optional)" value={f.phone} onChange={set("phone")} />
                        <div className="demo-controls" style={{ marginTop: 8 }}>
                            {SAMPLES.map((s, i) => <button key={i} className="btn-demo hp-small" onClick={() => useSample(s)}>[ SAMPLE_0{i + 1} ]</button>)}
                        </div>
                        <button className="btn-forensic-scan" style={{ marginTop: 10, width: "100%" }} onClick={() => run()} disabled={busy || !hasInput}>{busy ? "FUSING_SIGNALS…" : "[ ASSESS_RISK ]"}</button>
                        {err && <div className="error-box mono">!! {err}</div>}
                    </Panel>

                    {risk && advice && (
                        <Panel title="WHAT_TO_DO">
                            {advice.safetyAdvice.length ? (
                                <ul className="hp-list mono">{advice.safetyAdvice.map((a, i) => <li key={i}>{a}</li>)}</ul>
                            ) : <div className="mono hp-muted">No specific safety steps needed for this message.</div>}
                            {advice.userClaimedLegitimate && (
                                <div className="mono" style={{ color: "var(--amber)", marginTop: 8 }}>
                                    ⚠ Legitimacy claim detected ("this is my real bank…"). Scammers rely on this — it lowers the score only slightly and never below the safety floor.
                                </div>
                            )}
                        </Panel>
                    )}
                    {risk && risk.extracted && (
                        <Panel title="EXTRACTED">
                            <div className="dossier-label mono">UPI_IDS</div><Chips items={risk.extracted.upiIds} color="var(--red)" />
                            <div className="dossier-label mono" style={{ marginTop: 8 }}>PHONES</div><Chips items={risk.extracted.phoneNumbers} color="var(--red)" />
                            <div className="dossier-label mono" style={{ marginTop: 8 }}>LINKS</div><Chips items={risk.extracted.urls} color="var(--amber)" />
                            <div className="dossier-label mono" style={{ marginTop: 8 }}>AMOUNTS</div><Chips items={risk.extracted.amounts.map((a) => `₹${a.toLocaleString("en-IN")}`)} color="var(--amber)" />
                        </Panel>
                    )}
                </div>

                <div>
                    {!risk ? <Panel><div className="mono hp-muted">The fused score, the confidence behind it, how much each signal contributed, and every piece of evidence appear here.</div></Panel> : (
                        <>
                            <Panel title="VERDICT">
                                <div className="mono" style={{ fontSize: 44, fontWeight: 900, color: riskColor(risk.riskScore), lineHeight: 1 }}>{risk.riskScore}<span style={{ fontSize: 16, opacity: 0.6 }}> / 100</span></div>
                                <div className="mono" style={{ fontSize: 18, color: VERDICT_COLOR[risk.verdict], marginBottom: 10 }}>{risk.verdict?.replace(/_/g, " ")}</div>
                                <Kv k="CONFIDENCE" v={`${Math.round(risk.confidence * 100)}% (uncertainty ${risk.uncertainty})`} />
                                <Kv k="SCAM_ARCHETYPE" v={risk.category} />
                                <Kv k="RECOMMENDED_ACTION" v={risk.recommendedAction?.replace(/_/g, " ")} />
                                <div className="mono hp-muted" style={{ marginTop: 6 }}>{ACTION_TEXT[risk.recommendedAction]}</div>
                                {risk.meta?.signalsMissing?.length > 0 && (
                                    <div className="mono hp-muted" style={{ marginTop: 6 }}>Not assessed (no input): {risk.meta.signalsMissing.join(", ")} — provide them for a tighter score.</div>
                                )}
                            </Panel>

                            <Panel title="WHY_THIS_SCORE (points contributed)">
                                {risk.breakdown.map((b) => (
                                    <div key={b.signal} style={{ marginBottom: 8 }}>
                                        <Kv k={`${SIGNAL_LABEL[b.signal] || b.signal}  (signal ${b.score}, weight ${b.weight})`} v={`+${b.points}`} />
                                        <Bar value={b.points} max={Math.max(...risk.breakdown.map((x) => x.points), 1)} color={b.signal === "peak_signal_boost" ? "var(--amber)" : "var(--cyan)"} />
                                    </div>
                                ))}
                                <div className="mono hp-muted">Weights are configuration ({risk.meta?.engine}), not learned values — treat the absolute number as a ranking aid, not a probability.</div>
                            </Panel>

                            <Panel title={`EVIDENCE (${risk.evidence.length})`}>
                                <div className="hp-scroll" style={{ maxHeight: 300 }}>
                                    {risk.evidence.map((e, i) => (
                                        <div key={i} className="hp-tl mono">
                                            <b style={{ color: "var(--amber)" }}>+{e.points}</b> <span className="hp-muted">[{e.type}]</span> {e.detail}
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
