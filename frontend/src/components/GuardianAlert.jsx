import "../styles/guardian.css";

export default function GuardianAlert({ alert, onDismiss }) {
  if (!alert) return null;

  return (
    <div className="guardian-alert-overlay" onClick={onDismiss}>
      <div className="guardian-alert-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ga-header">
          <div className="ga-icon-wrap">
            <span className="ga-icon">🛡</span>
            <div className="ga-pulse-ring"></div>
          </div>
          <div>
            <div className="ga-title mono">GUARDIAN_ALERT_TRIGGERED</div>
            <div className="ga-subtitle mono">Critical threat detected — guardian notified</div>
          </div>
        </div>

        {/* Body */}
        <div className="ga-body">
          <div className="ga-row">
            <span className="ga-label mono">GUARDIAN</span>
            <span className="ga-value mono">{alert.guardian_name}</span>
          </div>
          <div className="ga-row">
            <span className="ga-label mono">NOTIFIED VIA</span>
            <span className="ga-value mono">{alert.to_email}</span>
          </div>
          <div className="ga-row">
            <span className="ga-label mono">MODULE</span>
            <span className="ga-value mono">{alert.module}</span>
          </div>
          <div className="ga-row">
            <span className="ga-label mono">RISK SCORE</span>
            <span className="ga-value mono text-red">{alert.risk_score}% — CRITICAL</span>
          </div>
          <div className="ga-row">
            <span className="ga-label mono">TIMESTAMP</span>
            <span className="ga-value mono">{alert.timestamp}</span>
          </div>

          {alert.demoMode && (
            <div className="ga-demo-note mono">
              ⚡ DEMO MODE — Configure EmailJS keys to send real email alerts
            </div>
          )}
          {alert.emailSent && (
            <div className="ga-email-sent mono">
              ✓ EMAIL DELIVERED to {alert.to_email}
            </div>
          )}
        </div>

        {/* Footer */}
        <button className="ga-dismiss mono" onClick={onDismiss}>
          [ ACKNOWLEDGE_ALERT ]
        </button>
      </div>
    </div>
  );
}
