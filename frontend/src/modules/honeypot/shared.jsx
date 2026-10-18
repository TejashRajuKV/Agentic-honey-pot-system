import { useCallback, useEffect, useRef, useState } from "react";

export const errMsg = (e) =>
    e?.response?.data?.message || e?.response?.data?.error || e?.message || "Request failed";

/** Loads data with loading/error state; `reload()` refetches. Optional polling. */
export function useLoad(fn, deps = [], pollMs = 0) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const fnRef = useRef(fn);
    fnRef.current = fn;

    const reload = useCallback(async () => {
        try {
            setError(null);
            setData(await fnRef.current());
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        reload();
        if (!pollMs) return undefined;
        const t = setInterval(reload, pollMs);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, error, loading, reload };
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-IN", { hour12: false }) : "—");
export const riskColor = (p) => (p >= 80 ? "var(--red)" : p >= 50 ? "var(--amber)" : "var(--green)");

export function SectionLabel({ children }) {
    return <div className="module-id-label mono hp-section-label">// {children}</div>;
}

export function Panel({ title, action, children, style }) {
    return (
        <div className="result-dossier hp-panel" style={style}>
            {(title || action) && (
                <div className="hp-panel-head">
                    {title && <div className="dossier-label mono">{title}</div>}
                    {action}
                </div>
            )}
            {children}
        </div>
    );
}

export function Kv({ k, v, color }) {
    return (
        <div className="dossier-line">
            <div className="dossier-label mono">{k}</div>
            <div className="dossier-value mono" style={color ? { color } : undefined}>{v ?? "—"}</div>
        </div>
    );
}

export function Stat({ label, value, color }) {
    return (
        <div className="result-dossier hp-stat">
            <div className="mono hp-stat-num" style={{ color: color || "var(--cyan)" }}>{value ?? "—"}</div>
            <div className="dossier-label mono">{label}</div>
        </div>
    );
}

export function Chips({ items, color }) {
    if (!items?.length) return <span className="mono hp-muted">none</span>;
    return (
        <div className="hp-chips">
            {items.map((t, i) => (
                <span key={`${t}-${i}`} className="hp-chip mono" style={color ? { borderColor: color, color } : undefined}>{t}</span>
            ))}
        </div>
    );
}

export function Status({ loading, error, empty, emptyText = "NO_DATA_YET" }) {
    if (loading) return <div className="mono hp-muted">LOADING…</div>;
    if (error) return <div className="error-box mono">!! {error}</div>;
    if (empty) return <div className="mono hp-muted">{emptyText}</div>;
    return null;
}

export function Bar({ value, max = 1, color = "var(--cyan)" }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className="hp-bar"><div className="hp-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    );
}
