// frontend/src/components/ModelSelector.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const GROUP_LABELS = {
  auto:null,
  groq:{text:"Groq",sub:"Free · Fast",color:"#16a34a"},
  gemini:{text:"Google",sub:"Free · Vision",color:"#4285f4"},
  mistral:{text:"Mistral",sub:"Free",color:"#f97316"},
  together:{text:"Together",sub:"Free · Open",color:"#8b5cf6"},
  perplexity:{text:"Perplexity",sub:"Web search",color:"#06b6d4"},
  openai:{text:"OpenAI",sub:"GPT models",color:"#10a37f"},
  anthropic:{text:"Anthropic",sub:"Claude models",color:"#c96442"},
};
const GROUP_ORDER = ["auto","groq","gemini","mistral","together","perplexity","openai","anthropic"];

function useModels() {
  const [models, setModels] = useState([{id:"auto",label:"Auto",badge:"AUTO",color:"#6b7280",group:"auto",isFree:true}]);
  const [trials, setTrials] = useState({});
  const { user } = useAuth();
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token"); if (!token) return;
    Promise.all([
      fetch(`${API}/api/models`,        {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
      fetch(`${API}/api/models/trials`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
    ]).then(([data,trialData]) => {
      if (!Array.isArray(data)||data.length===0) return;
      setTrials(trialData||{});
      const auto={id:"auto",label:"Auto",badge:"AUTO",color:"#6b7280",group:"auto",isFree:true};
      setModels([auto,...data.map(m=>({id:m.modelId,label:m.displayName,badge:m.badge,color:m.color,group:m.group,isNew:m.isNew,requiredPlan:m.requiredPlan,isFree:!m.requiredPlan}))]);
    }).catch(()=>{});
  }, [user]);

  return { models, trials };
}

export default function ModelSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { models, trials } = useModels();
  const { user } = useAuth();
  const isFreeUser = !user?.plan || user?.plan==="free";
  const current = models.find(m=>m.id===value) || models[0];

  useEffect(() => {
    const h = e => { if(ref.current&&!ref.current.contains(e.target))setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const grouped = models.reduce((acc,m)=>{ if(!acc[m.group])acc[m.group]=[]; acc[m.group].push(m); return acc; },{});

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:8, cursor:"pointer", background:open?"#e8e2da":"#eee", border:"1px solid var(--border)", fontSize:12, fontWeight:500, color:"var(--text)" }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:current.color, flexShrink:0 }}/>
        {current.label}
        <svg style={{ transform:open?"rotate(180deg)":"rotate(0)", transition:"transform .2s" }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position:"fixed", background:"#fff", border:"1px solid #e0d9d0", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,0.16)", zIndex:99999, width:280, overflow:"hidden", maxHeight:440, overflowY:"auto" }}
          ref={node=>{if(node&&ref.current){const b=ref.current.getBoundingClientRect();node.style.left=b.left+"px";node.style.bottom=(window.innerHeight-b.top+8)+"px";}}}>
          <div style={{ padding:"10px 16px 6px", fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:1, borderBottom:"1px solid #f0ebe4", position:"sticky", top:0, background:"#fff" }}>Choose model</div>
          {GROUP_ORDER.map(group=>{
            const items=grouped[group]; if(!items) return null;
            const planColors={starter:"#3b82f6",pro:"#8b5cf6",max:"#f59e0b"};
            const planLabels={starter:"Starter+",pro:"Pro+",max:"Max"};
            return (
              <div key={group}>
                {GROUP_LABELS[group] && (
                  <div style={{ padding:"7px 16px 4px", background:"#f9f7f5", borderTop:"1px solid #f0ebe4" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:GROUP_LABELS[group].color, textTransform:"uppercase" }}>{GROUP_LABELS[group].text}</span>
                    <span style={{ fontSize:9, color:"#bbb", marginLeft:8 }}>{GROUP_LABELS[group].sub}</span>
                  </div>
                )}
                {items.map(m=>{
                  const isPaid=!!m.requiredPlan;
                  const trial=isPaid&&isFreeUser?(trials[m.id]||{used:0,remaining:3,exhausted:false}):null;
                  const isExhausted=trial?.exhausted;
                  return (
                    <div key={m.id} onClick={()=>{onChange(m.id);setOpen(false);}}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", cursor:"pointer", background:value===m.id?"#f5efe6":isExhausted?"#fafafa":"#fff", borderLeft:value===m.id?`3px solid ${m.color}`:"3px solid transparent", opacity:isExhausted?0.6:1 }}
                      onMouseEnter={e=>{if(value!==m.id)e.currentTarget.style.background="#faf7f4";}}
                      onMouseLeave={e=>{e.currentTarget.style.background=value===m.id?"#f5efe6":isExhausted?"#fafafa":"#fff";}}>
                      {isExhausted?<span>🔒</span>:isPaid&&isFreeUser?<span>🎁</span>:isPaid?<span>🔒</span>:<span style={{width:9,height:9,borderRadius:"50%",background:m.color,flexShrink:0}}/>}
                      <div style={{flex:1}}>
                        <div style={{ fontSize:13, fontWeight:600, color:isExhausted?"#aaa":"#1a1a1a", display:"flex", alignItems:"center", gap:4 }}>
                          {m.label}
                          {m.isNew&&<span style={{fontSize:9,background:"#dcfce7",color:"#16a34a",borderRadius:99,padding:"1px 5px",fontWeight:700}}>NEW</span>}
                        </div>
                        <div style={{fontSize:10,marginTop:2}}>
                          {!isPaid&&<span style={{color:"#16a34a",fontWeight:600}}>Free</span>}
                          {isPaid&&isFreeUser&&!isExhausted&&<span style={{color:"#f59e0b",fontWeight:600}}>{trial?.remaining} trial msgs left</span>}
                          {isPaid&&isFreeUser&&isExhausted&&<span style={{color:"#dc2626",fontWeight:600}}>Trial used — Upgrade</span>}
                          {isPaid&&!isFreeUser&&<span style={{color:planColors[m.requiredPlan],fontWeight:600}}>{planLabels[m.requiredPlan]}</span>}
                        </div>
                      </div>
                      <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:isExhausted?"#dc2626":planColors[m.requiredPlan]||m.color,color:"#fff"}}>{isExhausted?"UPGRADE":m.badge}</span>
                      {value===m.id&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{ padding:"8px 16px", fontSize:10, color:"#aaa", borderTop:"1px solid #f0ebe4", position:"sticky", bottom:0, background:"#fafaf8" }}>Groq + Gemini are free</div>
        </div>
      )}
    </div>
  );
}
