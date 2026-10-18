import { useEffect, useRef, useState } from "react";
import { engageAgent, getSession } from "../../api/honeypotApi";
import { Panel, Kv, Chips, SectionLabel, errMsg, riskColor } from "./shared";

const newSessionId = () => `web-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;

// Openers of increasing aggression: soft ones keep the agent talking (and extracting), hard ones make it disengage.
const SAMPLES = [
    "Hello sir, I am calling from your bank regarding a small issue with your account.",
    "Congratulations! You have been selected for a cashback reward. Can we verify a few details?",
    "URGENT: Your SBI account will be blocked in 2 hours. Verify KYC at http://sbi-kyc-update.xyz or pay Rs 10 to verify@okaxis",
];

/**
 * Chat with the honeypot agent exactly as a scammer would.
 * Every turn goes: browser → /api/v1/console/messages → detection + ML enrichment → persona agent →
 * intelligence extraction → MongoDB → back here, then intelligence is re-read from the stored session.
 */
export default function LiveEngagement({ seed, onOpenSession }) {
    const [sessionId, setSessionId] = useState(newSessionId);
    const [turns, setTurns] = useState([]);
    const [text, setText] = useState(seed || "");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [intel, setIntel] = useState(null);
    const endRef = useRef(null);

    useEffect(() => { if (seed) setText(seed); }, [seed]);
    useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [turns, sending]);

    const send = async (msg = text) => {
        const body = msg.trim();
        if (!body || sending) return;
        setSending(true); setError(null); setText("");
        setTurns((t) => [...t, { role: "scammer", text: body }]);
        try {
            const res = await engageAgent(sessionId, body);
            setTurns((t) => [...t, { role: "agent", text: res.reply }]);
            setAnalysis(res);
            const stored = await getSession(sessionId).catch(() => null);
            if (stored) setIntel(stored.intelligence);
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setSending(false);
        }
    };

    const reset = () => {
        setSessionId(newSessionId()); setTurns([]); setAnalysis(null); setIntel(null); setError(null);
    };

    const ml = analysis?.mlEnrichment;

    return (
        <>
            <SectionLabel>LIVE_ENGAGEMENT — you play the scammer, the honeypot agent answers as the victim persona</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel title={`SESSION ${sessionId}`} action={<button className="btn-demo hp-small" onClick={reset}>NEW_SESSION</button>}>
                        <div className="hp-chat">
                            {turns.length === 0 && (
                                <div className="mono hp-muted">Send a scam message below, or pick a sample. The agent stays in persona and the platform extracts UPI IDs, phone numbers and links as they appear.</div>
                            )}
                            {turns.map((t, i) => (
                                <div key={i} className={`hp-msg ${t.role}`}>
                                    <div className="hp-msg-who mono">{t.role === "scammer" ? "SCAMMER (you)" : "AGENT"}</div>
                                    <div className="hp-msg-body">{t.text}</div>
                                </div>
                            ))}
                            {sending && <div className="mono hp-muted">AGENT_TYPING…</div>}
                            <div ref={endRef} />
                        </div>
                        {error && <div className="error-box mono">!! {error}</div>}
                        <textarea
                            className="forensic-input"
                            rows={3}
                            placeholder="TYPE AS THE SCAMMER…"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
                        />
                        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                            <button className="btn-forensic-scan" style={{ flex: 1 }} onClick={() => send()} disabled={sending || !text.trim()}>
                                {sending ? "ENGAGING…" : "[ SEND_TO_AGENT ] (Ctrl+Enter)"}
                            </button>
                            <button className="btn-demo" onClick={() => onOpenSession?.(sessionId)} disabled={!turns.length}>OPEN_CASE</button>
                        </div>
                        <div className="demo-controls" style={{ marginTop: 12 }}>
                            {SAMPLES.map((s, i) => (
                                <button key={i} className="btn-demo hp-small" onClick={() => setText(s)}>[ SCRIPT_0{i + 1} ]</button>
                            ))}
                        </div>
                    </Panel>
                </div>

                <div>
                    <Panel title="DETECTION (latest turn)">
                        {!analysis ? <div className="mono hp-muted">Waiting for first turn…</div> : (
                            <>
                                <Kv k="SCAM_DETECTED" v={analysis.scamDetected ? "YES" : "NO"} color={analysis.scamDetected ? "var(--red)" : "var(--green)"} />
                                <Kv k="PROBABILITY" v={`${analysis.scamProbability}%`} color={riskColor(analysis.scamProbability)} />
                                <Kv k="PHASE" v={analysis.phase} />
                                <Kv k="ARCHETYPE" v={analysis.scamType} />
                                <Kv k="PRESSURE" v={analysis.pressureVelocity} />
                                <Kv k="VICTIM_VULNERABILITY" v={analysis.userVulnerability} />
                                {analysis.targetAsset && <Kv k="TARGET_ASSET" v={typeof analysis.targetAsset === "string" ? analysis.targetAsset : analysis.targetAsset.asset || analysis.targetAsset.type || JSON.stringify(analysis.targetAsset)} />}
                                {ml && (
                                    <>
                                        <Kv k="ML_ENGINE" v={`${ml.mlCategory ?? "—"} (${ml.mlConfidence != null ? Math.round(ml.mlConfidence) : "?"}%)`} />
                                        {ml.mlReason && <div className="mono hp-muted" style={{ margin: "4px 0" }}>{ml.mlReason}</div>}
                                    </>
                                )}
                                <div className="dossier-label mono" style={{ marginTop: 8 }}>REASONING</div>
                                <ul className="hp-list mono">{(analysis.reasoning || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
                                {analysis.safetyAdvice?.length > 0 && (
                                    <>
                                        <div className="dossier-label mono">SAFETY_ADVICE</div>
                                        <ul className="hp-list mono">{analysis.safetyAdvice.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                    </>
                                )}
                            </>
                        )}
                    </Panel>

                    <Panel title="EXTRACTED_INTELLIGENCE (from database)">
                        {!intel ? <div className="mono hp-muted">Nothing extracted yet.</div> : (
                            <>
                                <div className="dossier-label mono">UPI_IDS</div><Chips items={intel.upiIds} color="var(--red)" />
                                <div className="dossier-label mono" style={{ marginTop: 8 }}>PHONE_NUMBERS</div><Chips items={intel.phoneNumbers} color="var(--red)" />
                                <div className="dossier-label mono" style={{ marginTop: 8 }}>LINKS</div><Chips items={intel.urls} color="var(--amber)" />
                                <div className="dossier-label mono" style={{ marginTop: 8 }}>SCAM_PHRASES</div><Chips items={intel.scamPhrases} />
                                <div className="dossier-label mono" style={{ marginTop: 8 }}>BEHAVIOURS</div><Chips items={intel.behavioralPatterns} />
                            </>
                        )}
                    </Panel>
                </div>
            </div>
        </>
    );
}
