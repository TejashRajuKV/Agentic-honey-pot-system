import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar        from "./components/Navbar";
import Home          from "./pages/Home";
import Dashboard     from "./pages/Dashboard";
import BootGreeting  from "./components/BootGreeting";
import CustomCursor  from "./components/CustomCursor";
import "./styles/global.css";

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
      document.body.classList.remove("light-theme");
    } else {
      document.body.classList.remove("dark-theme");
      document.body.classList.add("light-theme");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <BrowserRouter>
      <CustomCursor />

      {/* ── Multi-language boot greeting (once per session) ── */}
      {booting && <BootGreeting onFinish={() => setBooting(false)} />}

      {/* ── Navbar with theme toggle ── */}
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      {/* ── Routes ── */}
      <Routes>
        <Route path="/"          element={<Home theme={theme} booting={booting} />}      />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*"          element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
