/* ══════════════════════════════════════════
   CyberRakshak — script.js
   All API calls + UI Logic
══════════════════════════════════════════ */

const API = "http://localhost:5050";

// ─── On page load ───
window.addEventListener("DOMContentLoaded", () => {
    checkServerHealth();
    loadLoanRules();
    setupUrlPreview();
});

// ══════════════════════════════════════════
// Tab Switching
// ══════════════════════════════════════════
function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    document.getElementById("tab-" + name).classList.add("active");
    document.getElementById("tab-" + name).setAttribute("aria-selected", "true");
    document.getElementById("panel-" + name).classList.add("active");
}

// ══════════════════════════════════════════
// Server Health Check
// ══════════════════════════════════════════
async function checkServerHealth() {
    const dot = document.querySelector(".status-dot");
    const text = document.querySelector(".status-text");
    try {
        const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        dot.className = "status-dot online";
        text.textContent = `Backend Online — ${Object.values(data.modules || {}).filter(Boolean).length} models loaded`;
    } catch {
        dot.className = "status-dot offline";
        text.textContent = "Backend Offline — Start python app.py";
    }
}

// ══════════════════════════════════════════
// Example Filler
// ══════════════════════════════════════════
function fillExample(module, text) {
    if (module === "phishing") {
        document.getElementById("input-phishing").value = text;
        updateUrlPreview(text);
    } else {
        document.getElementById("input-" + module).value = text;
    }
}

function setupUrlPreview() {
    const input = document.getElementById("input-phishing");
    input.addEventListener("input", () => updateUrlPreview(input.value));
}

function updateUrlPreview(url) {
    const preview = document.getElementById("url-preview");
    if (!url.trim()) { preview.textContent = ""; return; }
    try {
        const u = new URL(url.startsWith("http") ? url : "http://" + url);
        const tld = u.hostname.split(".").pop();
        const badTlds = ["tk", "ml", "ga", "cf", "xyz", "top", "ru", "click", "pw", "stream"];
        const isBad = badTlds.includes(tld);
        preview.innerHTML = `Domain: <strong style="color:${isBad ? '#ff4757' : '#00e676'}">${u.hostname}</strong> · Protocol: <strong style="color:${u.protocol === 'https:' ? '#00e676' : '#ff4757'}">${u.protocol}</strong>`;
    } catch {
        preview.innerHTML = `<span style="color:var(--text-muted)">Enter a full URL to preview</span>`;
    }
}

// ══════════════════════════════════════════
// Result Renderer
// ══════════════════════════════════════════
function getRiskClass(confidence) {
    if (confidence >= 70) return "high";
    if (confidence >= 40) return "medium";
    return "safe";
}
function getRiskEmoji(confidence) {
    if (confidence >= 70) return "🔴";
    if (confidence >= 40) return "🟡";
    return "🟢";
}

function renderResult(containerId, data) {
    const el = document.getElementById(containerId);
    el.classList.remove("hidden");

    if (data.error) {
        el.innerHTML = `
      <div class="result-error">
        ⚠️ ${data.error}: ${data.reason || data.message || "Unknown error"}
      </div>`;
        return;
    }

    const c = data.confidence || 0;
    const cls = getRiskClass(c);
    const emoji = getRiskEmoji(c);
    const label = data.label || "UNKNOWN";
    const mod = (data.module || "").replace("_", " ").toUpperCase();
    const tip = data.explanation?.tip || "";

    const flaggedHTML = (data.flagged_words?.length)
        ? `<div class="flagged-words">
        ${data.flagged_words.map(w => `<span class="flagged-tag">⚠ ${w}</span>`).join("")}
       </div>`
        : "";

    el.innerHTML = `
    <div class="result-header ${cls}">
      <div class="result-emoji">${emoji}</div>
      <div class="result-label-wrap">
        <div class="result-label ${cls}">${label}</div>
        <div class="result-module">${mod}</div>
      </div>
      <div class="confidence-wrap">
        <div class="confidence-pct ${cls}">${c}%</div>
        <div class="confidence-sub">Risk Score</div>
      </div>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-track">
        <div class="progress-fill ${cls}" style="width:0%" id="pbar-${containerId}"></div>
      </div>
    </div>
    <div class="result-body">
      <div class="result-reason">
        <strong>Reason:</strong> ${data.reason || "No reason provided."}
      </div>
      ${flaggedHTML}
      ${tip ? `<div class="result-tip"><span class="tip-icon">💡</span>${tip}</div>` : ""}
    </div>`;

    // Animate progress bar
    requestAnimationFrame(() => {
        const bar = document.getElementById(`pbar-${containerId}`);
        if (bar) setTimeout(() => { bar.style.width = c + "%"; }, 100);
    });
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner"></div> Analyzing...`;
    } else {
        btn.disabled = false;
        // Restore based on which button
        const map = {
            "btn-scam": "🔍 Analyze Message",
            "btn-phishing": "🔍 Check URL",
            "btn-fakenews": "🔍 Verify News",
            "btn-loan": "🔍 Check Loan App Risk"
        };
        btn.innerHTML = `<span class="btn-icon">🔍</span> ${map[btnId]?.split("🔍 ")[1] || "Analyze"}`;
    }
}

