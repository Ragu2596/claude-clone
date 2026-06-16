import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAuth } from "./context/AuthContext";
import { useChat } from "./hooks/useChat";
import PricingPage from "./PricingPage";
import AdminDashboard from "./AdminDashboard";
import SettingsModal, { initSettings } from "./SettingsModal";
import ArtifactPanel from "./components/ArtifactPanel";
import ProfilePage from "./components/ProfilePage";

function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return v;
}

// Icons
const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PlusIcon = ({size=16}) => <Icon size={size} d="M12 5v14M5 12h14"/>;
const SendIcon = ({size=16}) => <Icon size={size} sw={2.5} d="M12 19V5M5 12l7-7 7 7"/>;
const StopIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
const TrashIcon = ({size=13}) => <Icon size={size} d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/>;
const EditIcon = ({size=15}) => <Icon size={size} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>;
const CopyIcon = ({size=14}) => <Icon size={size} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M8 4a2 2 0 012-2h4a2 2 0 012 2v2H8V4zM16 12h5M16 16h5M16 8h5"/>;
const TrashIcon2 = ({size=13}) => <Icon size={size} d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/>;
const RefreshIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>;
const MenuIcon = ({size=22}) => <Icon size={size} sw={2} d="M3 6h18M3 12h18M3 18h18"/>;
const DownloadIcon = ({size=14}) => <Icon size={size} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>;
const OpenIcon = ({size=13}) => <Icon size={size} d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>;

const RkLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect width="64" height="64" rx="16" fill="#0f0f1a"/>
    <defs>
      <linearGradient id="rkgrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a78bfa"/>
        <stop offset="100%" stopColor="#60a5fa"/>
      </linearGradient>
    </defs>
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight="700" letterSpacing="-1" fill="url(#rkgrad)">rk.ai</text>
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const CSS = `
  :root {
    --cream: #f5f0e8; --sidebar: #ede8e0; --border: #ddd7ce;
    --text: #1a1a1a; --text2: #555; --text3: #999;
    --orange: #c96442; --orange2: #b55538;
    --user-bubble: #3d3d3d; --mono: 'JetBrains Mono','Fira Code',monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 99px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes dot { 0%,80%,100% { transform:scale(0.6); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
  .msg-actions { opacity: 0; transition: opacity .15s; }
  .msg-wrap:hover .msg-actions { opacity: 1; }
  .user-actions { opacity: 0; transition: opacity .15s; }
  .user-wrap:hover .user-actions { opacity: 1; }
`;

initSettings();
if (!document.getElementById("rk-css")) {
  const s = document.createElement("style"); s.id = "rk-css"; s.textContent = CSS; document.head.appendChild(s);
}

const FILE_EXT_MAP = {
  javascript:"js",js:"js",typescript:"ts",ts:"ts",jsx:"jsx",tsx:"tsx",
  python:"py",py:"py",java:"java",kotlin:"kt",swift:"swift",go:"go",
  rust:"rs",cpp:"cpp",c:"c",cs:"cs",php:"php",ruby:"rb",
  html:"html",css:"css",scss:"scss",xml:"xml",json:"json",
  yaml:"yaml",yml:"yml",toml:"toml",sql:"sql",graphql:"graphql",
  sh:"sh",bash:"sh",markdown:"md",md:"md",svg:"svg",csv:"csv",
};

function getFileExt(lang) {
  return FILE_EXT_MAP[lang?.toLowerCase()] || "txt";
}

