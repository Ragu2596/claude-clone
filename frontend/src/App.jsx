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

// ✨ NEW: Import ArtifactPanel
import ArtifactPanel from "./components/ArtifactPanel";

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
const DownloadIcon  = ({size=14}) => <Icon size={size} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>;
const OpenIcon      = ({size=13}) => <Icon size={size} d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>;
const PrintIcon     = ({size=14}) => <Icon size={size} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>;
const MenuIcon      = ({size=22}) => <Icon size={size} sw={2} d="M3 6h18M3 12h18M3 18h18"/>;
const PencilIcon    = ({size=13}) => <Icon size={size} d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>;
const SettingsIcon  = ({size=14}) => <Icon size={size} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />;
const LogOutIcon    = ({size=14}) => <Icon size={size} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l4-4m0 0l-4-4m4 4H9" />;

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
initSettings();

if (!document.getElementById("rk-css")) {
  const s = document.createElement("style"); s.id = "rk-css"; s.textContent = CSS; document.head.appendChild(s);
}

// ─── File utilities ───────────────────────────────────────────────────────────
const FILE_EXT_MAP = {
  javascript:"js",js:"js",typescript:"ts",ts:"ts",jsx:"jsx",tsx:"tsx",
  python:"py",py:"py",java:"java",kotlin:"kt",swift:"swift",go:"go",
  rust:"rs",cpp:"cpp",c:"c",cs:"cs",php:"php",ruby:"rb",
  html:"html",css:"css",scss:"scss",xml:"xml",json:"json",
  yaml:"yaml",yml:"yml",toml:"toml",sql:"sql",graphql:"graphql",
  sh:"sh",bash:"sh",markdown:"md",md:"md",svg:"svg",csv:"csv",
  dockerfile:"dockerfile",txt:"txt",
};
const MIME_MAP = {
  html:"text/html",css:"text/css",js:"application/javascript",
  json:"application/json",xml:"application/xml",svg:"image/svg+xml",
  csv:"text/csv",md:"text/markdown",sql:"application/sql",
};
const PREVIEWABLE     = ["html","htm","svg"];
const PRINTABLE_AS_PDF = ["html","htm","svg","md","markdown"];

