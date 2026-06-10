// frontend/src/components/Sidebar.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { RkLogo, PlusIcon, EditIcon, CloseIcon, FolderIcon, TrashIcon, ChevronDown } from "./icons";
import SettingsModal, { initSettings } from "../SettingsModal";

const inputStyle = { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border)", background:"rgba(255,255,255,0.08)", fontSize:14, color:"var(--sidebar-text)", outline:"none" };

// ── Group conversations by date ───────────────────────────────
function groupConvsByDate(convs) {
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const week      = new Date(today - 6 * 86400000);
  const month     = new Date(today - 29 * 86400000);
  const groups    = { Today:[], Yesterday:[], "Previous 7 days":[], "Previous 30 days":[], Older:[] };
  for (const c of convs) {
    const d = new Date(c.updatedAt || c.createdAt);
    if      (d >= today)     groups.Today.push(c);
    else if (d >= yesterday) groups.Yesterday.push(c);
    else if (d >= week)      groups["Previous 7 days"].push(c);
    else if (d >= month)     groups["Previous 30 days"].push(c);
    else                     groups.Older.push(c);
  }
  return Object.entries(groups).filter(([,i])=>i.length>0).map(([label,items])=>({label,items}));
}

function Avatar({ user, size=30 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden", background:user?.avatar?"transparent":"var(--orange)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      {user?.avatar ? <img src={user.avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:size*0.44, fontWeight:700, color:"#fff" }}>{user?.name?.[0]?.toUpperCase()}</span>}
    </div>
  );
}

function SideBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="side-btn">{children}</button>
  );
}

function SectionHeader({ label, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px 3px" }}>
      <span style={{ fontSize:11, fontWeight:600, color:"var(--sidebar-text3)", letterSpacing:"0.07em", textTransform:"uppercase" }}>{label}</span>
      {action && <button onClick={action} className="side-btn" style={{padding:2}}><PlusIcon size={12}/></button>}
    </div>
  );
}

function ConvItem({ label, isActive, id, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className={`conv-item${isActive?" active":""}`}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onClick={onSelect}>
      <span className="conv-label">{label}</span>
      {hovered && (
        <button className="conv-del" onClick={e=>{e.stopPropagation();onDelete();}}
          style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.35)", display:"flex", padding:2, borderRadius:4, flexShrink:0 }}
          onMouseEnter={e=>{e.stopPropagation();e.currentTarget.style.color="#ef4444";}}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}>
          <TrashIcon size={12}/>
        </button>
      )}
    </div>
  );
}

// ── Language modal (inline, lightweight) ─────────────────────
function LanguageModal({ onClose }) {
  const LANGS = [
    {code:"en",flag:"🇬🇧",name:"English"},{code:"hi",flag:"🇮🇳",name:"Hindi"},
    {code:"ta",flag:"🇮🇳",name:"Tamil"},{code:"te",flag:"🇮🇳",name:"Telugu"},
    {code:"kn",flag:"🇮🇳",name:"Kannada"},{code:"mr",flag:"🇮🇳",name:"Marathi"},
    {code:"bn",flag:"🇮🇳",name:"Bengali"},{code:"es",flag:"🇪🇸",name:"Spanish"},
    {code:"fr",flag:"🇫🇷",name:"French"},{code:"de",flag:"🇩🇪",name:"German"},
    {code:"zh",flag:"🇨🇳",name:"Chinese"},{code:"ja",flag:"🇯🇵",name:"Japanese"},
    {code:"ar",flag:"🇸🇦",name:"Arabic"},
  ];
  const [sel, setSel] = useState(localStorage.getItem("rk-lang")||"en");
  const save = () => { localStorage.setItem("rk-lang",sel); onClose(); setTimeout(()=>window.location.reload(),200); };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:"#faf8f5", borderRadius:16, width:320, maxHeight:"80vh", overflow:"auto", padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:15 }}>Language</span>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#aaa" }}>✕</button>
        </div>
        {LANGS.map(l=>(
          <div key={l.code} onClick={()=>setSel(l.code)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, cursor:"pointer", background:sel===l.code?"#faf0ea":"transparent" }}
            onMouseEnter={e=>e.currentTarget.style.background=sel===l.code?"#faf0ea":"#f5f0e8"}
            onMouseLeave={e=>e.currentTarget.style.background=sel===l.code?"#faf0ea":"transparent"}>
            <span style={{fontSize:18}}>{l.flag}</span>
            <span style={{fontSize:13,fontWeight:sel===l.code?600:400}}>{l.name}</span>
            {sel===l.code&&<span style={{marginLeft:"auto",color:"var(--orange)"}}>✓</span>}
          </div>
        ))}
        <button onClick={save} style={{ width:"100%", marginTop:14, padding:10, background:"var(--orange)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer" }}>Apply</button>
      </div>
    </div>
  );
}

