import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { animatePageLoad }  from "../animations/loadingAnimation";
import ScamRadar        from "../modules/ScamRadar";
import BehaviorMonitor  from "../modules/BehaviorMonitor";
import FakeNewsChecker  from "../modules/FakeNewsChecker";
import LoanRiskScanner  from "../modules/LoanRiskScanner";
import PhishingDetector from "../modules/PhishingDetector";
import ThreatAnalyzer   from "../modules/ThreatAnalyzer";
import LiveEngagement   from "../modules/honeypot/LiveEngagement";
import Sessions         from "../modules/honeypot/Sessions";
import ThreatIntel      from "../modules/honeypot/ThreatIntel";
import Profiles         from "../modules/honeypot/Profiles";
import Archetypes       from "../modules/honeypot/Archetypes";
import Campaigns        from "../modules/honeypot/Campaigns";
import Protection       from "../modules/honeypot/Protection";
import Alerts           from "../modules/honeypot/Alerts";
import Overview         from "../modules/honeypot/Overview";
import Quality          from "../modules/honeypot/Quality";
import LanguageLab      from "../modules/honeypot/LanguageLab";
import Reports          from "../modules/honeypot/Reports";
import Integrations     from "../modules/honeypot/Integrations";
import Forensic3DScene  from "../components/Forensic3DScene";
import GuardianSetup    from "../components/GuardianSetup";
import SketchDefs       from "../components/SketchDefs";
import useSystemStatus from "../hooks/useSystemStatus";
import "../styles/dashboard.css";
import "../styles/modules.css";
import "../styles/honeypot.css";

/**
 * CyberRakshak is organised into eight modules. Each module has sub-views; every view renders
 * a component wired to a real backend endpoint. `ctx` carries cross-module navigation state.
 */
const MODULES = [
  { id: "detect", label: "THREAT DETECTION", subs: [
    { id: "scam",     label: "SCAM",             render: () => <ScamRadar /> },
    { id: "news",     label: "FAKE NEWS",        render: () => <FakeNewsChecker /> },
    { id: "behavior", label: "BEHAVIOR ANOMALY", render: () => <BehaviorMonitor /> },
    { id: "phishing", label: "PHISHING",         render: () => <PhishingDetector /> },
    { id: "loan",     label: "LOAN APPS",        render: () => <LoanRiskScanner /> },
    { id: "threat",   label: "MULTI-VECTOR",     render: () => <ThreatAnalyzer /> },
  ]},
  { id: "honeypot", label: "AUTONOMOUS HONEYPOT", subs: [
    { id: "live",  label: "LIVE ENGAGEMENT", render: (c) => <LiveEngagement seed={c.seed} onOpenSession={(id) => c.go("honeypot", "cases", { sessionId: id })} /> },
    { id: "cases", label: "CONVERSATIONS",   render: (c) => <Sessions selected={c.sessionId} onSelect={(id) => c.go("honeypot", "cases", { sessionId: id })} openProfile={(id) => c.go("scammers", "profiles", { profileId: id })} /> },
  ]},
  { id: "intel", label: "THREAT INTELLIGENCE", subs: [
    { id: "indicators", label: "HARVESTED INDICATORS", render: () => <ThreatIntel view="indicators" /> },
    { id: "database",   label: "IDENTIFIER DATABASE",  render: () => <ThreatIntel view="database" /> },
  ]},
  { id: "scammers", label: "SCAMMER INTELLIGENCE", subs: [
    { id: "profiles",   label: "PROFILES",                 render: (c) => <Profiles selected={c.profileId} onSelect={(id) => c.go("scammers", "profiles", { profileId: id })} /> },
    { id: "campaigns",  label: "CAMPAIGNS",                render: (c) => <Campaigns openSession={(id) => c.go("honeypot", "cases", { sessionId: id })} /> },
    { id: "archetypes", label: "ARCHETYPES & VULNERABILITY", render: () => <Archetypes /> },
  ]},
  { id: "protect", label: "PROTECTION", subs: [
    { id: "explain", label: "RISK FUSION", render: () => <Protection /> },
    { id: "alerts",  label: "ALERTS",           render: () => <Alerts /> },
  ]},
  { id: "analytics", label: "ANALYTICS", subs: [
    { id: "metrics",  label: "METRICS & TRENDS", render: (c) => <Overview openProfile={(id) => c.go("scammers", "profiles", { profileId: id })} /> },
    { id: "quality",  label: "QUALITY SCORES",   render: (c) => <Quality openSession={(id) => c.go("honeypot", "cases", { sessionId: id })} /> },
    { id: "language", label: "LANGUAGE",         render: () => <LanguageLab /> },
  ]},
  { id: "reports", label: "REPORTS", subs: [
    { id: "archive", label: "CASE REPORTS", render: (c) => <Reports openSession={(id) => c.go("honeypot", "cases", { sessionId: id })} /> },
  ]},
  { id: "integrations", label: "INTEGRATIONS", subs: [
    { id: "status", label: "STATUS", render: () => <Integrations /> },
  ]},
];