function getFileExt(lang) {
  return FILE_EXT_MAP[lang?.toLowerCase()] || "txt";
}
function getMimeType(lang) {
  return MIME_MAP[getFileExt(lang)] || "text/plain";
}
function downloadFile(code, lang, filename) {
  const ext  = getFileExt(lang);
  const name = filename || `rkai-file.${ext}`;
  const blob = new Blob([code], { type: getMimeType(lang) + ";charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function printAsPDF(code, lang) {
  const ext = getFileExt(lang);
  let html  = code;
  if (ext === "md" || ext === "markdown") {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7}
      code{background:#f0f0f0;padding:2px 6px;border-radius:4px}
      pre{background:#f5f5f5;padding:16px;border-radius:6px}
    </style></head><body>${code.replace(/\n/g,"<br>")}</body></html>`;
  } else if (!html.includes("<html")) {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${code}</body></html>`;
  }
  const w = window.open("","_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 300);
}
function extractCodeBlocks(content) {
  if (!content) return [];
  const regex = /```(\w+)?\n?([\s\S]*?)```/g;
  const blocks = []; let match;
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
  const fileBlock  = blocks.find(b => FILE_LANGS.has(b.lang));
  const best       = fileBlock || blocks.reduce((a,b) => b.code.length > a.code.length ? b : a);
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
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 16, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Welcome to rk.ai!
          </h1>
          <p style={{ fontSize: 15, color: "var(--text2)", marginTop: 8, marginBottom: 28 }}>
            Hey <strong>{registeredName}</strong>, your account is ready 🚀
          </p>
          <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid var(--border)", marginBottom: 24, textAlign: "left" }}>
            {[
              { icon: "✅", text: "Free account activated" },
              { icon: "🤖", text: "Groq & Gemini models ready" },
              { icon: "💬", text: "5 free messages per day" },
              { icon: "⚡", text: "Upgrade anytime for more" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setJustRegistered(false)}
            style={{ width: "100%", padding: "13px", background: "var(--orange)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(201,100,66,0.35)" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            Start chatting →
          </button>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 14 }}>
            You're signed in as <strong>{form.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <RkLogo size={56} />
          <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 18, letterSpacing: "-0.02em", color: "var(--text)" }}>
            {mode === "login" ? "Welcome back" : "Join rk.ai"}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text2)", marginTop: 6 }}>
            {mode === "login" ? "Sign in to your account" : "Create your free account"}
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid var(--border)", marginBottom: 16 }}>
          {mode === "register" && (
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={set("name")}
              style={{ ...inputStyle, marginBottom: 12 }}
              onFocus={e => e.target.style.borderColor = "var(--orange)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={set("email")}
            style={{ ...inputStyle, marginBottom: 12 }}
            onFocus={e => e.target.style.borderColor = "var(--orange)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={set("password")}
            style={{ ...inputStyle, marginBottom: 16 }}
            onFocus={e => e.target.style.borderColor = "var(--orange)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
          />

          {error && (
            <div style={{ background: "#fee", border: "1px solid #fcc", color: "#c00", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "var(--text3)" : "var(--orange)",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "all .2s",
            }}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = "var(--orange2)")}
            onMouseLeave={e => !loading && (e.currentTarget.style.background = "var(--orange)")}>
            {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text3)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <button
            onClick={() => googleLogin()}
            style={{
              width: "100%",
              padding: "11px",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text)",
              transition: "all .2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "var(--border)"; }}>
            <GoogleLogo /> Continue with Google
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 14, color: "var(--text2)" }}>
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--orange)", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Component ────────────────────────────────────────
function Message({ msg, isLast, streaming, onArtifact, activeArtifactCode, onRetry, onEdit }) {
  const isUser = msg.role === "user";
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [expanded, setExpanded] = useState(false);

  if (isUser) return (
    <div className="user-wrap" style={{ display: "flex", justifyContent: "flex-end", padding: "6px 0", marginBottom: 6, animation: "fadeUp .25s ease forwards" }}>
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
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} autoFocus
              style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 14, color: "var(--text)", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
              <button onClick={() => { setEditing(false); setEditText(msg.content); }} style={{ padding: "5px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, cursor: "pointer", color: "var(--text2)" }}>Cancel</button>
              <button onClick={() => { setEditing(false); if (editText.trim() && editText !== msg.content) onEdit?.(editText.trim()); }}
                style={{ padding: "5px 12px", background: "var(--orange)", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--user-bubble)", borderRadius: 18, borderBottomRightRadius: 4, padding: "11px 16px", color: "#fff", fontSize: 15, lineHeight: 1.65 }}>
            {msg.content.length <= 300 ? <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</span> : <div><div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: "8px 10px", fontSize: 12, lineHeight: 1.5, maxHeight: expanded ? "none" : "140px", overflow: "hidden", position: "relative", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{msg.content}{!expanded && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(transparent,rgba(0,0,0,0.3))", borderRadius: "0 0 10px 10px" }} />}</div><button onClick={() => setExpanded(e => !e)} style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{expanded ? "Show less" : `Show more (${msg.content.length} chars)`}</button></div>}
          </div>
        )}
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

  const isEmpty = !msg.content && streaming && isLast;

  return (
    <div className="msg-wrap" style={{ display: "flex", gap: 14, padding: "10px 0", animation: "fadeUp .25s ease forwards" }}>
      <div style={{ flexShrink: 0, marginTop: 3 }}><RkLogo size={26} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
                  if (!inline && match) {
                    const blockLang = (match[1] || "text").toLowerCase();
                    const ext       = getFileExt(blockLang);
                    const isActive  = activeArtifactCode === code;
                    return (
                      <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${isActive ? "var(--orange)" : "var(--border)"}`, margin: "14px 0", transition: "border-color .2s" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "#f3f3f3", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>{blockLang}</span>
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>· {code.split("\n").length} lines</span>
                          </div>
                          <div style={{ display: "flex", gap: 5 }}>
                            {/* ✨ NEW: Open button */}
                            <button
                              onClick={() => onArtifact && onArtifact(code, blockLang)}
                              style={{
                                background: isActive ? "var(--orange)" : "var(--sidebar)",
                                border: "1px solid var(--border)",
                                borderRadius: 5,
                                padding: "3px 9px",
                                color: isActive ? "#fff" : "var(--text2)",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                transition: "all .15s"
                              }}
                              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--hover)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isActive ? "var(--orange)" : "var(--sidebar)"; }}
                            >
                              <OpenIcon size={11} />{isActive ? "Viewing" : "Open"}
                            </button>
                            <button
                              onClick={() => downloadFile(code, blockLang)}
                              style={{ background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 9px", color: "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                              onMouseLeave={e => e.currentTarget.style.background = "var(--sidebar)"}
                            >
                              <DownloadIcon size={11} />.{ext}
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(code)}
                              style={{ background: "var(--sidebar)", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 9px", color: "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                              onMouseLeave={e => e.currentTarget.style.background = "var(--sidebar)"}
                            >
                              <CopyIcon size={11} /> Copy
                            </button>
                          </div>
                        </div>
                        <SyntaxHighlighter style={oneLight} language={blockLang} PreTag="div"
                          customStyle={{ margin: 0, padding: "14px 16px", fontSize: 13, fontFamily: "var(--mono)", background: "#fafafa", lineHeight: 1.55 }} {...props}>
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
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

            {isLast && streaming && msg.content && (
              <span style={{ display: "inline-block", width: 2, height: 17, background: "var(--text)", marginLeft: 1, animation: "blink 1s ease infinite", verticalAlign: "middle" }} />
            )}

            {!streaming && msg.content && !msg.error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div className="msg-actions" style={{ display: "flex", gap: 2 }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.content)}
                    style={{ background: "none", border: "1px solid transparent", borderRadius: 6, padding: "4px 7px", fontSize: 12, color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    <CopyIcon size={13} /> Copy
                  </button>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      style={{ background: "none", border: "1px solid transparent", borderRadius: 6, padding: "4px 7px", fontSize: 12, color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}
                    >
                      <RefreshIcon size={13} /> Retry
                    </button>
                  )}
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

// ─── Sidebar Component ────────────────────────────────────────
function Sidebar({ conversations, projects, activeId, activeProjectId, selectConv, newConv, deleteConv, setActiveProjectId, createProject, deleteProject, onUpgrade, isMobile, onClose }) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", description: "", systemPrompt: "" });
  const [showProjectForm, setShowProjectForm] = useState(false);

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
      {/* Header */}
      <div style={{ padding: "14px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RkLogo size={28} />
          <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>rk.ai</span>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text3)" }}>
            ✕
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div style={{ padding: 8 }}>
        <button
          onClick={newConv}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "var(--orange)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--orange2)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--orange)"}
        >
          <PlusIcon size={14} /> New chat
        </button>
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {conversations && conversations.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", padding: "12px 8px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Conversations
            </div>
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => { selectConv(c.id); if (isMobile) onClose(); }}
                style={{
                  padding: "10px 12px",
                  marginBottom: 4,
                  background: activeId === c.id ? "var(--cream)" : "transparent",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  color: activeId === c.id ? "var(--text)" : "var(--text2)",
                  fontWeight: activeId === c.id ? 600 : 500,
                  border: `1px solid ${activeId === c.id ? "var(--border)" : "transparent"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all .15s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                onMouseLeave={e => { e.currentTarget.style.background = activeId === c.id ? "var(--cream)" : "transparent"; }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteConv(c.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--orange)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={onUpgrade}
          style={{
            width: "100%",
            padding: "10px",
            background: "var(--cream)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--orange)",
            marginBottom: 6,
            transition: "all .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--cream)"; }}
        >
          ⭐ Upgrade
        </button>
      </div>
    </div>
  );
}

// ─── InputBar Component ───────────────────────────────────────
function InputBar({ onSend, streaming, onStop, userPlan }) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [model, setModel] = useState("auto");
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (input.trim() || file) {
      onSend(input, file, model);
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => setFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
            accept="image/*,.pdf,.txt,.doc,.docx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "var(--sidebar)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "var(--text2)",
              transition: "all .2s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--sidebar)"}
          >
            📎
          </button>

          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Message rk.ai..."
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color .2s",
              background: "#fafafa",
            }}
            onFocus={e => e.target.style.borderColor = "var(--orange)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
          />

          <button
            onClick={streaming ? onStop : handleSend}
            disabled={!input.trim() && !file && !streaming}
            style={{
              background: streaming ? "var(--text3)" : "var(--orange)",
              border: "none",
              borderRadius: 10,
              padding: "11px 14px",
              cursor: streaming || input.trim() || file ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              color: "#fff",
              fontWeight: 700,
              transition: "all .2s",
              opacity: streaming || input.trim() || file ? 1 : 0.5,
            }}
            onMouseEnter={e => !streaming && input.trim() && (e.currentTarget.style.background = "var(--orange2)")}
            onMouseLeave={e => !streaming && (e.currentTarget.style.background = "var(--orange)")}
          >
            {streaming ? <StopIcon size={16} /> : <SendIcon size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RateLimitBanner Component ────────────────────────────────
function RateLimitBanner({ rateLimit, onUpgrade }) {
  if (!rateLimit) return null;

  return (
    <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 8, padding: "12px 16px", margin: "12px 0", color: "#c00", fontSize: 13 }}>
      <strong>Rate limited:</strong> {rateLimit.count}/{rateLimit.limit} messages this hour.
      <button onClick={onUpgrade} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--orange)", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>
        Upgrade for more
      </button>
    </div>
  );
}

// ─── UsageBar Component ───────────────────────────────────────
function UsageBar({ usage, onUpgrade }) {
  if (!usage) return null;

  const percent = Math.round((usage.hourCount / usage.hourLimit) * 100);
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "12px 16px", margin: "12px 0", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
          Usage: {usage.hourCount}/{usage.hourLimit}
        </span>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>{percent}%</span>
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", background: percent > 80 ? "var(--orange)" : "var(--orange)", width: `${percent}%`, transition: "width .3s" }} />
      </div>
    </div>
  );
}

// ─── Main App Component ───────────────────────────────────────
function App() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const {
    conversations,
    activeId,
    messages,
    streaming,
    projects,
    activeProjectId,
    usage,
    rateLimit,
    upgradeRequired,
    trialExhausted,
    // ✨ NEW: Artifact state
    artifact,
    artifactLang,
    setArtifact,
    setArtifactLang,
    selectConv,
    setActiveProjectId,
    newConv,
    deleteConv,
    sendMessage,
    stopStream,
    createProject,
    deleteProject,
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
      {/* Sidebar */}
      {!isMobile || sidebarOpen ? (
        <Sidebar
          conversations={conversations}
          projects={projects}
          activeId={activeId}
          activeProjectId={activeProjectId}
          selectConv={selectConv}
          newConv={newConv}
          deleteConv={deleteConv}
          setActiveProjectId={setActiveProjectId}
          createProject={createProject}
          deleteProject={deleteProject}
          onUpgrade={() => setShowPricing(true)}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Main Chat Area - Width adjusts when artifact open */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          width: artifact && !isMobile ? "60%" : "100%",
          transition: "width 0.3s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Mobile Header */}
        {isMobile && (
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, background: "#fff" }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "var(--text2)",
              }}
            >
              <MenuIcon size={18} />
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", display: "flex", flexDirection: "column" }}>
          <RateLimitBanner rateLimit={rateLimit} onUpgrade={() => setShowPricing(true)} />
          <UsageBar usage={usage} onUpgrade={() => setShowPricing(true)} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 0", maxWidth: 780, width: "100%", margin: "0 auto" }}>
            {messages.map((msg, idx) => (
              <Message
                key={idx}
                msg={msg}
                isLast={idx === messages.length - 1}
                streaming={streaming && idx === messages.length - 1}
                onArtifact={(code, lang) => {
                  // ✨ NEW: Artifact handler
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

        {/* Input Bar */}
        <InputBar
          onSend={sendMessage}
          streaming={streaming}
          onStop={stopStream}
          userPlan={user?.plan}
        />
      </div>

      {/* ✨ NEW: Artifact Panel - Desktop */}
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

      {/* ✨ NEW: Artifact Panel - Mobile */}
      {artifact && isMobile && (
        <>
          <div
            onClick={() => {
              setArtifact(null);
              setArtifactLang(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 199,
            }}
          />
          <ArtifactPanel
            artifact={artifact}
            artifactLang={artifactLang}
            onClose={() => {
              setArtifact(null);
              setArtifactLang(null);
            }}
            isMobile={true}
          />
        </>
      )}

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onUpgrade={() => setShowPricing(true)} />}
    </div>
  );
}

export default App;
