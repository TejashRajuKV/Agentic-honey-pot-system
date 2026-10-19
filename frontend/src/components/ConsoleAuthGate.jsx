import { useEffect, useState } from "react";

const panelStyle = {
  minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px",
  background: "var(--background, #080d18)", color: "var(--foreground, #e8eef9)",
  fontFamily: "Inter, system-ui, sans-serif",
};
const cardStyle = {
  width: "min(100%, 420px)", boxSizing: "border-box", padding: "32px",
  border: "1px solid rgba(148, 163, 184, .25)", borderRadius: "20px",
  background: "var(--card, #101827)", boxShadow: "0 24px 80px rgba(0,0,0,.28)",
};
const inputStyle = {
  width: "100%", boxSizing: "border-box", marginTop: "8px", padding: "12px 14px",
  borderRadius: "10px", border: "1px solid #475569", background: "#0b1220",
  color: "#f8fafc", fontSize: "16px",
};
const buttonStyle = {
  width: "100%", marginTop: "18px", padding: "12px 14px", border: 0,
  borderRadius: "10px", background: "#2563eb", color: "white", fontWeight: 700,
  fontSize: "15px", cursor: "pointer",
};

export default function ConsoleAuthGate({ children }) {
  const [status, setStatus] = useState("checking");
  const [authEnabled, setAuthEnabled] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshSession() {
    setStatus("checking");
    try {
      const response = await fetch("/api/v1/auth/session", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (response.status === 503 && data.code === "CONSOLE_AUTH_NOT_CONFIGURED") {
        setError("Console authentication is not configured on this server. Set CONSOLE_PASSWORD and CONSOLE_SESSION_SECRET.");
        setStatus("setup-error");
        return;
      }
      if (!response.ok) throw new Error(data.message || "Could not verify session.");
      setAuthEnabled(Boolean(data.authEnabled));
      setStatus(data.authenticated ? "authenticated" : "login");
      setError("");
    } catch (err) {
      setError(err.message || "Unable to reach the authentication service.");
      setStatus("error");
    }
  }

  useEffect(() => { refreshSession(); }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Sign-in failed.");
      setPassword("");
      setAuthEnabled(Boolean(data.authEnabled));
      setStatus(data.authenticated ? "authenticated" : "login");
    } catch (err) {
      setError(err.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      setStatus("login");
      setPassword("");
    }
  }

  if (status === "checking") {
    return <main style={panelStyle} aria-live="polite"><p>Checking secure console session…</p></main>;
  }

  if (status === "authenticated") {
    return <>
      {authEnabled && <button type="button" onClick={logout} title="Sign out of the console" style={{
        position: "fixed", zIndex: 10000, right: 16, top: 16, padding: "8px 12px",
        borderRadius: 9, border: "1px solid #64748b", background: "#0f172a", color: "#f8fafc",
        cursor: "pointer",
      }}>Sign out</button>}
      {children}
    </>;
  }

  return (
    <main style={panelStyle}>
      <section style={cardStyle} aria-labelledby="console-login-title">
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#60a5fa", fontWeight: 800 }}>
          CYBERRAKSHAK
        </div>
        <h1 id="console-login-title" style={{ margin: "12px 0 8px", fontSize: 28 }}>Secure console sign in</h1>
        <p style={{ margin: "0 0 24px", lineHeight: 1.55, color: "#94a3b8" }}>
          Authenticate to access threat intelligence, incident data, reports and platform controls.
        </p>
        {status === "setup-error" ? (
          <p role="alert" style={{ color: "#fca5a5", lineHeight: 1.5 }}>{error}</p>
        ) : (
          <form onSubmit={login}>
            <label htmlFor="console-password" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Console password</label>
            <input id="console-password" type="password" autoComplete="current-password" required
              value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
            {error && <p role="alert" style={{ color: "#fca5a5", margin: "12px 0 0" }}>{error}</p>}
            <button type="submit" disabled={busy || !password} style={{ ...buttonStyle, opacity: busy ? .7 : 1 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
        {status === "error" && <button type="button" onClick={refreshSession} style={buttonStyle}>Retry connection</button>}
        <p style={{ margin: "22px 0 0", fontSize: 12, lineHeight: 1.5, color: "#64748b" }}>
          Session cookies are HTTP-only and expire after eight hours.
        </p>
      </section>
    </main>
  );
}