// Entry points used by the Home page cards, navbar and Scam Radar hand-off
const LEGACY_TABS = {
  scam: ["detect", "scam"], news: ["detect", "news"], behavior: ["detect", "behavior"],
  phishing: ["detect", "phishing"], loan: ["detect", "loan"], threat: ["detect", "threat"],
  honeypot: ["honeypot", "live"],
};

const resolveTarget = (state) => {
  if (state?.module) return [state.module, state.sub];
  if (state?.tab && LEGACY_TABS[state.tab]) return LEGACY_TABS[state.tab];
  return ["detect", "scam"];
};

export default function Dashboard() {
  const location = useLocation();
  const [nav, setNav] = useState(() => {
    const [module, sub] = resolveTarget(location.state);
    return { module, sub: sub || MODULES.find((m) => m.id === module).subs[0].id, params: { seed: location.state?.seedMessage } };
  });
  const [sessionLogs, setSessionLogs] = useState([]);
  const [caseId, setCaseId]       = useState("");
  const [uptime, setUptime]       = useState(0);
  const { status: sys, error: sysError } = useSystemStatus();

  const go = useCallback((module, sub, params = {}) => {
    const mod = MODULES.find((m) => m.id === module);
    if (!mod) return;
    setNav((prev) => ({
      module,
      sub: sub || mod.subs[0].id,
      params: { ...(prev.module === module ? prev.params : {}), ...params },
    }));
    setSessionLogs((prev) => [...prev.slice(-10), `[EXEC] OPEN: ${mod.label}${sub ? ` / ${sub.toUpperCase()}` : ""}`]);
  }, []);

  useEffect(() => {
    const newId = `CASE-${Math.floor(Math.random() * 100000).toString(16).toUpperCase()}`;
    setCaseId(newId);
    setSessionLogs([
      `[SYS] INITIALIZING FORENSIC ENVIRONMENT...`,
      `[SYS] CASE_ID: ${newId} LOADED`,
      `[NET] GATEWAY: SAME-ORIGIN /api/v1`,
      `[MSG] SELECT MODULE TO BEGIN ANALYSIS`,
    ]);
    animatePageLoad(".tab-btn");
  }, []);

  // In-app links (Home cards, navbar, Scam Radar hand-off) navigate to this route with new state
  useEffect(() => {
    if (!location.state) return;
    const [module, sub] = resolveTarget(location.state);
    go(module, sub, { seed: location.state.seedMessage });
  }, [location.state, go]);

  useEffect(() => {
    const tick = setInterval(() => setUptime(s => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const formatUptime = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const activeModule = MODULES.find((m) => m.id === nav.module);
  const activeSub = activeModule.subs.find((s) => s.id === nav.sub) || activeModule.subs[0];
  const ctx = { ...nav.params, go };

  const moduleStatus = !sys
    ? (sysError ? { text: "GATEWAY_UNREACHABLE", cls: "text-red" } : { text: "CHECKING…", cls: "" })
    : sys.operational
      ? { text: "ALL_SYSTEMS_OPERATIONAL", cls: "text-green" }
      : { text: `DEGRADED (${!sys.ml?.reachable ? "ML_ENGINE" : "DATABASE"})`, cls: "text-red" };

  return (
    <div className="workstation-root blueprint-overlay">
      <Forensic3DScene isBackground={true} />
      <SketchDefs />

      <div className="corner-decor top-left"></div>
      <div className="corner-decor top-right"></div>
      <div className="corner-decor bottom-left"></div>
      <div className="corner-decor bottom-right"></div>

      <div className="workstation-layout">
        <div className="workstation-sidebar">
          <div className="sidebar-header mono">
            <div className="case-title">CYBERRAKSHAK</div>
            <div className="case-id text-cyan">{caseId}</div>
          </div>

          <div className="tabs-column">
            {MODULES.map((mod, i) => (
              <button
                key={mod.id}
                className={`tab-item mono ${nav.module === mod.id ? "active" : ""}`}
                onClick={() => go(mod.id, mod.id === nav.module ? nav.sub : undefined)}
              >
                <span className="tab-indicator"></span>
                <span className="tab-label">{i + 1}. {mod.label}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="system-logs mono">
              {sessionLogs.map((log, i) => (
                <div key={i} className="log-entry">{log}</div>
              ))}
              <div className="log-entry cursor">_</div>
            </div>
            <GuardianSetup />
          </div>
        </div>

        <div className="workstation-main">
          <div className="main-header mono">
            <div className="header-meta">
              <span className="label">MODULE_STATUS:</span>
              <span className={`value ${moduleStatus.cls}`}>{moduleStatus.text}</span>
            </div>
            <div className="header-meta">
              <span className="label">SESSION_TIME:</span>
              <span className="value">{formatUptime(uptime)}</span>
            </div>
          </div>

          <div className="forensic-container">
            {activeModule.subs.length > 1 && (
              <div className="hp-tabs" style={{ padding: "0 4px" }}>
                {activeModule.subs.map((s) => (
                  <button key={s.id} className={`hp-tab mono ${activeSub.id === s.id ? "active" : ""}`} onClick={() => go(activeModule.id, s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div className="forensic-container-inner" key={`${activeModule.id}/${activeSub.id}`}>
              {activeSub.render(ctx)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
