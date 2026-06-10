// frontend/src/ModelSelector.jsx (or components/ModelSelector.jsx)
// Claude-only model selector. New Claude models auto-appear from DB.

import { useState, useEffect, useRef } from "react";
import { useAuth } from "./context/AuthContext";

// Tier order for sorting display
const TIER_ORDER = { max: 0, pro: 1, starter: 2 };

function useClaudeModels() {
  const [models, setModels] = useState([]);
  const [trials, setTrials] = useState({});
  const { user } = useAuth();
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    Promise.all([
      fetch(`${API}/api/models`,        { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/api/models/trials`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([data, trialData]) => {
      if (!Array.isArray(data) || data.length === 0) return;
      setTrials(trialData || {});

      // Sort: opus → sonnet → haiku, newest first within tier
      const sorted = [...data].sort((a, b) => {
        const ta = TIER_ORDER[a.requiredPlan] ?? 9;
        const tb = TIER_ORDER[b.requiredPlan] ?? 9;
        return ta !== tb ? ta - tb : b.modelId.localeCompare(a.modelId);
      });
      setModels(sorted);
    }).catch(e => console.warn('[ModelSelector] fetch failed:', e.message));
  }, [user]);

  return { models, trials };
}

// Badge colors per tier
const TIER_STYLES = {
  max:     { bg: '#7c3aed', label: 'Max',     desc: 'Most powerful' },
  pro:     { bg: '#c96442', label: 'Pro',     desc: 'Best balance'  },
  starter: { bg: '#0891b2', label: 'Fast',    desc: 'Fast & affordable' },
};

export default function ModelSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { models, trials } = useClaudeModels();
  const { user } = useAuth();
  const isFreeUser = !user?.plan || user?.plan === "free";

  const current = models.find(m => m.modelId === value)
    || models[0]
    || { displayName: 'Claude', requiredPlan: 'pro' };

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const tierStyle = TIER_STYLES[current.requiredPlan] || TIER_STYLES.pro;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, cursor: "pointer", background: open ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 500, color: "var(--text)", transition: "all .15s" }}>
        {/* Claude orange dot */}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c96442", flexShrink: 0 }}/>
        Claude {current.displayName}
        {current.isNew && <span style={{ fontSize: 9, background: "#dcfce7", color: "#15803d", borderRadius: 99, padding: "1px 5px", fontWeight: 700 }}>NEW</span>}
        <svg style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", opacity: 0.5 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={node => {
            if (node && ref.current) {
              const b = ref.current.getBoundingClientRect();
              node.style.left   = b.left + "px";
              node.style.bottom = (window.innerHeight - b.top + 8) + "px";
            }
          }}
          style={{ position: "fixed", background: "#fff", border: "1px solid #e8e3dc", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 99999, width: 300, overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #f0ebe4", background: "#faf8f5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
                <rect width="64" height="64" rx="12" fill="#0f0f1a"/>
                <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fontFamily="Georgia,serif" fontSize="22" fontWeight="700" fill="#c96442">C</text>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1915" }}>Claude by Anthropic</span>
            </div>
          </div>

          {/* Model list */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {models.length === 0 && (
              <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "#999" }}>
                Loading models...
              </div>
            )}
            {models.map(m => {
              const ts          = TIER_STYLES[m.requiredPlan] || TIER_STYLES.pro;
              const isPaid      = !!m.requiredPlan;
              const trial       = isPaid && isFreeUser ? (trials[m.modelId] || { remaining: 3, exhausted: false }) : null;
              const isExhausted = trial?.exhausted;
              const isSelected  = value === m.modelId;

              // Plan access
              const planAllowed = !isFreeUser || !isPaid || (trial && !isExhausted);

              return (
                <div key={m.modelId}
                  onClick={() => { onChange(m.modelId); setOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: isSelected ? "#fdf5f0" : "#fff", borderLeft: isSelected ? "3px solid #c96442" : "3px solid transparent", borderBottom: "1px solid #f5f0ea", transition: "background .1s" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#faf7f4"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#fdf5f0" : "#fff"; }}>

                  {/* Left: tier indicator */}
                  <div style={{ width: 6, height: 36, borderRadius: 3, background: isExhausted ? "#e5e5e5" : ts.bg, flexShrink: 0 }}/>

                  {/* Center: name + description */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: isExhausted ? "#aaa" : "#1a1915" }}>
                        Claude {m.displayName}
                      </span>
                      {m.isNew && (
                        <span style={{ fontSize: 9, background: "#dcfce7", color: "#15803d", borderRadius: 99, padding: "1px 5px", fontWeight: 700 }}>NEW</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: isExhausted ? "#bbb" : "#888" }}>
                      {isExhausted
                        ? `Trial used — upgrade to ${ts.label}`
                        : isFreeUser && trial && !isExhausted
                          ? `${trial.remaining} free trial message${trial.remaining === 1 ? "" : "s"} left`
                          : ts.desc}
                    </div>
                  </div>

                  {/* Right: tier badge */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: isExhausted ? "#e5e5e5" : ts.bg, color: isExhausted ? "#999" : "#fff" }}>
                      {isExhausted ? "UPGRADE" : ts.label.toUpperCase()}
                    </span>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c96442" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "8px 16px", borderTop: "1px solid #f0ebe4", background: "#faf8f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#aaa" }}>Powered by Anthropic</span>
            <span style={{ fontSize: 10, color: "#c96442", fontWeight: 600 }}>Auto-synced daily</span>
          </div>
        </div>
      )}
    </div>
  );
}
