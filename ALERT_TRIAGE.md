# Explainable alert triage

CyberRakshak now includes a deterministic alert prioritization service. It ranks available alert records for analyst attention and returns an explanation containing every score contribution.

## Score inputs

- Severity: INFO, LOW, MEDIUM, HIGH, CRITICAL.
- Risk score: bounded to 0–100.
- Novelty: optional `new` or `rare` marker.
- Repeated activity: related session/observation count, when available.
- Corroboration: evidence-reference count, when available.
- Recency: timestamp of the alert.

Missing information contributes no points; the service does not invent missing evidence. The final score is bounded to 100 and mapped to P1–P4. Each result includes a suggested review timing, not an automated containment action.

## Safety properties

- Deterministic: no LLM is used to rank alerts.
- Explainable: `triage.factors` lists why points were awarded.
- Bounded: scores and count inputs are clamped; unknown severities become INFO.
- Human-led: all outputs include a caveat that the score is not proof of maliciousness or identity.
- No network calls or external side effects.

Run `npm run test:alert-triage` for focused verification.