// ══════════════════════════════════════════
// SCAM MESSAGE DETECTOR
// ══════════════════════════════════════════
async function analyzeScam() {
    const msg = document.getElementById("input-scam").value.trim();
    if (!msg) { alert("Please enter a message to analyze."); return; }

    setLoading("btn-scam", true);
    document.getElementById("result-scam").classList.add("hidden");

    try {
        const res = await fetch(`${API}/api/scam`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        renderResult("result-scam", data);
    } catch (err) {
        renderResult("result-scam", { error: "Connection Failed", reason: "Cannot reach Flask server. Make sure python app.py is running on port 5050." });
    }
    setLoading("btn-scam", false);
}

// ══════════════════════════════════════════
// PHISHING URL DETECTOR
// ══════════════════════════════════════════
async function analyzePhishing() {
    const url = document.getElementById("input-phishing").value.trim();
    if (!url) { alert("Please enter a URL to check."); return; }

    setLoading("btn-phishing", true);
    document.getElementById("result-phishing").classList.add("hidden");

    try {
        const res = await fetch(`${API}/api/phishing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        });
        const data = await res.json();
        renderResult("result-phishing", data);
    } catch (err) {
        renderResult("result-phishing", { error: "Connection Failed", reason: "Cannot reach Flask server. Make sure python app.py is running on port 5050." });
    }
    setLoading("btn-phishing", false);
}

// ══════════════════════════════════════════
// FAKE NEWS DETECTOR
// ══════════════════════════════════════════
async function analyzeFakeNews() {
    const text = document.getElementById("input-fakenews").value.trim();
    if (!text) { alert("Please enter a news headline or message."); return; }

    setLoading("btn-fakenews", true);
    document.getElementById("result-fakenews").classList.add("hidden");

    try {
        const res = await fetch(`${API}/api/fakenews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });
        const data = await res.json();
        renderResult("result-fakenews", data);
    } catch (err) {
        renderResult("result-fakenews", { error: "Connection Failed", reason: "Cannot reach Flask server. Make sure python app.py is running on port 5050." });
    }
    setLoading("btn-fakenews", false);
}

// ══════════════════════════════════════════
// LOAN APP RISK CHECKER
// ══════════════════════════════════════════
async function loadLoanRules() {
    const container = document.getElementById("loan-checklist");
    try {
        const res = await fetch(`${API}/api/loan/rules`);
        const rules = await res.json();

        container.innerHTML = Object.entries(rules).map(([key, rule]) => `
      <label class="check-item" id="item-${key}" onclick="toggleCheck(this)">
        <input type="checkbox" class="check-cb" id="cb-${key}" data-key="${key}" />
        <span class="check-label">${rule.reason}</span>
        <span class="check-score">+${rule.score}</span>
      </label>`).join("");
    } catch {
        container.innerHTML = `
      <p class="loading-text">⚠️ Could not load checklist — server offline.<br/>Start <code>python app.py</code> and refresh.</p>
      ${buildFallbackChecklist()}`;
    }
}

function buildFallbackChecklist() {
    const fallback = {
        too_many_permissions: "App requests excessive permissions",
        no_rbi_registration: "No RBI registration found",
        instant_approval: "Claims instant approval, no documents",
        high_interest_rate: "Interest rate exceeds 36% APR",
        not_on_playstore: "App not on Google Play Store",
        requests_contacts: "Requests access to contacts",
        requests_sms: "Requests access to SMS messages",
        requests_location: "Requests continuous location",
        no_physical_address: "No physical office address",
        pressure_tactics: "Uses pressure / limited time tactics"
    };
    return Object.entries(fallback).map(([k, v]) => `
    <label class="check-item" id="item-${k}" onclick="toggleCheck(this)">
      <input type="checkbox" class="check-cb" id="cb-${k}" data-key="${k}" />
      <span class="check-label">${v}</span>
    </label>`).join("");
}

function toggleCheck(el) {
    el.classList.toggle("checked");
}

async function analyzeLoan() {
    const checkboxes = document.querySelectorAll(".check-cb");
    const appData = {};
    checkboxes.forEach(cb => {
        appData[cb.dataset.key] = cb.checked;
    });

    setLoading("btn-loan", true);
    document.getElementById("result-loan").classList.add("hidden");

    try {
        const res = await fetch(`${API}/api/loan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(appData)
        });
        const data = await res.json();
        renderResult("result-loan", data);
    } catch (err) {
        renderResult("result-loan", { error: "Connection Failed", reason: "Cannot reach Flask server. Make sure python app.py is running on port 5050." });
    }
    setLoading("btn-loan", false);
}

// ── Allow Enter key in inputs ──
document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (document.activeElement.id === "input-scam") analyzeScam();
    if (document.activeElement.id === "input-phishing") analyzePhishing();
    if (document.activeElement.id === "input-fakenews") analyzeFakeNews();
});
