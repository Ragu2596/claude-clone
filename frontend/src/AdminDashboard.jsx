// AdminDashboard.jsx — rk.ai Admin with 2FA + Role-based access

import { useState, useEffect, useCallback } from "react";

const API         = import.meta.env.VITE_API_URL;
const getToken    = () => localStorage.getItem("token");
const SESSION_KEY = "rk_admin_session";

const apiFetch = async (path, opts = {}) => {
  const sessionToken = sessionStorage.getItem(SESSION_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(sessionToken ? { "x-admin-session": sessionToken } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body,
  });
  return res.json();
};

const INR = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const USD = (n) => `$${(n || 0).toFixed(4)}`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const ROLE_COLOR = { superadmin: "#7c3aed", admin: "#c96442", viewer: "#0ea5e9" };
const ROLE_BG    = { superadmin: "#1e1330", admin: "#2d1a0e", viewer: "#0c1a2e" };
const PLAN_COLOR = { free: "#6b7280", starter: "#f59e0b", pro: "#c96442", max: "#7c3aed" };

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
      background: bg || "#1e293b", color: color || "#94a3b8",
      border: `1px solid ${color || "#334155"}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, color = "#c96442" }) {
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── OTP Screen ────────────────────────────────────────────────
function OTPScreen({ userEmail, onVerified }) {
  const [step,    setStep]    = useState("send");
  const [otp,     setOtp]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [msg,     setMsg]     = useState("");
  const [timer,   setTimer]   = useState(0);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const sendOTP = async () => {
    setLoading(true); setError(""); setMsg("");
    try {
      const res = await apiFetch("/api/admin/send-otp", { method: "POST" });
      if (res.error) { setError(res.error); return; }
      setMsg(`✅ OTP sent to ${userEmail}`);
      setStep("verify");
      setTimer(60);
    } catch { setError("Failed to send OTP."); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/admin/verify-otp", { method: "POST", body: JSON.stringify({ otp }) });
      if (res.error) { setError(res.error); setOtp(""); return; }
      sessionStorage.setItem(SESSION_KEY, res.sessionToken);
      onVerified(res.role);
    } catch { setError("Verification failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 400, background: "#1e293b", border: "1px solid #334155", borderRadius: 20, padding: 40, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "#c96442", borderRadius: 16, display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>🔐</div>
        <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22, margin: "0 0 6px" }}>Admin Verification</h2>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 28px" }}>
          {step === "send" ? "Verify your identity to access admin panel" : `Enter the OTP sent to ${userEmail}`}
        </p>

        {error && <div style={{ background: "#2d1515", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px",
          color: "#f87171", fontSize: 13, marginBottom: 16, textAlign: "left" }}>{error}</div>}
        {msg && <div style={{ background: "#0f2d1a", border: "1px solid #14532d", borderRadius: 8, padding: "10px 14px",
          color: "#34d399", fontSize: 13, marginBottom: 16, textAlign: "left" }}>{msg}</div>}

        {step === "send" ? (
          <button onClick={sendOTP} disabled={loading}
            style={{ width: "100%", padding: 13, background: loading ? "#475569" : "#c96442",
              border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "default" : "pointer" }}>
            {loading ? "Sending..." : "Send OTP to my email"}
          </button>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {[0,1,2,3,4,5].map(i => (
                <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1}
                  value={otp[i] || ""}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
                    const arr = otp.split(""); arr[i] = val;
                    const next = arr.join("").slice(0, 6); setOtp(next);
                    if (val && i < 5) document.getElementById(`otp-${i+1}`)?.focus();
                  }}
                  onKeyDown={e => { if (e.key === "Backspace" && !otp[i] && i > 0) document.getElementById(`otp-${i-1}`)?.focus(); }}
                  style={{ width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 700,
                    background: "#0f172a", border: `2px solid ${otp[i] ? "#c96442" : "#334155"}`,
                    borderRadius: 8, color: "#f1f5f9", outline: "none" }} />
              ))}
            </div>
            <button onClick={verifyOTP} disabled={loading || otp.length < 6}
              style={{ width: "100%", padding: 13, background: (loading || otp.length < 6) ? "#475569" : "#c96442",
                border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 15,
                cursor: (loading || otp.length < 6) ? "default" : "pointer", marginBottom: 12 }}>
              {loading ? "Verifying..." : "Verify & Enter Dashboard →"}
            </button>
            <button onClick={() => { if (!timer) sendOTP(); }} disabled={!!timer}
              style={{ background: "none", border: "none", color: timer ? "#475569" : "#94a3b8", fontSize: 13, cursor: timer ? "default" : "pointer" }}>
              {timer ? `Resend in ${timer}s` : "Resend OTP"}
            </button>
          </>
        )}
        <p style={{ marginTop: 20, fontSize: 11, color: "#475569" }}>Session valid for 2 hours</p>
      </div>
    </div>
  );
}

// ── Not Admin Screen ─────────────────────────────────────────
function NotAdminScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <p style={{ fontSize: 64 }}>🚫</p>
        <p style={{ fontSize: 22, fontWeight: 800, marginTop: 16 }}>Access Denied</p>
        <p style={{ color: "#64748b", marginTop: 8, maxWidth: 320 }}>Your account is not authorized to access the admin panel. Contact the super admin.</p>
        <button onClick={() => { window.location.hash = ""; window.location.reload(); }}
          style={{ marginTop: 24, padding: "10px 24px", background: "#c96442", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          Go back to rk.ai
        </button>
      </div>
    </div>
  );
}

// ── Admin Management Tab ─────────────────────────────────────
function AdminsTab({ currentRole }) {
  const [admins,  setAdmins]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ email: "", name: "", role: "viewer" });
  const [adding,  setAdding]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const loadAdmins = async () => {
    setLoading(true);
    const data = await apiFetch("/api/admin/admins");
    if (Array.isArray(data)) setAdmins(data);
    setLoading(false);
  };

  useEffect(() => { loadAdmins(); }, []);

  const addAdmin = async () => {
    if (!form.email) { setError("Email required"); return; }
    setAdding(true); setError(""); setSuccess("");
    const res = await apiFetch("/api/admin/admins", { method: "POST", body: JSON.stringify(form) });
    if (res.error) { setError(res.error); }
    else { setSuccess(`✅ ${form.email} added as ${form.role}`); setForm({ email: "", name: "", role: "viewer" }); loadAdmins(); }
    setAdding(false);
  };

  const toggleActive = async (admin) => {
    await apiFetch(`/api/admin/admins/${admin.id}`, { method: "PATCH", body: JSON.stringify({ active: !admin.active }) });
    loadAdmins();
  };

  const changeRole = async (admin, role) => {
    await apiFetch(`/api/admin/admins/${admin.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
    loadAdmins();
  };

  const removeAdmin = async (admin) => {
    if (!confirm(`Remove ${admin.email} from admin?`)) return;
    await apiFetch(`/api/admin/admins/${admin.id}`, { method: "DELETE" });
    loadAdmins();
  };

  if (currentRole !== "superadmin") return (
    <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: 24, textAlign: "center" }}>
      <p style={{ fontSize: 32 }}>🔒</p>
      <p style={{ color: "#94a3b8", marginTop: 12 }}>Only the super admin can manage admin users.</p>
    </div>
  );

  return (
    <div>
      {/* Role explanation */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { role: "superadmin", desc: "Full access + manage admins", icon: "👑" },
          { role: "admin",      desc: "Full dashboard access, no admin management", icon: "🛡️" },
          { role: "viewer",     desc: "Read-only, emails masked", icon: "👁️" },
        ].map(r => (
          <div key={r.role} style={{ background: ROLE_BG[r.role], border: `1px solid ${ROLE_COLOR[r.role]}33`,
            borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 160 }}>
            <p style={{ margin: "0 0 4px", fontSize: 13 }}>{r.icon} <strong style={{ color: ROLE_COLOR[r.role], textTransform: "uppercase" }}>{r.role}</strong></p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Add admin form */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 14 }}>➕ Add Admin User</p>
        {error   && <div style={{ background: "#2d1515", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ background: "#0f2d1a", border: "1px solid #14532d", borderRadius: 8, padding: "8px 12px", color: "#34d399", fontSize: 13, marginBottom: 12 }}>{success}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email address *" type="email"
            style={{ flex: 2, minWidth: 200, padding: "9px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 13 }} />
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Display name"
            style={{ flex: 1, minWidth: 140, padding: "9px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 13 }} />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 13 }}>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={addAdmin} disabled={adding}
            style={{ padding: "9px 20px", background: adding ? "#475569" : "#c96442", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: adding ? "default" : "pointer" }}>
            {adding ? "Adding..." : "Add Admin"}
          </button>
        </div>
      </div>

      {/* Admin list */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              {["Admin User", "Role", "Added By", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#475569" }}>Loading...</td></tr>
            ) : admins.map(a => (
              <tr key={a.id} style={{ borderTop: "1px solid #334155" }}>
                <td style={{ padding: "12px 16px" }}>
                  <p style={{ fontWeight: 600, color: "#f1f5f9", margin: 0 }}>{a.name || "—"}</p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{a.email}</p>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {a.role === "superadmin" ? (
                    <Badge label="👑 Superadmin" color={ROLE_COLOR.superadmin} bg={ROLE_BG.superadmin} />
                  ) : (
                    <select value={a.role} onChange={e => changeRole(a, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${ROLE_COLOR[a.role]}`,
                        background: ROLE_BG[a.role], color: ROLE_COLOR[a.role], fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>{a.addedBy}</td>
                <td style={{ padding: "12px 16px" }}>
                  {a.role === "superadmin" ? (
                    <Badge label="Permanent" color="#64748b" />
                  ) : (
                    <button onClick={() => toggleActive(a)}
                      style={{ padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                        background: a.active ? "#0f2d1a" : "#2d1515", color: a.active ? "#34d399" : "#f87171" }}>
                      {a.active ? "✅ Active" : "❌ Disabled"}
                    </button>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {a.role !== "superadmin" && (
                    <button onClick={() => removeAdmin(a)}
                      style={{ padding: "4px 10px", background: "#2d1515", border: "1px solid #7f1d1d",
                        borderRadius: 6, color: "#f87171", fontSize: 11, cursor: "pointer" }}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function AdminDashboard() {
  const storedToken = getToken();
  if (!storedToken) { window.location.hash = ""; return null; }

  const [checkDone,   setCheckDone]   = useState(false);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [otpDone,     setOtpDone]     = useState(!!sessionStorage.getItem(SESSION_KEY));
  const [userEmail,   setUserEmail]   = useState("");
  const [role,        setRole]        = useState(sessionStorage.getItem("rk_admin_role") || "");
  const [summary,     setSummary]     = useState(null);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");
  const [sort,        setSort]        = useState("joined");
  const [selUser,     setSelUser]     = useState(null);
  const [userLogs,    setUserLogs]    = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tab,         setTab]         = useState("users");
  const [flywheel,    setFlywheel]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Step 1: Check if this user is an admin at all
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/api/admin/check");
        if (data.isAdmin) {
          setIsAdmin(true);
          setUserEmail(data.email || "");
          if (!role) setRole(data.role);
        }
      } catch {}
      setCheckDone(true);
    })();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [s, u] = await Promise.all([apiFetch("/api/admin/summary"), apiFetch("/api/admin/users")]);
      if (s.error?.includes("expired") || s.error?.includes("OTP")) {
        sessionStorage.removeItem(SESSION_KEY);
        setOtpDone(false); return;
      }
      if (s.error) throw new Error(s.error);
      setSummary(s); setUsers(Array.isArray(u) ? u : []);
      setLastRefresh(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const loadFlywheel = useCallback(async () => {
    const data = await apiFetch("/api/chat/flywheel-stats");
    if (!data.error) setFlywheel(data);
  }, []);

  useEffect(() => { if (otpDone) loadData(); }, [otpDone]);
  useEffect(() => { if (tab === "flywheel" && otpDone) loadFlywheel(); }, [tab, otpDone]);

  const loadUserLogs = async (userId) => {
    setLogsLoading(true);
    const data = await apiFetch(`/api/admin/user/${userId}/logs`);
    setUserLogs(Array.isArray(data) ? data : []);
    setLogsLoading(false);
  };

  const lock = () => { sessionStorage.removeItem(SESSION_KEY); setOtpDone(false); };

  // ── Guards ────────────────────────────────────────────────
  if (!checkDone) return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#64748b" }}>Checking access...</p>
    </div>
  );
  if (!isAdmin) return <NotAdminScreen />;
  if (!otpDone) return (
    <OTPScreen userEmail={userEmail} onVerified={(r) => {
      setRole(r); sessionStorage.setItem("rk_admin_role", r); setOtpDone(true);
    }} />
  );

  const s = summary || {};
  const filtered = users
    .filter(u => filter === "all" ? true : filter === "loss" ? (u.revenueInr < (u.costInr||0)) : u.plan === filter)
    .filter(u => !search || u.email?.includes(search) || u.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "revenue") return (b.revenueInr||0) - (a.revenueInr||0);
      if (sort === "cost")    return (b.costUsd||0) - (a.costUsd||0);
      if (sort === "profit")  return (b.profitInr||0) - (a.profitInr||0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9", margin: 0 }}>rk.ai Admin</p>
              <Badge label={role} color={ROLE_COLOR[role]} bg={ROLE_BG[role]} />
            </div>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadData} style={{ padding: "6px 14px", background: "#334155", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>🔄 Refresh</button>
          <button onClick={lock}     style={{ padding: "6px 14px", background: "#334155", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>🔐 Lock</button>
          <button onClick={() => { window.location.hash = ""; window.location.reload(); }}
            style={{ padding: "6px 14px", background: "#c96442", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, cursor: "pointer" }}>← Back to app</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard label="Total Users"  value={s.totalUsers||0}         color="#60a5fa" />
          <StatCard label="Paid Users"   value={s.paidUsers||0}          color="#34d399" sub={`${pct(s.paidUsers,s.totalUsers)}% conversion`} />
          <StatCard label="Revenue"      value={INR(s.revenueInr||0)}    color="#a78bfa" />
          <StatCard label="API Cost"     value={`$${((s.costInr||0)/84).toFixed(2)}`} color="#f87171" />
          <StatCard label="Net Profit"   value={INR(s.profitInr||0)}     color="#34d399" />
          <StatCard label="Free"         value={(s.planBreakdown?.free)||0}     color="#6b7280" />
          <StatCard label="Starter"      value={(s.planBreakdown?.starter)||0}  color="#f59e0b" />
          <StatCard label="Pro"          value={(s.planBreakdown?.pro)||0}      color="#c96442" />
          <StatCard label="Max"          value={(s.planBreakdown?.max)||0}      color="#7c3aed" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#1e293b", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {[
            ["users",   "👥 Users"],
            ["flywheel","⚡ Cache"],
            ...(role === "superadmin" ? [["admins", "👑 Admins"]] : []),
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: tab === id ? "#c96442" : "transparent", color: tab === id ? "#fff" : "#64748b" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            {loading ? <p style={{ color: "#475569" }}>Loading users...</p> : error ? (
              <div style={{ color: "#f87171" }}>{error} <button onClick={loadData} style={{ marginLeft: 8, color: "#c96442", background: "none", border: "none", cursor: "pointer" }}>Retry</button></div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or name..."
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", fontSize: 13, width: 220 }} />
                  <select value={filter} onChange={e => setFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", fontSize: 13 }}>
                    <option value="all">All plans</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="max">Max</option>
                    <option value="loss">⚠️ At loss</option>
                  </select>
                  <select value={sort} onChange={e => setSort(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", fontSize: 13 }}>
                    <option value="joined">Newest first</option>
                    <option value="revenue">By revenue</option>
                    <option value="cost">By cost</option>
                    <option value="profit">By profit</option>
                  </select>
                  <span style={{ padding: "8px 12px", fontSize: 13, color: "#64748b" }}>{filtered.length} users</span>
                </div>

                <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: "#0f172a" }}>
                      {["User","Plan","Revenue","API Cost","Profit","Messages","Joined"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.map(u => {
                        const profit = u.profitInr || 0;
                        const isLoss = profit < 0 && u.plan !== "free";
                        return (
                          <tr key={u.id} onClick={() => { setSelUser(u); if (role !== "viewer") loadUserLogs(u.id); }}
                            style={{ borderTop: "1px solid #334155", cursor: "pointer", background: selUser?.id===u.id ? "#263349" : isLoss ? "#2d1515" : "transparent" }}
                            onMouseEnter={e => { if (selUser?.id!==u.id) e.currentTarget.style.background="#1a2744"; }}
                            onMouseLeave={e => { if (selUser?.id!==u.id) e.currentTarget.style.background=isLoss?"#2d1515":"transparent"; }}>
                            <td style={{ padding: "10px 14px" }}>
                              <p style={{ fontWeight: 600, color: "#f1f5f9", margin: 0 }}>{u.name||"—"}</p>
                              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{u.email}</p>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <Badge label={u.plan} color={PLAN_COLOR[u.plan]||"#6b7280"} />
                            </td>
                            <td style={{ padding: "10px 14px", color: "#34d399", fontWeight: 600 }}>{INR(u.revenueInr||0)}</td>
                            <td style={{ padding: "10px 14px", color: "#f87171" }}>{USD(u.costUsd||0)}</td>
                            <td style={{ padding: "10px 14px", color: profit>=0?"#34d399":"#f87171", fontWeight: 700 }}>
                              {profit>=0?"+":""}{INR(profit)}{isLoss&&<span style={{marginLeft:6}}>⚠️</span>}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{u.messageCount||0}</td>
                            <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length===0 && <p style={{ textAlign: "center", padding: 24, color: "#475569" }}>No users found</p>}
                </div>

                {selUser && (
                  <div style={{ marginTop: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9", margin: 0 }}>{selUser.name}</p>
                        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{selUser.email}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge label={selUser.plan} color={PLAN_COLOR[selUser.plan]||"#6b7280"} />
                        <button onClick={() => setSelUser(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
                      <StatCard label="Revenue"  value={INR(selUser.revenueInr||0)} color="#a78bfa" />
                      <StatCard label="API Cost" value={USD(selUser.costUsd||0)}    color="#f87171" />
                      <StatCard label="Messages" value={selUser.messageCount||0}    color="#60a5fa" />
                      <StatCard label="Plan Exp" value={selUser.planExpiresAt ? new Date(selUser.planExpiresAt).toLocaleDateString() : "—"} color="#94a3b8" />
                    </div>
                    {role !== "viewer" && (
                      <>
                        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>RECENT API LOGS</p>
                        {logsLoading ? <p style={{ color: "#475569", fontSize: 13 }}>Loading...</p> :
                          userLogs.length===0 ? <p style={{ color: "#475569", fontSize: 13 }}>No logs yet</p> : (
                          <div style={{ maxHeight: 200, overflowY: "auto" }}>
                            {userLogs.slice(0,20).map((log,i) => (
                              <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid #334155", fontSize: 12 }}>
                                <span style={{ color: "#64748b", minWidth: 80 }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                                <span style={{ color: "#94a3b8", minWidth: 90 }}>{log.model}</span>
                                <span style={{ color: "#f87171" }}>{USD(log.cost||0)}</span>
                                <span style={{ color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.prompt?.slice(0,60)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── FLYWHEEL TAB ── */}
        {tab === "flywheel" && (
          !flywheel ? <p style={{ color: "#475569" }}>Loading...</p> : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12, marginBottom: 20 }}>
                <StatCard label="Cached Q&As"  value={flywheel.totalEntries}           color="#60a5fa" />
                <StatCard label="Hit Rate"      value={`${flywheel.hitRate}%`}          color="#34d399" sub="last 7 days" />
                <StatCard label="Total Hits"    value={flywheel.totalHits}              color="#a78bfa" />
                <StatCard label="Misses"        value={flywheel.totalMisses}            color="#f87171" />
                <StatCard label="Est. Savings"  value={`$${flywheel.estimatedSavings}`} color="#34d399" />
              </div>
              {flywheel.topHits?.length > 0 && (
                <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: 16 }}>
                  <p style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>🔥 Top Cached Questions</p>
                  {flywheel.topHits.map((h,i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #334155", fontSize: 13 }}>
                      <span style={{ color: "#94a3b8", flex: 1 }}>{h.question}</span>
                      <span style={{ color: "#34d399", fontWeight: 700, marginLeft: 12 }}>{h.hitCount}× hits</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── ADMINS TAB (superadmin only) ── */}
        {tab === "admins" && <AdminsTab currentRole={role} />}

      </div>
    </div>
  );
}
