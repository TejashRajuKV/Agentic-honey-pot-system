// ─────────────────────────────────────────
// Guardian Alert Hook
// Sends email via EmailJS when risk >= 90%
// ─────────────────────────────────────────

const STORAGE_KEY = "cyberrakshak_guardian";

export function saveGuardian(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadGuardian() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function clearGuardian() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Sends a guardian alert email via EmailJS.
 * Requires EmailJS credentials set in .env:
 *   VITE_EMAILJS_SERVICE_ID
 *   VITE_EMAILJS_TEMPLATE_ID
 *   VITE_EMAILJS_PUBLIC_KEY
 *
 * If keys are missing, simulates the alert in UI only.
 */
export async function sendGuardianAlert({ guardian, module, riskScore, suspectMessage }) {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // Always return the alert payload for UI display
    const alertPayload = {
        guardian_name: guardian.name,
        to_email: guardian.email,
        module,
        risk_score: riskScore,
        suspect_message: suspectMessage?.slice(0, 300) || "(no message captured)",
        timestamp,
    };

    // Only try to send email if keys are configured
    if (serviceId && templateId && publicKey) {
        try {
            const res = await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    service_id: serviceId,
                    template_id: templateId,
                    user_id: publicKey,
                    template_params: alertPayload,
                }),
            });

            return { success: res.ok, payload: alertPayload, emailSent: res.ok };
        } catch {
            // Email failed but still show UI alert
            return { success: true, payload: alertPayload, emailSent: false };
        }
    }

    // Demo mode — UI alert only
    return { success: true, payload: alertPayload, emailSent: false, demoMode: true };
}
