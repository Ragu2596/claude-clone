// AdminDashboard.jsx
// Access: ONLY ragunath2596@gmail.com — checked both frontend + backend
// URL: /#/admin

import { useState, useEffect, useCallback } from "react";

const API       = import.meta.env.VITE_API_URL;
const getToken  = () => localStorage.getItem("token");
const ADMIN_EMAIL = "ragunath2596@gmail.com";

const apiFetch  = (path) =>
  fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

// ── Helpers ────────────────────────────────────────────────────
const INR  = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const USD  = (n) => `$${(n || 0).toFixed(4)}`;
const pct  = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const planColor = { free:"#6b7280", starter:"#f59e0b", pro:"#c96442", max:"#7c3aed" };
const planBg    = { free:"#f3f4f6", starter:"#fffbeb", pro:"#fff7f5", max:"#faf5ff" };

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "#c96442" }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e8e2da", borderRadius:12, padding:"16px 18px" }}>
      <p style={{ fontSize:11, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{label}</p>
      <p style={{ fontSize:24, fontWeight:800, color, lineHeight:1 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{sub}</p>}
    </div>
  );
}

// ── Plan Badge ─────────────────────────────────────────────────
function PlanBadge({ plan }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99,
      background: planBg[plan] || "#f3f4f6", color: planColor[plan] || "#6b7280",
      textTransform:"uppercase", letterSpacing:"0.05em" }}>
      {plan}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function AdminDashboard() {

  // ── SECURITY: Block anyone who isn't logged in ────────────────
  // Backend also enforces this — this is just UX protection
  const storedToken = getToken();
  if (!storedToken) {
    window.location.hash = "";
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f172a" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <p style={{ fontSize:48 }}>🔒</p>
          <p style={{ fontSize:18, fontWeight:700, marginTop:12 }}>Not logged in</p>
          <p style={{ color:"#94a3b8", marginTop:6 }}>Redirecting...</p>
        </div>
      </div>
    );
  }

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
  const [tab,         setTab]         = useState("users");  // users | flywheel | models
  const [flywheel,    setFlywheel]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [s, u] = await Promise.all([
        apiFetch("/api/admin/summary"),
        apiFetch("/api/admin/users"),
      ]);
      // Backend returns 403 for non-admin — catch it here
      if (s.error === "Not authorized") { setAccessDenied(true); return; }
      if (s.error) throw new Error(s.error);
      setSummary(s);
      setUsers(Array.isArray(u) ? u : []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFlywheel = useCallback(async () => {
    const data = await apiFetch("/api/chat/flywheel-stats");
    setFlywheel(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "flywheel") loadFlywheel(); }, [tab]);

  const loadUserLogs = async (userId) => {
    setLogsLoading(true);
    const data = await apiFetch(`/api/admin/user/${userId}/logs`);
    setUserLogs(Array.isArray(data) ? data : []);
    setLogsLoading(false);
  };

  // ── ACCESS DENIED ─────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f172a" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <p style={{ fontSize:64 }}>🚫</p>
          <p style={{ fontSize:22, fontWeight:800, marginTop:16 }}>Access Denied</p>
          <p style={{ color:"#94a3b8", marginTop:8 }}>This page is only accessible to rk.ai admins.</p>
          <button onClick={() => { window.location.hash = ""; window.location.reload(); }}
            style={{ marginTop:20, padding:"10px 24px", background:"#c96442", border:"none", borderRadius:8, color:"#fff", fontWeight:600, cursor:"pointer" }}>
            Go back to rk.ai
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f172a" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <p style={{ fontSize:32, marginBottom:16 }}>⚙️</p>
          <p style={{ color:"#94a3b8" }}>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f172a" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <p style={{ fontSize:32, marginBottom:12 }}>❌</p>
          <p style={{ fontWeight:700, fontSize:16 }}>{error}</p>
          <button onClick={load} style={{ marginTop:16, padding:"8px 20px", background:"#c96442", border:"none", borderRadius:8, color:"#fff", cursor:"pointer" }}>
            Retry
          </button>
          <p style={{ fontSize:12, color:"#94a3b8", marginTop:8 }}>Make sure ADMIN_EMAIL env var is set on Render.</p>
        </div>
      </div>
    );
  }

  // ── FILTERS ───────────────────────────────────────────────────
  const filtered = users
    .filter(u => filter === "all" ? true : filter === "loss"
      ? (u.revenueInr < (u.costInr||0))
      : u.plan === filter)
    .filter(u => !search || u.email.includes(search) || u.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "revenue") return (b.revenueInr||0) - (a.revenueInr||0);
      if (sort === "cost")    return (b.totalCostUSD||0) - (a.totalCostUSD||0);
      if (sort === "profit")  return (b.profitInr||0) - (a.profitInr||0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const s = summary || {};

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#e2e8f0", fontFamily:"system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ background:"#1e293b", borderBottom:"1px solid #334155", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22 }}>⚙️</span>
          <div>
            <p style={{ fontWeight:800, fontSize:16, color:"#f1f5f9" }}>rk.ai Admin</p>
            <p style={{ fontSize:11, color:"#64748b" }}>
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}
            </p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={load} style={{ padding:"6px 14px", background:"#334155", border:"none", borderRadius:7, color:"#94a3b8", fontSize:12, cursor:"pointer" }}>
            🔄 Refresh
          </button>
          <button onClick={() => { window.location.hash = ""; window.location.reload(); }}
            style={{ padding:"6px 14px", background:"#c96442", border:"none", borderRadius:7, color:"#fff", fontSize:12, cursor:"pointer" }}>
            ← Back to app
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px" }}>

        {/* Summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
          <StatCard label="Total Users"     value={s.totalUsers || 0}          color="#60a5fa" />
          <StatCard label="Paid Users"      value={s.paidUsers  || 0}          color="#34d399" sub={`${pct(s.paidUsers,s.totalUsers)}% conversion`} />
          <StatCard label="Revenue (Est)"   value={INR(s.revenueInr || 0)} color="#a78bfa" />
          <StatCard label="API Cost"        value={`$${((s.costInr||0)/84).toFixed(4)}`} color="#f87171" />
          <StatCard label="Net Profit"      value={INR(s.profitInr || 0)} color="#34d399" />
          <StatCard label="Free Users"      value={(s.planBreakdown?.free)||0}          color="#6b7280" />
          <StatCard label="Starter"         value={(s.planBreakdown?.starter)||0}          color="#f59e0b" />
          <StatCard label="Pro Users"       value={(s.planBreakdown?.pro)||0}          color="#c96442" />
          <StatCard label="Max Users"       value={(s.planBreakdown?.max)||0}          color="#7c3aed" />
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20, background:"#1e293b", borderRadius:10, padding:4, width:"fit-content" }}>
          {[["users","👥 Users"],["flywheel","⚡ Cache / Flywheel"],["models","🤖 Models"]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding:"7px 16px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
                background: tab===id ? "#c96442" : "transparent", color: tab===id ? "#fff" : "#64748b", transition:"all .15s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            {/* Filters */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by email or name..."
                style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #334155", background:"#1e293b", color:"#e2e8f0", fontSize:13, width:220 }} />
              <select value={filter} onChange={e=>setFilter(e.target.value)}
                style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #334155", background:"#1e293b", color:"#e2e8f0", fontSize:13 }}>
                <option value="all">All plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
                <option value="loss">⚠️ At loss</option>
              </select>
              <select value={sort} onChange={e=>setSort(e.target.value)}
                style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #334155", background:"#1e293b", color:"#e2e8f0", fontSize:13 }}>
                <option value="joined">Sort: Newest</option>
                <option value="revenue">Sort: Revenue</option>
                <option value="cost">Sort: API Cost</option>
                <option value="profit">Sort: Profit</option>
              </select>
              <span style={{ padding:"8px 12px", fontSize:13, color:"#64748b" }}>
                {filtered.length} users
              </span>
            </div>

            {/* User table */}
            <div style={{ background:"#1e293b", borderRadius:12, border:"1px solid #334155", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#0f172a" }}>
                    {["User","Plan","Revenue","API Cost","Profit","Messages","Joined"].map(h => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", color:"#64748b", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => {
                    const rev    = u.revenueInr  || 0;
                    const cost   = u.costInr     || 0;
                    const profit = u.profitInr   || 0;
                    const isLoss = profit < 0 && u.plan !== "free";
                    return (
                      <tr key={u.id} onClick={() => { setSelUser(u); loadUserLogs(u.id); }}
                        style={{ borderTop:"1px solid #334155", cursor:"pointer", background: selUser?.id===u.id ? "#263349" : isLoss ? "#2d1515" : "transparent" }}
                        onMouseEnter={e => { if(selUser?.id!==u.id) e.currentTarget.style.background="#1e2d40"; }}
                        onMouseLeave={e => { if(selUser?.id!==u.id) e.currentTarget.style.background=isLoss?"#2d1515":"transparent"; }}>
                        <td style={{ padding:"10px 14px" }}>
                          <p style={{ fontWeight:600, color:"#f1f5f9" }}>{u.name || "—"}</p>
                          <p style={{ fontSize:11, color:"#64748b" }}>{u.email}</p>
                        </td>
                        <td style={{ padding:"10px 14px" }}><PlanBadge plan={u.plan} /></td>
                        <td style={{ padding:"10px 14px", color:"#34d399", fontWeight:600 }}>{INR(rev)}</td>
                        <td style={{ padding:"10px 14px", color:"#f87171" }}>{USD(u.costUsd||0)}</td>
                        <td style={{ padding:"10px 14px", color: profit>=0 ? "#34d399":"#f87171", fontWeight:700 }}>
                          {profit>=0 ? "+" : ""}{INR(profit)}
                          {isLoss && <span style={{ marginLeft:6, fontSize:10 }}>⚠️</span>}
                        </td>
                        <td style={{ padding:"10px 14px", color:"#94a3b8" }}>{u.messageCount || 0}</td>
                        <td style={{ padding:"10px 14px", color:"#64748b", fontSize:11 }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p style={{ textAlign:"center", padding:24, color:"#475569" }}>No users found</p>
              )}
            </div>

            {/* User detail panel */}
            {selUser && (
              <div style={{ marginTop:16, background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div>
                    <p style={{ fontWeight:700, fontSize:16, color:"#f1f5f9" }}>{selUser.name}</p>
                    <p style={{ fontSize:13, color:"#64748b" }}>{selUser.email}</p>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <PlanBadge plan={selUser.plan} />
                    <button onClick={() => setSelUser(null)}
                      style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:18 }}>✕</button>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:16 }}>
                  <StatCard label="Revenue"   value={INR(selUser.revenueInr||0)} color="#a78bfa" />
                  <StatCard label="API Cost"  value={USD(selUser.costUsd||0)} color="#f87171" />
                  <StatCard label="Messages"  value={selUser.messageCount || 0}      color="#60a5fa" />
                  <StatCard label="Expires"   value={selUser.planExpiresAt ? new Date(selUser.planExpiresAt).toLocaleDateString() : "—"} color="#94a3b8" />
                </div>
                <p style={{ fontSize:12, color:"#64748b", marginBottom:8, fontWeight:600 }}>RECENT USAGE LOGS</p>
                {logsLoading ? (
                  <p style={{ color:"#475569", fontSize:13 }}>Loading...</p>
                ) : userLogs.length === 0 ? (
                  <p style={{ color:"#475569", fontSize:13 }}>No logs yet</p>
                ) : (
                  <div style={{ maxHeight:200, overflowY:"auto" }}>
                    {userLogs.slice(0,20).map((log, i) => (
                      <div key={i} style={{ display:"flex", gap:12, padding:"6px 0", borderBottom:"1px solid #334155", fontSize:12 }}>
                        <span style={{ color:"#64748b", minWidth:80 }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                        <span style={{ color:"#94a3b8", minWidth:80 }}>{log.model}</span>
                        <span style={{ color:"#f87171" }}>{USD(log.cost||0)}</span>
                        <span style={{ color:"#64748b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{log.prompt?.slice(0,60)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FLYWHEEL TAB ── */}
        {tab === "flywheel" && (
          <div>
            {!flywheel ? (
              <p style={{ color:"#475569" }}>Loading flywheel stats...</p>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
                  <StatCard label="Cached Q&As"    value={flywheel.totalEntries}         color="#60a5fa" />
                  <StatCard label="Cache Hit Rate"  value={`${flywheel.hitRate}%`}        color="#34d399" sub="last 7 days" />
                  <StatCard label="Cache Hits"      value={flywheel.totalHits}            color="#a78bfa" />
                  <StatCard label="Cache Misses"    value={flywheel.totalMisses}          color="#f87171" />
                  <StatCard label="Est. Savings"    value={`$${flywheel.estimatedSavings}`} color="#34d399" sub="last 7 days" />
                </div>

                {flywheel.topHits?.length > 0 && (
                  <div style={{ background:"#1e293b", borderRadius:12, border:"1px solid #334155", padding:16, marginBottom:16 }}>
                    <p style={{ fontSize:12, color:"#64748b", fontWeight:700, textTransform:"uppercase", marginBottom:12 }}>🔥 Top Cached Questions</p>
                    {flywheel.topHits.map((h, i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #334155", fontSize:13 }}>
                        <span style={{ color:"#94a3b8", flex:1 }}>{h.question}</span>
                        <span style={{ color:"#34d399", fontWeight:700, marginLeft:12 }}>{h.hitCount}x hits</span>
                      </div>
                    ))}
                  </div>
                )}

                {flywheel.dailyStats?.length > 0 && (
                  <div style={{ background:"#1e293b", borderRadius:12, border:"1px solid #334155", padding:16 }}>
                    <p style={{ fontSize:12, color:"#64748b", fontWeight:700, textTransform:"uppercase", marginBottom:12 }}>📊 Daily Hit Rate</p>
                    {flywheel.dailyStats.map((d, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"6px 0", fontSize:12 }}>
                        <span style={{ color:"#64748b", minWidth:80 }}>{new Date(d.date).toLocaleDateString()}</span>
                        <span style={{ color:"#34d399" }}>{d.hits} hits</span>
                        <span style={{ color:"#f87171" }}>{d.misses} misses</span>
                        <div style={{ flex:1, height:6, background:"#334155", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ width:`${d.rate}%`, height:"100%", background:"#34d399", borderRadius:99 }} />
                        </div>
                        <span style={{ color:"#94a3b8", minWidth:35 }}>{d.rate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MODELS TAB ── */}
        {tab === "models" && (
          <div style={{ background:"#1e293b", borderRadius:12, border:"1px solid #334155", padding:20 }}>
            <p style={{ color:"#94a3b8", fontSize:13 }}>Model management coming soon — use Admin API directly for now.</p>
            <p style={{ color:"#64748b", fontSize:12, marginTop:8 }}>
              Backend: <code style={{ background:"#0f172a", padding:"2px 6px", borderRadius:4 }}>GET /api/admin/models</code>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
