// frontend/src/components/InputBar.jsx
import { useState, useEffect, useRef } from "react";
import { SendIcon, StopIcon, ClipIcon, CloseIcon } from "./icons";
import ModelSelector from "./ModelSelector";

function AttachMenu({ onFile, webSearch, onToggleWebSearch, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if(ref.current&&!ref.current.contains(e.target))onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const item = (icon, label, onClick, active) => (
    <button onClick={()=>{onClick();onClose();}} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"10px 14px", background:active?"var(--hover)":"none", border:"none", cursor:"pointer", borderRadius:8, color:"var(--text)", fontSize:14, textAlign:"left" }}
      onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background=active?"var(--hover)":"none"}>
      <span style={{color:"var(--text2)",flexShrink:0}}>{icon}</span>
      <span style={{flex:1}}>{label}</span>
      {active&&<span style={{color:"var(--orange)",fontWeight:600}}>✓</span>}
    </button>
  );

  return (
    <div ref={ref} style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, background:"#fff", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.14)", padding:6, minWidth:220, zIndex:999 }}>
      {item(<ClipIcon size={16}/>, "Add files or photos", onFile)}
      {item(
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>,
        "Web search", onToggleWebSearch, webSearch
      )}
    </div>
  );
}

export default function InputBar({ onSend, streaming, onStop, userPlan }) {
  const [text, setText]           = useState("");
  const [file, setFile]           = useState(null);
  const [model, setModel]         = useState("auto");
  const [menuOpen, setMenuOpen]   = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const taRef   = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    const t = text.trim(); if (!t || streaming) return;
    onSend(webSearch ? `[web search] ${t}` : t, file, model);
    setText(""); setFile(null);
  };

  const handlePaste = e => {
    const items = e.clipboardData?.items; if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const f = item.getAsFile(); if (!f) continue;
        const ext = item.type.split("/")[1]||"png";
        setFile(new File([f], `pasted-${Date.now()}.${ext}`, { type:item.type }));
        return;
      }
    }
  };

  return (
    <div style={{ padding:"0 16px 18px", flexShrink:0 }}>
      {file && (
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:8, background:"#fff", border:"1px solid var(--border)", borderRadius:10, padding:"8px 12px" }}>
          {(file.type||"").startsWith("image/")
            ? <img src={URL.createObjectURL(file)} alt="" style={{ width:36, height:36, objectFit:"cover", borderRadius:6, border:"1px solid var(--border)" }}/>
            : <div style={{ width:36, height:36, background:"#eee", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}><ClipIcon size={16}/></div>}
          <div style={{ flex:1, overflow:"hidden" }}>
            <p style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }}>{file.name}</p>
            <p style={{ fontSize:11, color:"var(--text3)" }}>{(file.size/1024).toFixed(0)} KB</p>
          </div>
          <button onClick={()=>setFile(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:4, borderRadius:5, display:"flex" }}><CloseIcon size={14}/></button>
        </div>
      )}
      {webSearch && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, padding:"4px 10px", background:"#e0f2fe", border:"1px solid #bae6fd", borderRadius:20, width:"fit-content" }}>
          <span style={{ fontSize:11, fontWeight:600, color:"#0284c7" }}>Web search on</span>
          <button onClick={()=>setWebSearch(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#0284c7", display:"flex", padding:0 }}><CloseIcon size={11}/></button>
        </div>
      )}
      <div style={{ background:"#fff", border:"1px solid #ccc5ba", borderRadius:16, boxShadow:"0 1px 8px rgba(0,0,0,0.06)", position:"relative" }}
        onFocusCapture={e=>{e.currentTarget.style.boxShadow="0 2px 14px rgba(0,0,0,0.10)";e.currentTarget.style.borderColor="#b8b0a5";}}
        onBlurCapture={e=>{e.currentTarget.style.boxShadow="0 1px 8px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor="#ccc5ba";}}>
        {menuOpen && <AttachMenu onFile={()=>fileRef.current?.click()} webSearch={webSearch} onToggleWebSearch={()=>setWebSearch(v=>!v)} onClose={()=>setMenuOpen(false)}/>}
        <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.csv,.doc,.docx" onChange={e=>{if(e.target.files[0])setFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
        <textarea ref={taRef} value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}}
          onPaste={handlePaste}
          placeholder="How can rk.ai help you today?" rows={1}
          style={{ width:"100%", background:"none", border:"none", outline:"none", padding:"14px 16px 0", color:"var(--text)", fontSize:15, lineHeight:1.65, resize:"none", maxHeight:200, overflowY:"auto", display:"block", fontFamily:"inherit" }}/>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px 10px" }}>
          <button onClick={()=>setMenuOpen(v=>!v)}
            style={{ width:30, height:30, borderRadius:"50%", background:menuOpen?"var(--active)":"var(--hover)", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text2)", fontSize:20, fontWeight:300, transition:"all .15s", transform:menuOpen?"rotate(45deg)":"rotate(0deg)" }}>+</button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {userPlan!=="free" && <ModelSelector value={model} onChange={setModel}/>}
            {streaming
              ? <button onClick={onStop} style={{ width:32, height:32, borderRadius:8, background:"var(--text)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><StopIcon size={12}/></button>
              : <button onClick={submit} disabled={!text.trim()} style={{ width:32, height:32, borderRadius:8, background:text.trim()?"var(--text)":"var(--hover)", border:"none", color:text.trim()?"#fff":"var(--text3)", cursor:text.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}>
                  <SendIcon size={15}/>
                </button>}
          </div>
        </div>
      </div>
      <p style={{ textAlign:"center", fontSize:11, color:"var(--text3)", marginTop:8 }}>rk.ai can make mistakes. Please double-check important responses.</p>
    </div>
  );
}