export default function Sidebar({ conversations, projects, activeId, activeProjectId, selectConv, newConv, deleteConv, setActiveProjectId, createProject, deleteProject, onUpgrade, isMobile, onClose }) {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu]       = useState(false);
  const [showNewProj, setShowNewProj] = useState(false);
  const [pForm, setPForm]             = useState({ name:"", prompt:"You are a helpful AI assistant." });
  const [activeModal, setActiveModal] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const h = e => { if(menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go  = fn => { fn(); if(isMobile && onClose) onClose(); };
  const mod = name => { setActiveModal(name); setShowMenu(false); };

  const doCreate = async () => {
    if (!pForm.name.trim()) return;
    const p = await createProject(pForm.name, "", pForm.prompt);
    setShowNewProj(false);
    setPForm({ name:"", prompt:"You are a helpful AI assistant." });
    if (p?.id) setActiveProjectId(p.id);
  };

  const menuItems = [
    { icon:"⚙️", label:"Settings",    action:()=>mod("settings") },
    { icon:"🌐", label:"Language",    action:()=>mod("language"), arrow:true },
    { icon:"❓", label:"Get help",    action:()=>mod("help")     },
    null,
    { icon:"⬆️", label:"Upgrade plan",action:()=>{ onUpgrade(); if(isMobile&&onClose)onClose(); } },
    { icon:"🎁", label:"Gift rk.ai",  action:()=>mod("gift")     },
    null,
    { icon:"↪️", label:"Log out",     action:logout, danger:true },
  ];

  return (
    <div style={{ width:260, height:"100%", background:"var(--sidebar)", display:"flex", flexDirection:"column", borderRight:"1px solid var(--sidebar-border)" }}>
      {/* Header */}
      <div style={{ padding:"12px 12px 8px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <RkLogo size={26}/>
            <span style={{ fontSize:15, fontWeight:700, color:"var(--sidebar-text)", letterSpacing:"-0.01em" }}>rk.ai</span>
          </div>
          <div style={{ display:"flex", gap:2 }}>
            <SideBtn onClick={()=>go(newConv)} title="New chat"><EditIcon size={16}/></SideBtn>
            {isMobile && <SideBtn onClick={onClose} title="Close"><CloseIcon size={16}/></SideBtn>}
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 6px" }}>

        {/* Projects */}
        <SectionHeader label="Projects" action={()=>setShowNewProj(!showNewProj)}/>
        {showNewProj && (
          <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid var(--sidebar-border)", borderRadius:10, padding:10, marginBottom:6 }}>
            <input value={pForm.name} onChange={e=>setPForm(p=>({...p,name:e.target.value}))} placeholder="Project name" style={{ ...inputStyle, marginBottom:7, fontSize:13 }}/>
            <textarea value={pForm.prompt} onChange={e=>setPForm(p=>({...p,prompt:e.target.value}))} placeholder="System prompt..." rows={2} style={{ ...inputStyle, resize:"none", fontSize:12, marginBottom:8, fontFamily:"inherit" }}/>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={doCreate} style={{ flex:1, padding:7, background:"var(--orange)", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>Create</button>
              <button onClick={()=>setShowNewProj(false)} style={{ flex:1, padding:7, background:"none", border:"1px solid var(--sidebar-border)", borderRadius:7, color:"var(--sidebar-text2)", fontSize:12, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {projects.map(p=>(
          <div key={p.id} className={`conv-item${activeProjectId===p.id?" active":""}`} onClick={()=>go(()=>setActiveProjectId(p.id))}>
            <span style={{ color:activeProjectId===p.id?"var(--sidebar-text)":"var(--sidebar-text3)", flexShrink:0, marginRight:4, display:"flex" }}><FolderIcon size={13}/></span>
            <span className="conv-label">{p.name}</span>
          </div>
        ))}
        {projects.length===0 && !showNewProj && (
          <button onClick={()=>setShowNewProj(true)} style={{ width:"100%", padding:"6px 10px", background:"none", border:"1px dashed rgba(255,255,255,0.15)", borderRadius:6, color:"var(--sidebar-text3)", fontSize:13, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:7, marginBottom:4 }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="var(--sidebar-text2)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--sidebar-text3)";}}>
            <PlusIcon size={12}/> New project
          </button>
        )}

        {/* Conversations with date grouping */}
        <SectionHeader label="Recents"/>
        {conversations.length===0 && <p style={{ fontSize:13, color:"var(--sidebar-text3)", padding:"4px 10px" }}>No conversations yet</p>}
        {groupConvsByDate(conversations.filter(c=>c.title!=="New Chat"||c.id===activeId)).map(({label,items})=>(
          <div key={label}>
            <div className="date-group">{label}</div>
            {items.map(c=>(
              <ConvItem key={c.id} label={c.title} isActive={activeId===c.id} id={c.id}
                onSelect={()=>go(()=>selectConv(c.id))} onDelete={()=>deleteConv(c.id)}/>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom user menu */}
      <div ref={menuRef} style={{ flexShrink:0, borderTop:"1px solid var(--sidebar-border)", padding:"8px", position:"relative" }}>
        {showMenu && (
          <div style={{ position:"absolute", bottom:68, left:6, right:6, background:"#fff", border:"1px solid #e5e5e5", borderRadius:16, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", zIndex:200 }}>
            <div style={{ padding:"12px 16px 8px" }}><p style={{ fontSize:12, color:"#999" }}>{user?.email}</p></div>
            <div style={{ height:1, background:"#f0f0f0", margin:"0 12px" }}/>
            {menuItems.map((item,i)=>
              item===null ? <div key={i} style={{ height:1, background:"#f0f0f0", margin:"4px 12px" }}/> : (
                <button key={item.label} onClick={item.action} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"11px 16px", background:"none", border:"none", cursor:"pointer", fontSize:14, color:item.danger?"#dc2626":"#1a1a1a", textAlign:"left" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#f7f7f7"}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <span style={{ width:20, textAlign:"center" }}>{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {item.arrow&&<span style={{color:"#bbb"}}>›</span>}
                </button>
              )
            )}
          </div>
        )}
        <button onClick={()=>setShowMenu(!showMenu)} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, background:"none", border:"none", borderRadius:8, padding:"6px", cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <Avatar user={user} size={28}/>
          <div style={{ flex:1, textAlign:"left", overflow:"hidden" }}>
            <p style={{ fontSize:13, fontWeight:500, color:"var(--sidebar-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.name}</p>
            <p style={{ fontSize:11, color:"var(--sidebar-text3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</p>
          </div>
          <ChevronDown size={12} style={{ color:"var(--sidebar-text3)", transform:showMenu?"rotate(180deg)":"rotate(0)", transition:"transform .2s" }}/>
        </button>
      </div>

      {activeModal==="settings" && <SettingsModal onClose={()=>setActiveModal(null)} onUpgrade={onUpgrade}/>}
      {activeModal==="language" && <LanguageModal onClose={()=>setActiveModal(null)}/>}
    </div>
  );
}
