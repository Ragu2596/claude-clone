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

// Claude.ai Colors
const colors = {
  bg: "#ffffff",
  sidebarBg: "#ffffff",
  text: "#0d0d0d",
  textSecondary: "#565869",
  textTertiary: "#9ca3af",
  border: "#d1d5db",
  hover: "#f3f4f6",
  active: "#ececf1",
  orange: "#ff6b35",
};

// Icons
const PlusIcon = ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const SendIcon = ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const MenuIcon = ({size=20}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const SettingsIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg>;
const HelpIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
const LogoutIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
const CopyIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const DownloadIcon = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
const OpenIcon = ({size=11}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14l11-11"/></svg>;
const TrashIcon = ({size=13}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>;

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

initSettings();
if (!document.getElementById("claude-css")) {
  const s = document.createElement("style");
  s.id = "claude-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

// Icons for sidebar
const SidebarIcon = ({ icon: Icon, label, active = false, onClick, badge = false }) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      width: 40,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? colors.hover : "transparent",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      color: active ? colors.text : colors.textSecondary,
      transition: "all 0.2s",
      position: "relative",
    }}
    onMouseEnter={e => !active && (e.currentTarget.style.background = colors.hover)}
    onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}
  >
    <Icon size={20} />
    {badge && <div style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, background: colors.orange, borderRadius: "50%" }} />}
  </button>
);

function AuthPage() {
  const { login, register, googleLogin, oauthError, setOauthError } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (oauthError) { setError(oauthError); setOauthError(null); } }, [oauthError]);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
        setMode("login");
      }
    } catch (e) {
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.text, marginBottom: 8 }}>rk.ai</h1>
          <p style={{ fontSize: 14, color: colors.textSecondary }}>{mode === "login" ? "Sign in to your account" : "Create a new account"}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {mode === "register" && (
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={{
                padding: "12px 14px",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
              }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            style={{
              padding: "12px 14px",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            style={{
              padding: "12px 14px",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {error && (
          <div style={{ background: "#fee", border: `1px solid ${colors.border}`, color: "#c00", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: colors.orange,
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: colors.textSecondary }}>
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{
              background: "none",
              border: "none",
              color: colors.orange,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ msg, isLast, streaming, onArtifact, activeArtifactCode }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, animation: "slideIn 0.3s ease" }}>
        <div style={{
          maxWidth: "60%",
          background: colors.active,
          borderRadius: 12,
          padding: "12px 16px",
          color: colors.text,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16, animation: "slideIn 0.3s ease" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: colors.active, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");
            if (!inline && match) {
              const lang = match[1] || "text";
              const isActive = activeArtifactCode === code;
              return (
                <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${colors.border}`, margin: "12px 0", background: colors.bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: colors.hover }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{lang}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onArtifact && onArtifact(code, lang)} style={{ padding: "4px 8px", fontSize: 11, background: isActive ? colors.orange : colors.hover, border: `1px solid ${colors.border}`, borderRadius: 4, cursor: "pointer", color: isActive ? "#fff" : colors.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                        <OpenIcon size={11} /> {isActive ? "Viewing" : "Open"}
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(code)} style={{ padding: "4px 8px", fontSize: 11, background: colors.hover, border: `1px solid ${colors.border}`, borderRadius: 4, cursor: "pointer", color: colors.text, fontWeight: 500 }}>
                        Copy
                      </button>
                    </div>
                  </div>
                  <SyntaxHighlighter style={oneLight} language={lang} customStyle={{ margin: 0, padding: "12px 14px", fontSize: 12, background: colors.bg }} PreTag="div" {...props}>
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return <code style={{ background: colors.hover, padding: "2px 6px", borderRadius: 4, fontSize: 13 }} {...props}>{children}</code>;
          },
        }}>
          {msg.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function App() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <AuthPage />;

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: colors.bg }}>
      {/* Sidebar */}
      <div style={{
        width: isMobile ? 0 : 60,
        background: colors.sidebarBg,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 0",
        gap: 8,
        overflowY: "auto",
      }}>
        <SidebarIcon icon={MenuIcon} label="New chat" onClick={newConv} />
        
        <div style={{ width: 32, height: 1, background: colors.border }} />

        <SidebarIcon icon={SettingsIcon} label="Settings" onClick={() => setShowSettings(true)} />
        <SidebarIcon icon={HelpIcon} label="Help" />
        
        <div style={{ flex: 1 }} />
        
        <SidebarIcon icon={LogoutIcon} label="Sign out" onClick={logout} />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h1 style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>rk.ai</h1>
          {!isMobile && (
            <button
              onClick={() => setShowProfile(true)}
              style={{
                padding: "6px 12px",
                background: colors.hover,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                color: colors.text,
              }}
            >
              👤 Profile
            </button>
          )}
        </div>

        {/* Chat Area */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          maxWidth: 800,
          margin: "0 auto",
          width: artifact && !isMobile ? "60%" : "100%",
          transition: "width 0.3s ease",
        }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div>
                <h2 style={{ fontSize: 32, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Welcome to rk.ai</h2>
                <p style={{ fontSize: 14, color: colors.textSecondary }}>Start a conversation or select from your recent chats</p>
              </div>
            </div>
          ) : (
            <>
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
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: "16px 24px 24px",
          borderTop: `1px solid ${colors.border}`,
        }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{
              display: "flex",
              gap: 12,
              background: colors.hover,
              borderRadius: 12,
              padding: "12px 16px",
              alignItems: "flex-end",
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Message rk.ai..."
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  color: colors.text,
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={streaming ? stopStream : handleSend}
                disabled={!input.trim() && !streaming}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: streaming || input.trim() ? colors.orange : colors.border,
                  border: "none",
                  cursor: streaming || input.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {streaming ? "⊘" : "↑"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Artifact Panel */}
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

      {/* Profile Modal */}
      {showProfile && (
        <ProfilePage
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={logout}
        />
      )}

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
