// frontend/src/ModelSelector.jsx
// Claude-only model selector. No Auto option. Clean names only.
import { useState, useEffect, useRef } from "react";
import { useAuth } from "./context/AuthContext";

const TIER = { max:0, pro:1, starter:2 };
const TIER_STYLE = {
  max:     { bg:'#7c3aed', label:'Max',  desc:'Most powerful'        },
  pro:     { bg:'#c96442', label:'Pro',  desc:'Best balance'         },
  starter: { bg:'#0891b2', label:'Fast', desc:'Fast & affordable'    },
};

function useClaudeModels() {
  const [models, setModels] = useState([]);
  const [trials, setTrials] = useState({});
  const { user } = useAuth();
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token"); if (!token) return;
    Promise.all([
      fetch(`${API}/api/models`,        { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
      fetch(`${API}/api/models/trials`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
    ]).then(([data, trialData]) => {
      if (!Array.isArray(data) || data.length === 0) return;
      setTrials(trialData || {});
      const sorted = [...data].sort((a,b) => {
        const ta = TIER[a.requiredPlan] ?? 9;
        const tb = TIER[b.requiredPlan] ?? 9;
        if (ta !== tb) return ta - tb;
        // Within same tier: newest first by version number
        const verA = a.modelId.match(/(\d+)-(\d+)$/);
        const verB = b.modelId.match(/(\d+)-(\d+)$/);
        const numA = verA ? parseInt(verA[1])*100 + parseInt(verA[2]) : 0;
        const numB = verB ? parseInt(verB[1])*100 + parseInt(verB[2]) : 0;
        return numB - numA;
      });
      setModels(sorted);
    }).catch(() => {});
  }, [user]);

  return { models, trials };
}

export default function ModelSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { models, trials } = useClaudeModels();
  const { user } = useAuth();
  const isFree = !user?.plan || user?.plan === "free";

  // Default to first pro model (Sonnet)
  const current = models.find(m => m.modelId === value)
    || models.find(m => m.requiredPlan === 'pro')
    || models[0];

  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Auto-select first pro model on load
  useEffect(() => {
    if (models.length > 0 && onChange) {
      const first = models.find(m => m.requiredPlan === 'pro') || models[0];
      if (first && !value) onChange(first.modelId);
    }
  }, [models]);

  if (!current) return null;

  const ts = TIER_STYLE[current.requiredPlan] || TIER_STYLE.pro;

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 12px", borderRadius:8, cursor:"pointer", background:open?"rgba(0,0,0,0.08)":"rgba(0,0,0,0.04)", border:"1px solid var(--border)", fontSize:13, fontWeight:500, color:"var(--text)" }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:ts.bg, flexShrink:0 }}/>
        Claude {current.displayName}
        {current.isNew && <span style={{ fontSize:9, background:"#dcfce7", color:"#15803d", borderRadius:99, padding:"1px 5px", fontWeight:700 }}>NEW</span>}
        <svg style={{ transform:open?"rotate(180deg)":"rotate(0)", transition:"transform .2s", opacity:.5 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div ref={node => { if(node && ref.current) { const b=ref.current.getBoundingClientRect(); node.style.left=b.left+"px"; node.style.bottom=(window.innerHeight-b.top+8)+"px"; }}}
          style={{ position:"fixed", background:"#fff", border:"1px solid #e8e3dc", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,0.14)", zIndex:99999, width:290, overflow:"hidden" }}>

          <div style={{ padding:"12px 16px 8px", borderBottom:"1px solid #f0ebe4", background:"#faf8f5", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <svg width="16" height="16" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#0f0f1a"/><text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fontFamily="Georgia,serif" fontSize="22" fontWeight="700" fill="#c96442">C</text></svg>
              <span style={{ fontSize:12, fontWeight:700, color:"#1a1915" }}>Claude models</span>
            </div>
            <span style={{ fontSize:10, color:"#c96442", fontWeight:600 }}>Auto-synced daily</span>
          </div>

          <div style={{ maxHeight:340, overflowY:"auto" }}>
            {models.length === 0 && (
              <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"#999" }}>Loading...</div>
            )}
            {models.map(m => {
              const s        = TIER_STYLE[m.requiredPlan] || TIER_STYLE.pro;
              const isPaid   = !!m.requiredPlan;
              const trial    = isPaid && isFree ? (trials[m.modelId] || { remaining:3, exhausted:false }) : null;
              const isOut    = trial?.exhausted;
              const isSel    = value === m.modelId;

              return (
                <div key={m.modelId} onClick={() => { onChange(m.modelId); setOpen(false); }}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor:"pointer", background:isSel?"#fdf5f0":"#fff", borderLeft:isSel?`3px solid ${s.bg}`:"3px solid transparent", borderBottom:"1px solid #f5f0ea", transition:"background .1s" }}
                  onMouseEnter={e => { if(!isSel) e.currentTarget.style.background="#faf7f4"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSel ? "#fdf5f0" : "#fff"; }}>
                  <div style={{ width:5, height:38, borderRadius:3, background:isOut?"#e5e5e5":s.bg, flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:isOut?"#aaa":"#1a1915" }}>
                        Claude {m.displayName}
                      </span>
                      {m.isNew && <span style={{ fontSize:9, background:"#dcfce7", color:"#15803d", borderRadius:99, padding:"1px 5px", fontWeight:700 }}>NEW</span>}
                    </div>
                    <div style={{ fontSize:11, color:isOut?"#bbb":"#888" }}>
                      {isOut
                        ? `Trial used — upgrade to ${s.label}`
                        : trial && !isOut
                          ? `${trial.remaining} free trial msg${trial.remaining===1?"":"s"} left`
                          : s.desc}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4, background:isOut?"#e5e5e5":s.bg, color:isOut?"#999":"#fff" }}>
                      {isOut ? "UPGRADE" : s.label.toUpperCase()}
                    </span>
                    {isSel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={s.bg} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding:"8px 16px", borderTop:"1px solid #f0ebe4", background:"#faf8f5", fontSize:11, color:"#aaa", textAlign:"center" }}>
            New Claude models appear automatically
          </div>
        </div>
      )}
    </div>
  );
}
