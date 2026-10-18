import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// ── Import Google Fonts ──
const link = document.createElement("link");
link.href  = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap";
link.rel   = "stylesheet";
document.head.appendChild(link);

// ── Import global styles ──
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
