import { useState, useEffect } from "react";
import { saveGuardian, loadGuardian, clearGuardian } from "../hooks/useGuardian";
import "../styles/guardian.css";

export default function GuardianSetup() {
  const [guardian, setGuardian] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const g = loadGuardian();
    if (g) setGuardian(g);
    else setEditing(true);
  }, []);

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    saveGuardian(form);
    setGuardian(form);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    clearGuardian();
    setGuardian(null);
    setForm({ name: "", email: "" });
    setEditing(true);
  };

  return (
    <div className="guardian-setup-wrap">
      <div className="guardian-section-label mono">
        <span className="g-icon">🛡</span> GUARDIAN_LINK
      </div>

      {guardian && !editing ? (
        <div className="guardian-active-card">
          <div className="g-status-dot online"></div>
          <div className="g-info">
            <div className="g-name mono">{guardian.name}</div>
            <div className="g-email mono">{guardian.email}</div>
          </div>
          <button className="g-edit-btn mono" onClick={() => { setForm(guardian); setEditing(true); }}>
            EDIT
          </button>
        </div>
      ) : (
        <div className="guardian-form">
          <input
            className="g-input mono"
            placeholder="GUARDIAN_NAME"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            className="g-input mono"
            placeholder="GUARDIAN_EMAIL"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <div className="g-btn-row">
            <button className="g-save-btn mono" onClick={handleSave}>
              {saved ? "✓ SAVED" : "ACTIVATE"}
            </button>
            {guardian && (
              <button className="g-cancel-btn mono" onClick={() => setEditing(false)}>
                CANCEL
              </button>
            )}
          </div>
        </div>
      )}

      <div className="g-hint mono">
        Alerts sent when risk &gt; 90%
      </div>
    </div>
  );
}
