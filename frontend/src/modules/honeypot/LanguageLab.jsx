import { useState } from "react";
import { detectLanguage, analyzeHinglish, getScamPhrases, getLanguageStats } from "../../api/honeypotApi";
import { useLoad, SectionLabel, Panel, Kv, Chips, Status, Bar, errMsg } from "./shared";

const SAMPLES = [
    "aapka account block ho jayega, abhi OTP bhejo",
    "आपका खाता बंद हो जाएगा, तुरंत केवाईसी अपडेट करें",
    "Your KYC is expired. Click the link to update now.",
];

export default function LanguageLab() {
    const [text, setText] = useState("");
    const [lang, setLang] = useState(null);
    const [hin, setHin] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const phrases = useLoad(getScamPhrases, []);
    const stats = useLoad(() => getLanguageStats(30), [], 30000);

    const run = async (t = text) => {
        if (!t.trim()) return;
        setBusy(true); setErr(null);
        try {
            const [l, h] = await Promise.all([detectLanguage(t), analyzeHinglish(t)]);
            setLang(l); setHin(h);
        } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <>
            <SectionLabel>LANGUAGE_LAB — the multilingual layer the honeypot uses on Hindi / Hinglish scams</SectionLabel>
            <div className="hp-split">
                <div>
                    <Panel title="ANALYZE_MESSAGE">
                        <textarea className="forensic-input" rows={4} placeholder="PASTE ENGLISH / HINDI / HINGLISH TEXT…" value={text} onChange={(e) => setText(e.target.value)} />
                        <div className="demo-controls" style={{ marginTop: 8 }}>
                            {SAMPLES.map((s, i) => <button key={i} className="btn-demo hp-small" onClick={() => { setText(s); run(s); }}>[ SAMPLE_0{i + 1} ]</button>)}
                        </div>
                        <button className="btn-forensic-scan" style={{ marginTop: 10, width: "100%" }} onClick={() => run()} disabled={busy || !text.trim()}>{busy ? "ANALYZING…" : "[ DETECT_LANGUAGE ]"}</button>
                        {err && <div className="error-box mono">!! {err}</div>}
                    </Panel>
                    {lang && (
                        <Panel title="RESULT">
                            <Kv k="LANGUAGE" v={lang.language} />
                            <Kv k="CONFIDENCE" v={`${Math.round(lang.confidence * 100)}%`} />
                            <Kv k="SCRIPT" v={lang.script} />
                            <Kv k="HINGLISH" v={hin?.isHinglish ? "YES" : "NO"} />
                            {hin?.hinglishPhrases?.length > 0 && <><div className="dossier-label mono">HINGLISH_PHRASES</div><Chips items={hin.hinglishPhrases} /></>}
                            {hin?.scamIndicators?.length > 0 && (
                                <>
                                    <div className="dossier-label mono" style={{ marginTop: 8 }}>SCAM_INDICATORS</div>
                                    {hin.scamIndicators.map((s, i) => (
                                        <div key={i} className="mono hp-tl"><b style={{ color: s.severity === "critical" ? "var(--red)" : "var(--amber)" }}>{s.severity.toUpperCase()}</b> {s.type}: “{s.pattern}”</div>
                                    ))}
                                </>
                            )}
                        </Panel>
                    )}
                </div>
                <div>
                    <Panel title="LANGUAGE_MIX (last 30 days of honeypot sessions)">
                        {stats.data ? (
                            stats.data.total ? Object.entries(stats.data.percentages).map(([k, v]) => (
                                <div key={k} style={{ marginBottom: 8 }}><Kv k={k.toUpperCase()} v={`${v}% (${stats.data.counts[k]})`} /><Bar value={v} max={100} /></div>
                            )) : <div className="mono hp-muted">No language data aggregated yet.</div>
                        ) : <Status loading={stats.loading} error={stats.error} />}
                    </Panel>
                    <Panel title="KNOWN_SCAM_PHRASES">
                        <Status loading={phrases.loading} error={phrases.error} />
                        <Chips items={phrases.data} />
                    </Panel>
                </div>
            </div>
        </>
    );
}