function downloadFile(code, lang) {
  const ext = getFileExt(lang);
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `artifact.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function extractCodeBlocks(content) {
  if (!content) return [];
  const regex = /```(\w+)?\n?([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const lang = (match[1] || "text").toLowerCase();
    const code = match[2].trim();
    if (code.length > 0) blocks.push({ lang, code });
  }
  return blocks;
}

function extractBestArtifact(content) {
  const blocks = extractCodeBlocks(content);
  if (blocks.length === 0) return null;
  const FILE_LANGS = new Set(["html","xml","json","yaml","yml","svg","csv","sql","graphql","markdown","md","dockerfile"]);
  const fileBlock = blocks.find(b => FILE_LANGS.has(b.lang));
  const best = fileBlock || blocks.reduce((a,b) => b.code.length > a.code.length ? b : a);
  if (best.code.split("\n").length < 5) return null;
  return best;
}

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "#fafafa",
  fontSize: 14, color: "var(--text)", outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function AuthPage() {
  const { login, register, googleLogin, oauthError, setOauthError } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => { if (oauthError) { setError(oauthError); setOauthError(null); } }, [oauthError]);

  const [justRegistered, setJustRegistered] = useState(false);
  const [registeredName, setRegisteredName] = useState("");

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
        setRegisteredName(form.name || form.email.split("@")[0]);
        setJustRegistered(true);
        setLoading(false);
        return;
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (justRegistered) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <RkLogo size={48} />
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 16, color: "var(--text)", letterSpacing: "-0.02em" }}>Welcome to rk.ai!</h1>
          <p style={{ fontSize: 15, color: "var(--text2)", marginTop: 8, marginBottom: 28 }}>Hey <strong>{registeredName}</strong>, your account is ready 🚀</p>
          <button onClick={() => setJustRegistered(false)} style={{ width: "100%", padding: "13px", background: "var(--orange)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(201,100,66,0.35)" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.9"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>Start chatting →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <RkLogo size={56} />
          <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 18, letterSpacing: "-0.02em", color: "var(--text)" }}>{mode === "login" ? "Welcome back" : "Join rk.ai"}</h1>
          <p style={{ fontSize: 14, color: "var(--text2)", marginTop: 6 }}>{mode === "login" ? "Sign in to your account" : "Create your free account"}</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid var(--border)", marginBottom: 16 }}>
          {mode === "register" && (<input type="text" placeholder="Full name" value={form.name} onChange={set("name")} style={{ ...inputStyle, marginBottom: 12 }} onFocus={e => e.target.style.borderColor = "var(--orange)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />)}
          <input type="email" placeholder="Email" value={form.email} onChange={set("email")} style={{ ...inputStyle, marginBottom: 12 }} onFocus={e => e.target.style.borderColor = "var(--orange)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
          <input type="password" placeholder="Password" value={form.password} onChange={set("password")} style={{ ...inputStyle, marginBottom: 16 }} onFocus={e => e.target.style.borderColor = "var(--orange)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
          {error && (<div style={{ background: "#fee", border: "1px solid #fcc", color: "#c00", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>)}
          <button onClick={submit} disabled={loading} style={{ width: "100%", padding: "12px", background: loading ? "var(--text3)" : "var(--orange)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, transition: "all .2s" }} onMouseEnter={e => !loading && (e.currentTarget.style.background = "var(--orange2)")} onMouseLeave={e => !loading && (e.currentTarget.style.background = "var(--orange)")}>
            {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text3)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <button onClick={() => googleLogin()} style={{ width: "100%", padding: "11px", background: "#fff", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 500, color: "var(--text)", transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar)"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
            <GoogleLogo /> Continue with Google
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 14, color: "var(--text2)" }}>
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ background: "none", border: "none", color: "var(--orange)", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ msg, isLast, streaming, onArtifact, activeArtifactCode, onRetry, onEdit }) {
  const isUser = msg.role === "user";
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  if (isUser) return (
    <div className="user-wrap" style={{ display: "flex", justifyContent: "flex-end", padding: "6px 0", marginBottom: 6, animation: "fadeUp .25s ease forwards" }}>
      <div style={{ maxWidth: "85%" }}>
        <div style={{ background: "var(--user-bubble)", borderRadius: 18, borderBottomRightRadius: 4, padding: "11px 16px", color: "#fff", fontSize: 15, lineHeight: 1.65 }}>
          {editing ? (
            <div>
              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", outline: "none", color: "#fff", padding: 8, borderRadius: 6 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                <button onClick={() => { setEditing(false); setEditText(msg.content); }} style={{ padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                <button onClick={() => { setEditing(false); if (editText.trim() && editText !== msg.content) onEdit?.(editText.trim()); }} style={{ padding: "4px 10px", fontSize: 11, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}>Send</button>
              </div>
            </div>
          ) : (
            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</span>
          )}
        </div>
        <div className="user-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          {!editing && onEdit && (
            <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 11, padding: "2px 4px" }} onMouseEnter={e => { e.currentTarget.style.color = "var(--text2)"; e.currentTarget.style.background = "var(--border)"; borderRadius: "5px"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "none"; }}>
              <EditIcon size={12} />
            </button>
          )}
          {msg.createdAt && <span style={{ fontSize: 10.5, color: "var(--text3)" }}>{formatTime(msg.createdAt)}</span>}
        </div>
      </div>
    </div>
  );

  const isEmpty = !msg.content && streaming && isLast;

  return (
    <div className="msg-wrap" style={{ display: "flex", gap: 14, padding: "10px 0", animation: "fadeUp .25s ease forwards" }}>
      <div style={{ flexShrink: 0, marginTop: 3 }}><RkLogo size={26} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 4, letterSpacing: "0.02em" }}>rk.ai</div>
        {isEmpty ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center", height: 28, paddingTop: 6 }}>
            {[0, 0.18, 0.36].map((d, i) => (<div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", animation: `dot 1.2s ease ${d}s infinite` }} />))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text)" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const code = String(children).replace(/\n$/, "");
                  if (!inline && match) {
                    const blockLang = (match[1] || "text").toLowerCase();
                    const ext = getFileExt(blockLang);
                    const isActive = activeArtifactCode === code;
                    return (
                      <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${isActive ? "var(--orange)" : "var(--border)"}`, margin: "14px 0", transition: "border-color .2s" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "#f3f3f3", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>{blockLang}</span>
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>· {code.split("\n").length} lines</span>
                          </div>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={() => onArtifact && onArtifact(code, blockLang)} style={{ background: isActive ? "var(--orange)" : "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 9px", color: isActive ? "#fff" : "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all .15s" }} onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }} onMouseLeave={e => { e.currentTarget.style.background = isActive ? "var(--orange)" : "var(--sidebar)"; }}>
                              <OpenIcon size={11} />{isActive ? "Viewing" : "Open"}
                            </button>
                            <button onClick={() => downloadFile(code, blockLang)} style={{ background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 9px", color: "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "var(--sidebar)"}>
                              <DownloadIcon size={11} />.{ext}
                            </button>
                            <button onClick={() => navigator.clipboard.writeText(code)} style={{ background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 9px", color: "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "var(--sidebar)"}>
                              <CopyIcon size={11} /> Copy
                            </button>
                          </div>
                        </div>
                        <SyntaxHighlighter style={oneLight} language={blockLang} PreTag="div" customStyle={{ margin: 0, padding: "14px 16px", fontSize: 13, fontFamily: "var(--mono)", background: "#fafafa", lineHeight: 1.55 }} {...props}>
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return <code style={{ background: "rgba(0,0,0,0.07)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)", fontSize: 13 }} {...props}>{children}</code>;
                },
                p: ({ children }) => <p style={{ marginBottom: 10, lineHeight: 1.75 }}>{children}</p>,
                ul: ({ children }) => <ul style={{ paddingLeft: 22, marginBottom: 10 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 22, marginBottom: 10 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 18, marginBottom: 7 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 14, marginBottom: 5 }}>{children}</h3>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid var(--orange)", paddingLeft: 14, color: "var(--text2)", margin: "12px 0", fontStyle: "italic" }}>{children}</blockquote>,
                a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--orange)", textDecoration: "underline" }}>{children}</a>,
              }}>
                {msg.content}
              </ReactMarkdown>
            </div>
            {isLast && streaming && msg.content && (<span style={{ display: "inline-block", width: 2, height: 17, background: "var(--text)", marginLeft: 1, animation: "blink 1s ease infinite", verticalAlign: "middle" }} />)}
            {!streaming && msg.content && !msg.error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div className="msg-actions" style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => navigator.clipboard.writeText(msg.content)} style={{ background: "none", border: "1px solid transparent", borderRadius: 6, padding: "4px 7px", fontSize: 12, color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }} onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; e.currentTarget.style.borderColor = "var(--border)"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}>
                    <CopyIcon size={13} /> Copy
                  </button>
                </div>
                {msg.createdAt && <span style={{ fontSize: 10.5, color: "var(--text3)", flexShrink: 0 }}>{formatTime(msg.createdAt)}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Sidebar({ conversations, activeId, selectConv, newConv, deleteConv, onUpgrade, isMobile, onClose, onProfileClick }) {
  return (
    <div style={{
      width: isMobile ? "100%" : 260,
      height: "100vh",
      background: "var(--sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      position: isMobile ? "fixed" : "relative",
      left: 0,
      top: 0,
      zIndex: 100,
      boxShadow: isMobile ? "2px 0 8px rgba(0,0,0,0.1)" : "none",
    }}>
      <div style={{ padding: "14px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RkLogo size={28} />
          <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>rk.ai</span>
        </div>
        {isMobile && (<button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text3)" }}>✕</button>)}
      </div>

      <div style={{ padding: 8 }}>
        <button onClick={newConv} style={{ width: "100%", padding: "10px 12px", background: "var(--orange)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--orange2)"} onMouseLeave={e => e.currentTarget.style.background = "var(--orange)"}>
          <PlusIcon size={14} /> New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {conversations && conversations.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", padding: "12px 8px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>CONVERSATIONS</div>
            {conversations.map((c) => (
              <div key={c.id} onClick={() => { selectConv(c.id); if (isMobile) onClose(); }} style={{ padding: "10px 12px", marginBottom: 4, background: activeId === c.id ? "var(--cream)" : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13, color: activeId === c.id ? "var(--text)" : "var(--text2)", fontWeight: activeId === c.id ? 600 : 500, border: `1px solid ${activeId === c.id ? "var(--border)" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all .15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"} onMouseLeave={e => { e.currentTarget.style.background = activeId === c.id ? "var(--cream)" : "transparent"; }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
                <button onClick={e => { e.stopPropagation(); deleteConv(c.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = "var(--orange)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
        <button onClick={onProfileClick} style={{ width: "100%", padding: "10px", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8, transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--cream)"; }}>
          👤 Profile
        </button>
        <button onClick={onUpgrade} style={{ width: "100%", padding: "10px", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--orange)", transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--cream)"; }}>
          ⭐ Upgrade
        </button>
      </div>
    </div>
  );
}

function InputBar({ onSend, streaming, onStop, userPlan }) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (input.trim() || file) {
      onSend(input, file);
      setInput("");
      setFile(null);
    }
  };

  return (
    <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", background: "#fff" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {file && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, background: "var(--sidebar)", padding: "8px 12px", borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text2)", flex: 1 }}>{file.name}</span>
            <button onClick={() => setFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 16 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input type="file" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} accept="image/*,.pdf,.txt,.doc,.docx" />
          <button onClick={() => fileInputRef.current?.click()} style={{ background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--text2)", transition: "all .2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "var(--sidebar)"}>📎</button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Message rk.ai..." style={{ flex: 1, padding: "11px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", fontFamily: "inherit", transition: "border-color .2s", background: "#fafafa" }} onFocus={e => e.target.style.borderColor = "var(--orange)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
          <button onClick={streaming ? onStop : handleSend} disabled={!input.trim() && !file && !streaming} style={{ background: streaming ? "var(--text3)" : "var(--orange)", border: "none", borderRadius: 10, padding: "11px 14px", cursor: streaming || input.trim() || file ? "pointer" : "default", display: "flex", alignItems: "center", color: "#fff", fontWeight: 700, transition: "all .2s", opacity: streaming || input.trim() || file ? 1 : 0.5 }} onMouseEnter={e => !streaming && input.trim() && (e.currentTarget.style.background = "var(--orange2)")} onMouseLeave={e => !streaming && (e.currentTarget.style.background = "var(--orange)")}>
            {streaming ? <StopIcon size={16} /> : <SendIcon size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [showProfile, setShowProfile] = useState(false);

  const {
    conversations,
    activeId,
    messages,
    streaming,
    artifact,
    artifactLang,
    setArtifact,
    setArtifactLang,
    selectConv,
    newConv,
    deleteConv,
    sendMessage,
    stopStream,
  } = useChat();

  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminDash, setShowAdminDash] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <AuthPage />;
  if (showAdminDash) return <AdminDashboard onClose={() => setShowAdminDash(false)} />;
  if (showPricing) return <PricingPage onClose={() => setShowPricing(false)} />;

  return (
    <div style={{ display: "flex", height: "100vh", position: "relative", background: "var(--cream)" }}>
      {!isMobile || sidebarOpen ? (
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          selectConv={selectConv}
          newConv={newConv}
          deleteConv={deleteConv}
          onUpgrade={() => setShowPricing(true)}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
          onProfileClick={() => setShowProfile(true)}
        />
      ) : null}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", width: artifact && !isMobile ? "60%" : "100%", transition: "width 0.3s ease", position: "relative", overflow: "hidden" }}>
        {isMobile && (
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: 6, cursor: "pointer", display: "flex", alignItems: "center", color: "var(--text2)" }}>
              <MenuIcon size={18} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 0", maxWidth: 780, width: "100%", margin: "0 auto" }}>
            {messages.map((msg, idx) => (
              <Message
                key={idx}
                msg={msg}
                isLast={idx === messages.length - 1}
                streaming={streaming && idx === messages.length - 1}
                onArtifact={(code, lang) => {
                  setArtifact(code);
                  setArtifactLang(lang);
                }}
                activeArtifactCode={artifact}
                onRetry={() => {}}
                onEdit={() => {}}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <InputBar
          onSend={sendMessage}
          streaming={streaming}
          onStop={stopStream}
          userPlan={user?.plan}
        />
      </div>

      {artifact && !isMobile && (
        <ArtifactPanel
          artifact={artifact}
          artifactLang={artifactLang}
          onClose={() => {
            setArtifact(null);
            setArtifactLang(null);
          }}
          isMobile={false}
        />
      )}

      {artifact && isMobile && (
        <>
          <div onClick={() => { setArtifact(null); setArtifactLang(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }} />
          <ArtifactPanel
            artifact={artifact}
            artifactLang={artifactLang}
            onClose={() => { setArtifact(null); setArtifactLang(null); }}
            isMobile={true}
          />
        </>
      )}

      {showProfile && (
        <ProfilePage
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={logout}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onUpgrade={() => setShowPricing(true)} />}
    </div>
  );
}

export default App;
