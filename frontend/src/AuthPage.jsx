// frontend/src/components/AuthPage.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { RkLogo, GoogleLogo } from "./icons";

const inputStyle = { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid var(--border)", background:"#fafafa", fontSize:14, color:"var(--text)", outline:"none" };

function Field({ label, type="text", value, onChange, placeholder, onKeyDown }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ fontSize:13, fontWeight:500, color:"var(--text2)", display:"block", marginBottom:5 }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown}
        style={{ ...inputStyle, borderColor:focused?"var(--orange)":"var(--border)", boxShadow:focused?"0 0 0 3px rgba(201,100,66,0.12)":"none" }}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}/>
    </div>
  );
}

export default function AuthPage() {
  const { login, register, googleLogin, oauthError, setOauthError } = useAuth();
  const [mode, setMode]   = useState("login");
  const [form, setForm]   = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState("");
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  useEffect(()=>{if(oauthError){setError(oauthError);setOauthError(null);}},[oauthError]);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode==="login") { await login(form.email, form.password); }
      else { await register(form.name, form.email, form.password); setDone(form.name||form.email.split("@")[0]); }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ minHeight:"100vh", background:"var(--cream)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:12 }}>🎉</div>
        <RkLogo size={48}/>
        <h1 style={{ fontSize:26, fontWeight:800, marginTop:16, color:"var(--text)", letterSpacing:"-0.02em" }}>Welcome to rk.ai!</h1>
        <p style={{ fontSize:15, color:"var(--text2)", marginTop:8, marginBottom:28 }}>Hey <strong>{done}</strong>, you're all set!</p>
        <div style={{ background:"#fff", borderRadius:16, padding:"16px 20px", border:"1px solid var(--border)", marginBottom:20, textAlign:"left" }}>
          {[{icon:"✅",text:"Free account activated"},{icon:"🤖",text:"Groq & Gemini models ready"},{icon:"💬",text:"Free messages to start"},{icon:"⚡",text:"Upgrade anytime for more"}].map((item,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<3?"1px solid var(--border)":"none" }}>
              <span style={{fontSize:18}}>{item.icon}</span>
              <span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{item.text}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>setDone("")} style={{ width:"100%", padding:13, background:"var(--orange)", border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>Start chatting →</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"var(--cream)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <RkLogo size={56}/>
          <h1 style={{ fontSize:26, fontWeight:700, marginTop:18, letterSpacing:"-0.02em", color:"var(--text)" }}>{mode==="login"?"Welcome back":"Create your account"}</h1>
          <p style={{ color:"var(--text2)", fontSize:14, marginTop:6 }}>{mode==="login"?"Sign in to rk.ai":"Start free — no card required"}</p>
        </div>
        <div style={{ background:"#fff", borderRadius:18, padding:"28px 26px", border:"1px solid var(--border)", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
          <button onClick={googleLogin} style={{ width:"100%", padding:"11px 16px", marginBottom:20, background:"#fff", border:"1px solid var(--border)", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#999";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.boxShadow="none";}}>
            <GoogleLogo/> Continue with Google
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
            <div style={{ flex:1, height:1, background:"var(--border)" }}/><span style={{ fontSize:12, color:"var(--text3)" }}>or email</span><div style={{ flex:1, height:1, background:"var(--border)" }}/>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
            {mode==="register" && <Field label="Full name" value={form.name} onChange={set("name")} placeholder="Your name"/>}
            <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com"/>
            <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
          {error && <div style={{ fontSize:13, color:"#dc2626", marginBottom:14, padding:"10px 12px", background:"#fef2f2", borderRadius:8, border:"1px solid #fecaca" }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{ width:"100%", padding:12, background:"var(--orange)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:600, cursor:loading?"default":"pointer", opacity:loading?0.75:1 }}
            onMouseEnter={e=>{if(!loading)e.currentTarget.style.background="var(--orange2)";}} onMouseLeave={e=>e.currentTarget.style.background="var(--orange)"}>
            {loading?"Please wait...":mode==="login"?"Sign in":"Create account"}
          </button>
        </div>
        <p style={{ textAlign:"center", fontSize:13, color:"var(--text2)", marginTop:20 }}>
          {mode==="login"?"Don't have an account? ":"Already have an account? "}
          <button onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}} style={{ background:"none", border:"none", color:"var(--orange)", fontWeight:600, fontSize:13, cursor:"pointer" }}>
            {mode==="login"?"Sign up free":"Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
