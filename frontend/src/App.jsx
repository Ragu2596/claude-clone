import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAuth } from "./context/AuthContext";
import { useChat } from "./hooks/useChat";
import PricingPage from "./PricingPage";

// ─── Mobile hook ──────────────────────────────────────────────
function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return v;
}

// ─── Icons ────────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PlusIcon      = ({size=16}) => <Icon size={size} d="M12 5v14M5 12h14"/>;
const SendIcon      = ({size=16}) => <Icon size={size} sw={2.5} d="M12 19V5M5 12l7-7 7 7"/>;
const StopIcon      = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
const TrashIcon     = ({size=13}) => <Icon size={size} d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/>;
const EditIcon      = ({size=15}) => <Icon size={size} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>;
const CopyIcon      = ({size=14}) => <Icon size={size} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M8 4a2 2 0 012-2h4a2 2 0 012 2v2H8V4zM16 12h5M16 16h5M16 8h5"/>;
const FolderIcon    = ({size=14}) => <Icon size={size} d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>;
const ChatIcon      = ({size=14}) => <Icon size={size} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>;
const ClipIcon      = ({size=16}) => <Icon size={size} d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>;
const ThumbUpIcon   = ({size=14}) => <Icon size={size} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>;
const ThumbDownIcon = ({size=14}) => <Icon size={size} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>;
const ChevronDown   = ({size=14}) => <Icon size={size} sw={2} d="M6 9l6 6 6-6"/>;
const RefreshIcon   = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>;
const CloseIcon     = ({size=13}) => <Icon size={size} sw={2.5} d="M18 6L6 18M6 6l12 12"/>;
const PreviewIcon   = ({size=14}) => <Icon size={size} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z"/>;
const MenuIcon      = ({size=22}) => <Icon size={size} sw={2} d="M3 6h18M3 12h18M3 18h18"/>;
const PencilIcon    = ({size=13}) => <Icon size={size} d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>;

// ─── Logo ─────────────────────────────────────────────────────
const RkLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect width="64" height="64" rx="16" fill="#0f0f1a"/>
    <defs>
      <linearGradient id="rkgrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a78bfa"/>
        <stop offset="100%" stopColor="#60a5fa"/>
      </linearGradient>
    </defs>
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle"
      fontFamily="Georgia, serif" fontSize="20" fontWeight="700"
      letterSpacing="-1" fill="url(#rkgrad)">rk.ai</text>
  </svg>
);

// ─── Google Logo ──────────────────────────────────────────────
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

// ─── CSS ──────────────────────────────────────────────────────
const CSS = `
  :root {
    --cream: #f5f0e8; --sidebar: #ede8e0; --border: #ddd7ce;
    --hover: rgba(0,0,0,0.05); --active: rgba(0,0,0,0.08);
    --text: #1a1a1a; --text2: #555; --text3: #999;
    --orange: #c96442; --orange2: #b55538;
    --user-bubble: #3d3d3d; --mono: 'JetBrains Mono','Fira Code',monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 99px; }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes dot     { 0%,80%,100% { transform:scale(0.6); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
  @keyframes blink   { 0%,100% { opacity:1; } 50% { opacity:0; } }
  @keyframes spin    { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .msg-actions { opacity: 0; transition: opacity .15s; }
  .msg-wrap:hover .msg-actions { opacity: 1; }
  .user-actions { opacity: 0; transition: opacity .15s; }
  .user-wrap:hover .user-actions { opacity: 1; }
`;
if (!document.getElementById("rk-css")) {
  const s = document.createElement("style"); s.id = "rk-css"; s.textContent = CSS; document.head.appendChild(s);
}

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "#fafafa",
  fontSize: 14, color: "var(--text)", outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

