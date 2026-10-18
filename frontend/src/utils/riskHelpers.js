// ─────────────────────────────────────────
// Risk Color Mapping
// ─────────────────────────────────────────
export const getRiskColor = (color) => {
  const colors = {
    red:    "#FF2D55",
    yellow: "#FFD000",
    green:  "#00FF9D",
    grey:   "#4A7090",
  };
  return colors[color] || colors.grey;
};


// ─────────────────────────────────────────
// Risk Background Color (transparent)
// ─────────────────────────────────────────
export const getRiskBgColor = (color) => {
  const colors = {
    red:    "rgba(255, 45, 85, 0.15)",
    yellow: "rgba(255, 208, 0, 0.15)",
    green:  "rgba(0, 255, 157, 0.15)",
    grey:   "rgba(74, 112, 144, 0.15)",
  };
  return colors[color] || colors.grey;
};


// ─────────────────────────────────────────
// Risk Border Color
// ─────────────────────────────────────────
export const getRiskBorderColor = (color) => {
  const colors = {
    red:    "rgba(255, 45, 85, 0.4)",
    yellow: "rgba(255, 208, 0, 0.4)",
    green:  "rgba(0, 255, 157, 0.4)",
    grey:   "rgba(74, 112, 144, 0.4)",
  };
  return colors[color] || colors.grey;
};


// ─────────────────────────────────────────
// Risk Emoji
// ─────────────────────────────────────────
export const getRiskEmoji = (color) => {
  const emojis = {
    red:    "🔴",
    yellow: "🟡",
    green:  "🟢",
    grey:   "⚪",
  };
  return emojis[color] || "⚪";
};


// ─────────────────────────────────────────
// Risk Label
// ─────────────────────────────────────────
export const getRiskLabel = (label) => {
  const labels = {
    "HIGH RISK":   "HIGH RISK",
    "MEDIUM RISK": "MEDIUM RISK",
    "SAFE":        "SAFE",
    "ERROR":       "ERROR",
  };
  return labels[label] || "UNKNOWN";
};


// ─────────────────────────────────────────
// Confidence → Width % for progress bar
// ─────────────────────────────────────────
export const getConfidenceWidth = (confidence) => {
  return `${Math.min(100, Math.max(0, confidence))}%`;
};


// ─────────────────────────────────────────
// Module Display Names
// ─────────────────────────────────────────
export const getModuleName = (module) => {
  const names = {
    scam_radar:       "Scam Radar",
    behavior_monitor: "Behavior Monitor",
    fake_news:        "Fake News Checker",
    loan_scorer:      "Loan Risk Scanner",
  };
  return names[module] || module;
};


// ─────────────────────────────────────────
// Module Icons (emoji fallback)
// ─────────────────────────────────────────
export const getModuleIcon = (module) => {
  const icons = {
    scam_radar:       "🎯",
    behavior_monitor: "📊",
    fake_news:        "📰",
    loan_scorer:      "⚠️",
  };
  return icons[module] || "🔍";
};


// ─────────────────────────────────────────
// Format Confidence Display
// ─────────────────────────────────────────
export const formatConfidence = (confidence) => {
  return `${confidence}%`;
};


// ─────────────────────────────────────────
// Check if result is high risk
// ─────────────────────────────────────────
export const isHighRisk = (confidence) => confidence >= 70;
export const isMediumRisk = (confidence) => confidence >= 40 && confidence < 70;
export const isSafe = (confidence) => confidence < 40;