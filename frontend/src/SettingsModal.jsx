// frontend/src/SettingsModal.jsx
// Fully working Settings — theme, font size, delete all conversations
// Separated from App.jsx for easy maintenance

import { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";

const API = import.meta.env.VITE_API_URL || "https://claude-clone.onrender.com";

// ── Apply theme to document ───────────────────────────────────
export function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);

  if (isDark) {
    root.style.setProperty("--cream",       "#1a1a1a");
    root.style.setProperty("--sidebar",     "#111111");
    root.style.setProperty("--border",      "#2a2a2a");
    root.style.setProperty("--hover",       "rgba(255,255,255,0.06)");
    root.style.setProperty("--active",      "rgba(255,255,255,0.10)");
    root.style.setProperty("--text",        "#e8e8e8");
    root.style.setProperty("--text2",       "#999");
    root.style.setProperty("--text3",       "#666");
    root.style.setProperty("--user-bubble", "#2a2a2a");
    root.setAttribute("data-theme", "dark");
  } else {
    root.style.setProperty("--cream",       "#f5f0e8");
    root.style.setProperty("--sidebar",     "#ede8e0");
    root.style.setProperty("--border",      "#ddd7ce");
    root.style.setProperty("--hover",       "rgba(0,0,0,0.05)");
    root.style.setProperty("--active",      "rgba(0,0,0,0.08)");
    root.style.setProperty("--text",        "#1a1a1a");
    root.style.setProperty("--text2",       "#555");
    root.style.setProperty("--text3",       "#999");
    root.style.setProperty("--user-bubble", "#3d3d3d");
    root.setAttribute("data-theme", "light");
  }
}

// ── Apply font size to document ───────────────────────────────
export function applyFontSize(size) {
  const map = { small: "13px", medium: "15px", large: "17px" };
  document.documentElement.style.setProperty("--chat-font-size", map[size] || "15px");
}

// ── Init on app load — call this once in main.jsx or App.jsx ──
export function initSettings() {
  const theme    = localStorage.getItem("rk-theme")    || "system";
  const fontSize = localStorage.getItem("rk-fontsize") || "medium";
  applyTheme(theme);
  applyFontSize(fontSize);

  // Watch system preference changes (for "system" mode)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (localStorage.getItem("rk-theme") === "system") applyTheme("system");
  });
}

// ── SettingsModal Component ───────────────────────────────────
export default function SettingsModal({ onClose, onUpgrade }) {
  const { user } = useAuth();
  const token = localStorage.getItem("token"); // stored by auth system
  const [theme,    setTheme]    = useState(localStorage.getItem("rk-theme")    || "system");
  const [fontSize, setFontSize] = useState(localStorage.getItem("rk-fontsize") || "medium");
  const [saved,    setSaved]    = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Live preview as user clicks — applies immediately before saving
  useEffect(() => { applyTheme(theme);    }, [theme]);
  useEffect(() => { applyFontSize(fontSize); }, [fontSize]);

  const save = () => {
    localStorage.setItem("rk-theme",    theme);
    localStorage.setItem("rk-fontsize", fontSize);
    applyTheme(theme);
    applyFontSize(fontSize);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  const deleteAll = async () => {
    if (!window.confirm("Delete ALL your conversations? This cannot be undone.\n\nNote: Shared AI knowledge cache is preserved for all users.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/conversations/all`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      console.log(`🗑️ Deleted ${data.deleted} conversations`);
      window.location.reload();
    } catch (e) {
      console.error("Delete all error:", e);
      alert("Failed to delete conversations: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Sub-components ──────────────────────────────────────────
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );

  const Row = ({ label, sub, children }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{label}</p>
        {sub && <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{sub}</p>}
      </div>
      {children}
    </div>
  );

  const ToggleGroup = ({ value, onChange, options }) => (
    <div style={{ display: "inline-flex", background: "var(--sidebar)", borderRadius: 8, padding: 2, border: "1px solid var(--border)" }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ padding: "5px 13px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: value === o.value ? "#fff" : "transparent",
            color:      value === o.value ? "var(--text)" : "var(--text3)",
            boxShadow:  value === o.value ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            transition: "all .15s" }}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const PLAN_COLORS = {
    free:    { bg: "#e5e7eb", color: "#374151" },
    starter: { bg: "#dbeafe", color: "#1e40af" },
    pro:     { bg: "#ede9fe", color: "#5b21b6" },
    max:     { bg: "#c96442", color: "#ffffff" },
  };
  const planStyle = PLAN_COLORS[user?.plan || "free"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--cream)", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "28px 28px 24px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>⚙️ Settings</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>✕</button>
          </div>

          {/* Account */}
          <Section title="Account">
            <Row label="Name" sub={user?.name}>
              {user?.googleId && <span style={{ fontSize: 12, color: "var(--text3)", background: "var(--hover)", padding: "3px 8px", borderRadius: 6 }}>via Google</span>}
            </Row>
            <Row label="Email" sub={user?.email} />
            <Row label="Plan">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, background: planStyle.bg, color: planStyle.color, borderRadius: 99, padding: "3px 12px", textTransform: "uppercase" }}>
                  {user?.plan || "free"}
                </span>
                {(user?.plan === "free" || user?.plan === "starter") && (
                  <button onClick={() => { onClose(); onUpgrade?.(); }}
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--orange)", background: "none", border: "1px solid var(--orange)", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                    Upgrade ↑
                  </button>
                )}
              </div>
            </Row>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <Row label="Theme" sub="Interface color scheme">
              <ToggleGroup value={theme} onChange={setTheme}
                options={[{ value: "light", label: "☀️ Light" }, { value: "dark", label: "🌙 Dark" }, { value: "system", label: "💻 System" }]} />
            </Row>
            <Row label="Font size" sub="Message text size">
              <ToggleGroup value={fontSize} onChange={setFontSize}
                options={[{ value: "small", label: "S" }, { value: "medium", label: "M" }, { value: "large", label: "L" }]} />
            </Row>
          </Section>

          {/* Danger Zone */}
          <Section title="Danger zone">
            <Row label="Delete all conversations" sub="This cannot be undone">
              <button onClick={deleteAll} disabled={deleting}
                style={{ padding: "6px 12px", background: "none", border: "1px solid #fca5a5", borderRadius: 7, color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting..." : "Delete all"}
              </button>
            </Row>
          </Section>

          {/* Save */}
          <button onClick={save}
            style={{ width: "100%", padding: 13, background: saved ? "#16a34a" : "var(--orange)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "background .2s" }}>
            {saved ? "✓ Saved!" : "Save changes"}
          </button>

        </div>
      </div>
    </div>
  );
}