// ─── Format timestamp ─────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── AuthPage ─────────────────────────────────────────────────
function AuthPage() {
  const { login, register, googleLogin, oauthError, setOauthError } = useAuth();
  const [mode, setMode]     = useState("login");
  const [form, setForm]     = useState({ name: "", email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => { if (oauthError) { setError(oauthError); setOauthError(null); } }, [oauthError]);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <RkLogo size={56} />
          <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 18, letterSpacing: "-0.02em", color: "var(--text)" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ color: "var(--text2)", fontSize: 14, marginTop: 6 }}>
            {mode === "login" ? "Sign in to continue to rk.ai" : "Start for free — no credit card required"}
          </p>
        </div>
        <div style={{ background: "#fff", borderRadius: 18, padding: "28px 26px", border: "1px solid var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <button onClick={googleLogin} style={{ width: "100%", padding: "11px 16px", marginBottom: 20, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#999"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
            <GoogleLogo /> Continue with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text3)" }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {mode === "register" && <Field label="Full name" value={form.name} onChange={set("name")} placeholder="Your name" />}
            <Field label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {error && (
            <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 14, padding: "10px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>{error}</div>
          )}
          <button onClick={submit} disabled={loading} style={{ width: "100%", padding: "12px", background: "var(--orange)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.75 : 1, transition: "background .15s" }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--orange2)"; }}
            onMouseLeave={e => e.currentTarget.style.background = "var(--orange)"}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", marginTop: 20 }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {mode === "login" ? "Sign up free" : "Sign in"}
          </button>
        </p>
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 12 }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, onKeyDown }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown}
        style={{ ...inputStyle, borderColor: focused ? "var(--orange)" : "var(--border)", boxShadow: focused ? "0 0 0 3px rgba(201,100,66,0.12)" : "none" }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────
function Sidebar({ conversations, projects, activeId, activeProjectId, selectConv, newConv, deleteConv, setActiveProjectId, createProject, deleteProject, onUpgrade, isMobile, onClose }) {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu]       = useState(false);
  const [showNewProj, setShowNewProj] = useState(false);
  const [pForm, setPForm]             = useState({ name: "", prompt: "You are a helpful AI assistant." });
  const [hovConv, setHovConv]         = useState(null);
  const [hovProj, setHovProj]         = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doCreate = async () => {
    if (!pForm.name.trim()) return;
    await createProject(pForm.name, "", pForm.prompt);
    setShowNewProj(false);
    setPForm({ name: "", prompt: "You are a helpful AI assistant." });
  };

  const go = fn => { fn(); if (isMobile && onClose) onClose(); };

  const menuItems = [
    { icon: "⚙️", label: "Settings" },
    { icon: "🌐", label: "Language", arrow: true },
    { icon: "❓", label: "Get help" },
    null,
    { icon: "⬆️", label: "Upgrade plan", action: () => { onUpgrade(); if (isMobile && onClose) onClose(); } },
    { icon: "🎁", label: "Gift rk.ai" },
    null,
    { icon: "↪️", label: "Log out", action: logout, danger: true },
  ];

  return (
    <div style={{ width: 260, height: "100%", background: "var(--sidebar)", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
      <div style={{ padding: "14px 12px 8px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <RkLogo size={26} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>rk.ai</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <SideBtn onClick={() => go(newConv)} title="New chat"><EditIcon size={16} /></SideBtn>
            {isMobile && <SideBtn onClick={onClose} title="Close"><CloseIcon size={16} /></SideBtn>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px" }}>
        <SectionHeader label="Projects" action={() => setShowNewProj(!showNewProj)} />
        {showNewProj && (
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 6 }}>
            <input value={pForm.name} onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} placeholder="Project name"
              style={{ ...inputStyle, marginBottom: 7, fontSize: 13 }} />
            <textarea value={pForm.prompt} onChange={e => setPForm(p => ({ ...p, prompt: e.target.value }))} placeholder="System prompt..."
              rows={2} style={{ ...inputStyle, resize: "none", fontSize: 12, marginBottom: 8, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={doCreate} style={{ flex: 1, padding: 7, background: "var(--orange)", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Create</button>
              <button onClick={() => setShowNewProj(false)} style={{ flex: 1, padding: 7, background: "none", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text2)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {projects.map(p => (
          <SideItem key={p.id} icon={<FolderIcon />} label={p.name} isActive={activeProjectId === p.id}
            hovered={hovProj === p.id} onHover={setHovProj} id={p.id}
            onSelect={() => go(() => setActiveProjectId(p.id))} onDelete={() => deleteProject(p.id)} />
        ))}
        {projects.length === 0 && !showNewProj && (
          <button onClick={() => setShowNewProj(true)} style={{ width: "100%", padding: "7px 10px", background: "none", border: "1px dashed var(--border)", borderRadius: 8, color: "var(--text3)", fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; e.currentTarget.style.color = "var(--text2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text3)"; }}>
            <PlusIcon size={13} /> New project
          </button>
        )}

        <SectionHeader label="Recents" />
        {conversations.length === 0 && <p style={{ fontSize: 13, color: "var(--text3)", padding: "4px 10px" }}>No conversations yet</p>}
        {conversations.map(c => (
          <SideItem key={c.id} icon={<ChatIcon />} label={c.title} isActive={activeId === c.id}
            hovered={hovConv === c.id} onHover={setHovConv} id={c.id}
            onSelect={() => go(() => selectConv(c.id))} onDelete={() => deleteConv(c.id)} />
        ))}
      </div>

      <div ref={menuRef} style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "8px 10px", position: "relative" }}>
        {showMenu && (
          <div style={{ position: "absolute", bottom: 72, left: 8, right: 8, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 200 }}>
            <div style={{ padding: "14px 16px 10px" }}>
              <p style={{ fontSize: 12, color: "var(--text3)" }}>{user?.email}</p>
            </div>
            <div style={{ height: 1, background: "#f0f0f0", margin: "0 12px" }} />
            {menuItems.map((item, i) =>
              item === null ? (
                <div key={i} style={{ height: 1, background: "#f0f0f0", margin: "4px 12px" }} />
              ) : (
                <button key={item.label} onClick={item.action || (() => {})} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: item.danger ? "#dc2626" : "#1a1a1a", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f7f7f7"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <span style={{ width: 20, textAlign: "center" }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.arrow && <span style={{ color: "#bbb" }}>›</span>}
                </button>
              )
            )}
          </div>
        )}
        <button onClick={() => setShowMenu(!showMenu)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", borderRadius: 8, padding: "7px 8px", cursor: "pointer" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          <Avatar user={user} size={30} />
          <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</p>
            <p style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
          </div>
          <ChevronDown size={13} />
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 4px" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
      {action && (
        <button onClick={action} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", padding: 2, borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
          <PlusIcon size={13} />
        </button>
      )}
    </div>
  );
}

function SideBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "none", border: "none", padding: 6, borderRadius: 7, color: "var(--text2)", cursor: "pointer", display: "flex", transition: "background .12s" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--active)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      {children}
    </button>
  );
}

function SideItem({ icon, label, isActive, hovered, onHover, id, onSelect, onDelete }) {
  return (
    <div onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} onClick={onSelect}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 1, background: isActive ? "var(--active)" : hovered ? "var(--hover)" : "transparent", transition: "background .1s" }}>
      <span style={{ color: isActive ? "var(--text)" : "var(--text2)", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: isActive ? "var(--text)" : "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive ? 500 : 400 }}>{label}</span>
      {hovered && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", padding: 2, borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "#dc2626"; }}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

function Avatar({ user, size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: user?.avatar ? "transparent" : "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {user?.avatar
        ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.44, fontWeight: 700, color: "#fff" }}>{user?.name?.[0]?.toUpperCase()}</span>}
    </div>
  );
}

// ─── UsageBar ─────────────────────────────────────────────────
function UsageBar({ usage, onUpgrade }) {
  if (!usage) return null;
  const { count, limit, plan } = usage;
  const pct = Math.min((count / limit) * 100, 100);
  const isWarn = pct >= 80;
  const isFull = pct >= 100;
  const barColor = isFull ? "#dc2626" : isWarn ? "#f59e0b" : "var(--orange)";
  return (
    <div style={{ padding: "4px 16px 10px", maxWidth: 780, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>
          <span style={{ fontWeight: 600, color: barColor }}>{count}</span> / {limit === 9999 ? "∞" : limit} messages today
          <span style={{ marginLeft: 6, background: barColor + "22", color: barColor, borderRadius: 99, padding: "1px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{plan}</span>
        </span>
        {isWarn && plan === "free" && (
          <button onClick={onUpgrade} style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", background: "none", border: "1px solid var(--orange)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
            Upgrade ↑
          </button>
        )}
      </div>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: barColor, borderRadius: 99, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

// ─── Action Button ─────────────────────────────────────────────
function ActionBtn({ onClick, title, children, danger }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: "none", border: "1px solid transparent", borderRadius: 6, padding: "4px 7px", fontSize: 12, color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? "#fef2f2" : "var(--hover)"; e.currentTarget.style.borderColor = danger ? "#fecaca" : "var(--border)"; e.currentTarget.style.color = danger ? "#dc2626" : "var(--text2)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text3)"; }}>
      {children}
    </button>
  );
}

// ─── CopyBtn ──────────────────────────────────────────────────
function CopyBtn({ text, iconOnly = false }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  if (iconOnly) return (
    <ActionBtn onClick={copy} title={copied ? "Copied!" : "Copy"}>
      <CopyIcon size={13} />{copied ? "Copied!" : "Copy"}
    </ActionBtn>
  );
  return (
    <button onClick={copy}
      style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 5, padding: "3px 9px", fontSize: 11, color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.1)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}>
      <CopyIcon size={11}/>{copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Message ──────────────────────────────────────────────────
function Message({ msg, isLast, streaming, onArtifact, onRetry, onEdit }) {
  const isUser = msg.role === "user";
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(msg.content);

  // ── User message ──────────────────────────────────────────────
  if (isUser) return (
    <div className="user-wrap" style={{ display: "flex", justifyContent: "flex-end", padding: "6px 0", marginBottom: 6, animation: "fadeUp .25s ease forwards", position: "relative" }}>
      <div style={{ maxWidth: "85%" }}>
        {msg.fileUrl && (
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "flex-end" }}>
            {(msg.fileType || "").startsWith("image/")
              ? <img src={msg.fileUrl} alt="" style={{ maxWidth: 220, maxHeight: 180, borderRadius: 10, border: "1px solid var(--border)" }} />
              : <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 11px", fontSize: 12, color: "var(--text2)" }}>{msg.fileName}</div>}
          </div>
        )}
        {editing ? (
          <div style={{ background: "#fff", border: "1px solid var(--orange)", borderRadius: 14, padding: 10, minWidth: 240 }}>
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
              autoFocus
              style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 14, color: "var(--text)", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
              <button onClick={() => { setEditing(false); setEditText(msg.content); }} style={{ padding: "5px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, cursor: "pointer", color: "var(--text2)" }}>Cancel</button>
              <button onClick={() => { setEditing(false); if (editText.trim() && editText !== msg.content) onEdit?.(editText.trim()); }}
                style={{ padding: "5px 12px", background: "var(--orange)", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--user-bubble)", borderRadius: 18, borderBottomRightRadius: 4, padding: "11px 16px", color: "#fff", fontSize: 15, lineHeight: 1.65 }}>
            {msg.content}
          </div>
        )}
        {/* Timestamp + Edit button */}
        <div className="user-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          {!editing && onEdit && (
            <button onClick={() => setEditing(true)} title="Edit message"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", gap: 3, fontSize: 11, padding: "2px 4px", borderRadius: 5 }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--text2)"; e.currentTarget.style.background = "var(--hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "none"; }}>
              <PencilIcon size={12} /> Edit
            </button>
          )}
          {msg.createdAt && <span style={{ fontSize: 10.5, color: "var(--text3)" }}>{formatTime(msg.createdAt)}</span>}
        </div>
      </div>
    </div>
  );

  // ── Assistant message ─────────────────────────────────────────
  const isEmpty = !msg.content && streaming && isLast;

  return (
    <div className="msg-wrap" style={{ display: "flex", gap: 14, padding: "10px 0", animation: "fadeUp .25s ease forwards" }}>
      <div style={{ flexShrink: 0, marginTop: 3 }}><RkLogo size={26} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Model label */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 4, letterSpacing: "0.02em" }}>
          rk.ai
        </div>

        {isEmpty ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center", height: 28, paddingTop: 6 }}>
            {[0, 0.18, 0.36].map((d, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", animation: `dot 1.2s ease ${d}s infinite` }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text)" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const code  = String(children).replace(/\n$/, "");
                  if (!inline && match) return (
                    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", margin: "14px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#f3f3f3", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text2)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>{match[1]}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          {["html", "jsx", "tsx", "svg"].includes(match[1]) && (
                            <button onClick={() => onArtifact && onArtifact(code, match[1])} style={{ background: "var(--orange)", border: "none", borderRadius: 5, padding: "3px 10px", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                              <PreviewIcon size={11} /> Preview
                            </button>
                          )}
                          <CopyBtn text={code} />
                        </div>
                      </div>
                      <SyntaxHighlighter style={oneLight} language={match[1]} PreTag="div"
                        customStyle={{ margin: 0, padding: "14px 16px", fontSize: 13, fontFamily: "var(--mono)", background: "#fafafa", lineHeight: 1.55 }} {...props}>
                        {code}
                      </SyntaxHighlighter>
                    </div>
                  );
                  return <code style={{ background: "rgba(0,0,0,0.07)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)", fontSize: 13 }} {...props}>{children}</code>;
                },
                p:          ({ children }) => <p style={{ marginBottom: 10, lineHeight: 1.75 }}>{children}</p>,
                ul:         ({ children }) => <ul style={{ paddingLeft: 22, marginBottom: 10 }}>{children}</ul>,
                ol:         ({ children }) => <ol style={{ paddingLeft: 22, marginBottom: 10 }}>{children}</ol>,
                li:         ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                h1:         ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>{children}</h1>,
                h2:         ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 18, marginBottom: 7 }}>{children}</h2>,
                h3:         ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 14, marginBottom: 5 }}>{children}</h3>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid var(--orange)", paddingLeft: 14, color: "var(--text2)", margin: "12px 0", fontStyle: "italic" }}>{children}</blockquote>,
                a:          ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--orange)", textDecoration: "underline" }}>{children}</a>,
                table:      ({ children }) => <div style={{ overflowX: "auto", marginBottom: 10 }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>{children}</table></div>,
                th:         ({ children }) => <th style={{ background: "rgba(0,0,0,0.05)", padding: "7px 12px", border: "1px solid var(--border)", fontWeight: 600, textAlign: "left" }}>{children}</th>,
                td:         ({ children }) => <td style={{ padding: "6px 12px", border: "1px solid var(--border)" }}>{children}</td>,
                strong:     ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                hr:         () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0" }} />,
              }}>
                {msg.content}
              </ReactMarkdown>
            </div>

            {/* Streaming cursor */}
            {isLast && streaming && msg.content && (
              <span style={{ display: "inline-block", width: 2, height: 17, background: "var(--text)", marginLeft: 1, animation: "blink 1s ease infinite", verticalAlign: "middle" }} />
            )}

            {/* Action bar — shown on hover via CSS + timestamp */}
            {!streaming && msg.content && !msg.error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                {/* Left: action buttons */}
                <div className="msg-actions" style={{ display: "flex", gap: 2 }}>
                  <CopyBtn text={msg.content} iconOnly />
                  {onRetry && (
                    <ActionBtn onClick={onRetry} title="Retry">
                      <RefreshIcon size={13} /> Retry
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={() => {}} title="Good response"><ThumbUpIcon size={13} /></ActionBtn>
                  <ActionBtn onClick={() => {}} title="Bad response"><ThumbDownIcon size={13} /></ActionBtn>
                </div>
                {/* Right: timestamp */}
                {msg.createdAt && (
                  <span style={{ fontSize: 10.5, color: "var(--text3)", flexShrink: 0 }}>{formatTime(msg.createdAt)}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Model Selector ───────────────────────────────────────────
const MODELS = [
  { id: "auto",                      label: "Auto",               sub: "Best free model",        badge: "AUTO", color: "#6b7280", group: "auto"       },
  { id: "llama-3.3-70b-versatile",   label: "Llama 3.3 70B",     sub: "Free · Fast",            badge: "FREE", color: "#16a34a", group: "groq"       },
  { id: "mixtral-8x7b-32768",        label: "Mixtral 8x7B",      sub: "Free · Efficient",       badge: "FREE", color: "#16a34a", group: "groq"       },
  { id: "gemini-2.0-flash",          label: "Gemini 2.0 Flash",  sub: "Free · Google",          badge: "FREE", color: "#4285f4", group: "gemini"     },
  { id: "gemini-1.5-flash",          label: "Gemini 1.5 Flash",  sub: "Free · Google",          badge: "FREE", color: "#4285f4", group: "gemini"     },
  { id: "gemini-1.5-pro",            label: "Gemini 1.5 Pro",    sub: "Free · Google",          badge: "FREE", color: "#4285f4", group: "gemini"     },
  { id: "mistral-small",             label: "Mistral Small",     sub: "Free · Fast · Europe",   badge: "FREE", color: "#f97316", group: "mistral"    },
  { id: "mistral-large",             label: "Mistral Large",     sub: "Free · Smart · Europe",  badge: "FREE", color: "#f97316", group: "mistral"    },
  { id: "together-llama",            label: "Llama 4 Maverick",  sub: "Free · Together AI",     badge: "FREE", color: "#8b5cf6", group: "together"   },
  { id: "together-deepseek",         label: "DeepSeek V3",       sub: "Free · Together AI",     badge: "FREE", color: "#8b5cf6", group: "together"   },
  { id: "together-qwen",             label: "Qwen 2.5 72B",      sub: "Free · Together AI",     badge: "FREE", color: "#8b5cf6", group: "together"   },
  { id: "perplexity-online",         label: "Perplexity Online", sub: "Live web search",        badge: "WEB",  color: "#06b6d4", group: "perplexity" },
  { id: "gpt-4o-mini",               label: "GPT-4o Mini",       sub: "Fast · OpenAI",          badge: "GPT",  color: "#10a37f", group: "openai"     },
  { id: "gpt-4o",                    label: "GPT-4o",            sub: "Smart · OpenAI",         badge: "GPT",  color: "#10a37f", group: "openai"     },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku",      sub: "Fast · Anthropic",       badge: "PRO",  color: "#f59e0b", group: "anthropic"  },
  { id: "claude-sonnet-4-20250514",  label: "Claude Sonnet 4",   sub: "Best · Anthropic",       badge: "TOP",  color: "#8b5cf6", group: "anthropic"  },
];
const GROUP_LABELS = {
  auto: null, groq: "🆓 Free · Groq", gemini: "🆓 Free · Google Gemini",
  mistral: "🆓 Free · Mistral AI", together: "🆓 Free · Together AI",
  perplexity: "🌐 Web Search · Perplexity", openai: "💚 ChatGPT · OpenAI", anthropic: "🟠 Claude · Anthropic",
};
const GROUP_ORDER = ["auto", "groq", "gemini", "mistral", "together", "perplexity", "openai", "anthropic"];

function ModelSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = MODELS.find(m => m.id === value) || MODELS[0];

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const grouped = MODELS.reduce((acc, m) => {
    if (!acc[m.group]) acc[m.group] = [];
    acc[m.group].push(m);
    return acc;
  }, {});

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, cursor: "pointer", background: open ? "#e8e2da" : "var(--sidebar)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 500, color: "var(--text)", transition: "all .15s" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: current.color, flexShrink: 0 }} />
        {current.label}
        <svg style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ position: "fixed", background: "#fff", border: "1px solid #e0d9d0", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.16)", zIndex: 99999, width: 290, overflow: "hidden", maxHeight: 460, overflowY: "auto" }}
          ref={node => {
            if (node && ref.current) {
              const btn = ref.current.getBoundingClientRect();
              node.style.left   = btn.left + "px";
              node.style.bottom = (window.innerHeight - btn.top + 8) + "px";
            }
          }}>
          <div style={{ padding: "10px 16px 6px", fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #f0ebe4", background: "#fff", position: "sticky", top: 0 }}>
            Choose Model
          </div>
          {GROUP_ORDER.map(group => {
            const items = grouped[group]; if (!items) return null;
            return (
              <div key={group}>
                {GROUP_LABELS[group] && <div style={{ padding: "8px 16px 3px", fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.8, background: "#f9f7f5" }}>{GROUP_LABELS[group]}</div>}
                {items.map(m => (
                  <div key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", background: value === m.id ? "#f5efe6" : "#fff", borderLeft: value === m.id ? `3px solid ${m.color}` : "3px solid transparent", transition: "background .1s" }}
                    onMouseEnter={e => { if (value !== m.id) e.currentTarget.style.background = "#faf7f4"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = value === m.id ? "#f5efe6" : "#fff"; }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{m.sub}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: m.color, color: "#fff", flexShrink: 0 }}>{m.badge}</span>
                    {value === m.id && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ padding: "8px 16px", fontSize: 10, color: "#aaa", borderTop: "1px solid #f0ebe4", background: "#fafaf8", position: "sticky", bottom: 0 }}>
            🆓 Groq + Gemini are completely free
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InputBar ─────────────────────────────────────────────────
function InputBar({ onSend, streaming, onStop }) {
  const [text, setText]             = useState("");
  const [file, setFile]             = useState(null);
  const [selectedModel, setModel]   = useState("auto");
  const taRef   = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    const t = text.trim(); if (!t || streaming) return;
    onSend(t, file, selectedModel); setText(""); setFile(null);
  };

  return (
    <div style={{ padding: "0 16px 18px", flexShrink: 0 }}>
      {file && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
          {(file.type || "").startsWith("image/")
            ? <img src={URL.createObjectURL(file)} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
            : <div style={{ width: 36, height: 36, background: "var(--sidebar)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipIcon size={16} /></div>}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{file.name}</p>
            <p style={{ fontSize: 11, color: "var(--text3)" }}>{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button onClick={() => setFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 4, borderRadius: 5, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text3)"; }}>
            <CloseIcon size={14} />
          </button>
        </div>
      )}
      <div style={{ background: "#fff", border: "1px solid #ccc5ba", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", overflow: "hidden" }}
        onFocusCapture={e => { e.currentTarget.style.boxShadow = "0 2px 14px rgba(0,0,0,0.12)"; e.currentTarget.style.borderColor = "#a89e93"; }}
        onBlurCapture={e  => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#ccc5ba"; }}>
        <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="How can rk.ai help you today?" rows={1}
          style={{ width: "100%", background: "none", border: "none", outline: "none", padding: "14px 16px 0", color: "var(--text)", fontSize: 15, lineHeight: 1.65, resize: "none", maxHeight: 200, overflowY: "auto", display: "block", fontFamily: "inherit" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 10px" }}>
          <div style={{ display: "flex", gap: 2 }}>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
            <IBtn onClick={() => fileRef.current?.click()} title="Attach file" active={!!file}><ClipIcon size={16} /></IBtn>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModelSelector value={selectedModel} onChange={setModel} />
            {streaming ? (
              <button onClick={onStop} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--text)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = "#333"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--text)"}>
                <StopIcon size={12} />
              </button>
            ) : (
              <button onClick={submit} disabled={!text.trim()}
                style={{ width: 32, height: 32, borderRadius: 8, background: text.trim() ? "var(--text)" : "var(--hover)", border: "none", color: text.trim() ? "#fff" : "var(--text3)", cursor: text.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
                onMouseEnter={e => { if (text.trim()) e.currentTarget.style.background = "#333"; }}
                onMouseLeave={e => { if (text.trim()) e.currentTarget.style.background = "var(--text)"; }}>
                <SendIcon size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
      <p style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
        rk.ai can make mistakes. Please double-check important responses.
      </p>
    </div>
  );
}

function IBtn({ children, onClick, title, active }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "none", border: "none", borderRadius: 7, padding: 5, cursor: "pointer", color: active ? "var(--orange)" : "var(--text2)", display: "flex", alignItems: "center" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; if (!active) e.currentTarget.style.color = "var(--text)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = active ? "var(--orange)" : "var(--text2)"; }}>
      {children}
    </button>
  );
}

// ─── Welcome ──────────────────────────────────────────────────
function Welcome({ onSend, user, isMobile }) {
  const cards = [
    { t: "Help me write",     s: "an email, essay, or creative story" },
    { t: "Explain a concept", s: "simply and clearly"                 },
    { t: "Debug my code",     s: "find and fix errors"                },
    { t: "Brainstorm ideas",  s: "for a project or problem"           },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "32px 16px" : "40px 24px", overflow: "auto" }}>
      <RkLogo size={56} />
      <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 700, marginTop: 20, marginBottom: 8, letterSpacing: "-0.025em", color: "var(--text)", textAlign: "center" }}>
        {user ? `Good day, ${user.name.split(" ")[0]}.` : "Welcome to rk.ai"}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text2)", marginBottom: 40, textAlign: "center", maxWidth: 420, lineHeight: 1.65 }}>
        I can help with writing, analysis, coding, math, research, and much more.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, maxWidth: 540, width: "100%" }}>
        {cards.map(c => (
          <button key={c.t} onClick={() => onSend(c.t)}
            style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", cursor: "pointer", textAlign: "left", transition: "all .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#a89e93"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.09)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{c.t}</p>
            <p style={{ fontSize: 12.5, color: "var(--text2)" }}>{c.s}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Artifact Panel ───────────────────────────────────────────
function ArtifactPanel({ code, lang, onClose, isMobile }) {
  const [view, setView] = useState("preview");
  const [key,  setKey]  = useState(0);
  return (
    <div style={{ width: isMobile ? "100%" : 480, height: "100%", position: isMobile ? "fixed" : "relative", top: isMobile ? 0 : "auto", left: isMobile ? 0 : "auto", zIndex: isMobile ? 300 : "auto", borderLeft: "1px solid var(--border)", background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["preview", "code"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid var(--border)", background: view === v ? "var(--active)" : "none", fontSize: 12, fontWeight: view === v ? 600 : 400, color: "var(--text)", cursor: "pointer" }}>
              {v === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ArtBtn onClick={() => setKey(k => k + 1)} title="Refresh"><RefreshIcon size={13} /></ArtBtn>
          <ArtBtn onClick={() => navigator.clipboard.writeText(code)}><CopyIcon size={12} /><span style={{ fontSize: 12 }}>Copy</span></ArtBtn>
          <ArtBtn onClick={onClose}><CloseIcon size={13} /></ArtBtn>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {view === "preview"
          ? <iframe key={key} srcDoc={code} style={{ width: "100%", height: "100%", border: "none" }} sandbox="allow-scripts allow-same-origin" title="Preview" />
          : <SyntaxHighlighter style={oneLight} language={lang} PreTag="div" customStyle={{ margin: 0, padding: 16, height: "100%", fontSize: 13, fontFamily: "var(--mono)", overflow: "auto", background: "#fafafa" }}>{code}</SyntaxHighlighter>}
      </div>
    </div>
  );
}

function ArtBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{ padding: "5px 8px", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      {children}
    </button>
  );
}

// ─── Loading ──────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--cream)", gap: 20 }}>
      <RkLogo size={56} />
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 0.18, 0.36].map((d, i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", animation: `dot 1.2s ease ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const { user, loading } = useAuth();
  const [showPricing,  setShowPricing]  = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const isMobile = useIsMobile();

  const {
    conversations, activeId, messages, streaming,
    projects, activeProjectId,
    usage, upgradeRequired,
    selectConv, setActiveProjectId, newConv, deleteConv,
    sendMessage, stopStream, createProject, deleteProject,
  } = useChat();

  const [artifact, setArtifact] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (!isMobile) setSidebarOpen(false); }, [isMobile]);

  if (loading) return <LoadingScreen />;
  if (!user)   return <AuthPage />;

  const activeConv = conversations.find(c => c.id === activeId);

  // ── Retry: resend the last user message ───────────────────────
  const handleRetry = () => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (userMsgs.length === 0) return;
    const lastUser = userMsgs[userMsgs.length - 1];
    sendMessage(lastUser.content, null, "auto");
  };

  // ── Edit: resend with new text ─────────────────────────────────
  const handleEdit = (newText) => {
    sendMessage(newText, null, "auto");
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--cream)", position: "relative" }}>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 199 }} />
      )}

      {/* Sidebar */}
      <div style={{ position: isMobile ? "fixed" : "relative", left: isMobile ? (sidebarOpen ? 0 : -270) : 0, top: 0, bottom: 0, zIndex: isMobile ? 200 : "auto", transition: "left .25s cubic-bezier(.4,0,.2,1)", height: "100%", flexShrink: 0 }}>
        <Sidebar
          conversations={conversations} projects={projects}
          activeId={activeId} activeProjectId={activeProjectId}
          selectConv={selectConv} newConv={newConv} deleteConv={deleteConv}
          setActiveProjectId={setActiveProjectId} createProject={createProject} deleteProject={deleteProject}
          onUpgrade={() => setShowPricing(true)}
          isMobile={isMobile} onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "var(--cream)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", display: "flex", padding: 6, borderRadius: 8, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <MenuIcon size={22} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 180 : 480 }}>
                {activeConv?.title || "New conversation"}
              </h2>
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>
                {messages.length > 0 ? `${Math.ceil(messages.length / 2)} exchanges` : "Start a conversation below"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#fff", border: "1px solid var(--border)", borderRadius: 8, flexShrink: 0 }}>
            <Avatar user={user} size={22} />
            {!isMobile && <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{user.name}</span>}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {messages.length === 0
            ? <Welcome onSend={sendMessage} user={user} isMobile={isMobile} />
            : (
              <div style={{ maxWidth: 740, margin: "0 auto", padding: isMobile ? "8px 12px 16px" : "8px 24px 16px" }}>
                {messages.map((m, i) => (
                  <Message
                    key={m.id}
                    msg={m}
                    isLast={i === messages.length - 1}
                    streaming={streaming}
                    onArtifact={(code, lang) => setArtifact({ code, lang })}
                    onRetry={m.role === "assistant" ? handleRetry : undefined}
                    onEdit={m.role === "user" ? handleEdit : undefined}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
        </div>

        {/* Usage Bar */}
        <UsageBar usage={usage} onUpgrade={() => setShowPricing(true)} />

        {/* File upgrade warning */}
        {upgradeRequired && (
          <div style={{ maxWidth: 780, width: "100%", margin: "0 auto", padding: "0 16px 8px" }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#92400e" }}>📎 File uploads require <strong>Starter</strong> plan or above.</span>
              <button onClick={() => setShowPricing(true)} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#f59e0b", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>
                Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ maxWidth: 780, width: "100%", margin: "0 auto", alignSelf: "stretch" }}>
          <InputBar onSend={sendMessage} streaming={streaming} onStop={stopStream} />
        </div>
      </div>

      {/* Artifact panel */}
      {artifact && <ArtifactPanel code={artifact.code} lang={artifact.lang} onClose={() => setArtifact(null)} isMobile={isMobile} />}

      {/* Pricing modal */}
      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
    </div>
  );
}
