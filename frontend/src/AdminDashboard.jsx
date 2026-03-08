// AdminDashboard.jsx
// Route: /admin  (add to App.jsx router, only shows if user.email === ADMIN_EMAIL)
// Shows: revenue vs API cost per user, profit/loss, model usage, budget status

import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL;
const token = () => localStorage.getItem("token");
const apiFetch = (path) =>
  fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());

// ── Helpers ────────────────────────────────────────────────────
const INR = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const USD = (n) => `$${(n || 0).toFixed(4)}`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function PlanBadge({ plan }) {
  const colors = { free: "#94a3b8", starter: "#3b82f6", pro: "#8b5cf6", max: "#f59e0b" };
  return (
    <span style={{ background: colors[plan] || "#ccc", color: "#fff", borderRadius: 99, padding: "2px 9px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
      {plan}
    </span>
  );
}

function Stat({ label, value, sub, color, big }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #e8e2da" }}>
      <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ fontSize: big ? 28 : 22, fontWeight: 800, color: color || "#1e1b18", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 5 }}>{sub}</p>}
    </div>
  );
}

function BudgetBar({ used, limit, pct }) {
  const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: color, fontWeight: 700 }}>{pct}%</span>
        <span style={{ fontSize: 10, color: "#aaa" }}>${(limit / 1e6).toFixed(2)} budget</span>
      </div>
      <div style={{ height: 4, background: "#f0ede8", borderRadius: 99 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 99, transition: "width .3s" }} />
      </div>
    </div>
  );
}

// ── User detail modal ──────────────────────────────────────────
function UserModal({ user, onClose }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    apiFetch(`/api/admin/user/${user.id}/logs`).then(setLogs);
  }, [user.id]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#faf8f5", borderRadius: 18, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e1b18" }}>{user.name}</h2>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>{user.email}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#aaa", cursor: "pointer" }}>✕</button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Stat label="Revenue" value={INR(user.revenueInr)} color="#16a34a" />
          <Stat label="API Cost" value={INR(user.costInr)} sub={USD(user.costUsd)} color="#dc2626" />
          <Stat label="Profit" value={INR(user.profitInr)} color={user.profitInr >= 0 ? "#16a34a" : "#dc2626"} />
        </div>

        {/* Budget */}
        <div style={{ background: "#fff", border: "1px solid #e8e2da", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>Monthly API Budget</p>
          <BudgetBar used={user.apiCostUsed} limit={user.apiCostLimit} pct={user.budgetPct} />
          <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
            Resets: {user.apiCostReset ? new Date(user.apiCostReset).toLocaleDateString() : "—"} •
            Plan: <strong>{user.plan}</strong> •
            Joined: {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Recent API logs */}
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e1b18", marginBottom: 10 }}>Recent API calls (last 50)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {logs.length === 0 && <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: 20 }}>No API calls yet</p>}
          {logs.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: l.fromCache ? "#f0fdf4" : "#fff", border: "1px solid #e8e2da", borderRadius: 8 }}>
              <span style={{ fontSize: 14 }}>{l.fromCache ? "⚡" : "🤖"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.model}</p>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>{l.inputTokens}in + {l.outputTokens}out tokens</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: l.fromCache ? "#16a34a" : "#374151" }}>
                  {l.fromCache ? "FREE" : `$${(l.costMicro / 1e6).toFixed(5)}`}
                </p>
                <p style={{ fontSize: 10, color: "#bbb" }}>{new Date(l.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
// ── Model Manager Modal ───────────────────────────────────────
function ModelManager({ onClose }) {
  const [models,   setModels]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    setLoading(true);
    const data = await apiFetch("/api/models");
    setModels(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    const res = await apiFetch("/api/models/sync");
    // POST needs different fetch
    const r = await fetch(`${API}/api/models/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    }).then(r => r.json());
    setSyncing(false);
    alert(`✅ Sync done — ${r.newCount || 0} new models found`);
    load();
  };

  const saveName = async (id) => {
    await fetch(`${API}/api/models/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: editName }),
    });
    setEditId(null);
    load();
  };

  const toggle = async (id, enabled) => {
    await fetch(`${API}/api/models/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    load();
  };

  const planColors = { null: "#16a34a", starter: "#3b82f6", pro: "#8b5cf6", max: "#f59e0b" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#faf8f5", borderRadius: 18, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e1b18" }}>🤖 Model Manager</h2>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Auto-discovers new models daily. Rename or disable any model.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sync} disabled={syncing} style={{ padding: "8px 16px", background: syncing ? "#e5e7eb" : "#c96442", border: "none", borderRadius: 9, color: syncing ? "#aaa" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {syncing ? "⟳ Syncing..." : "↻ Sync Now"}
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#aaa", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: 40 }}>Loading models...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {models.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: m.enabled ? "#fff" : "#f9fafb", border: "1px solid #e8e2da", borderRadius: 10, opacity: m.enabled ? 1 : 0.5 }}>
                {/* Color dot */}
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: m.color, flexShrink: 0 }} />

                {/* Name (editable) */}
                <div style={{ flex: 1 }}>
                  {editId === m.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        style={{ padding: "4px 8px", border: "1px solid #c96442", borderRadius: 6, fontSize: 13, outline: "none", flex: 1 }}
                        onKeyDown={e => e.key === "Enter" && saveName(m.id)} autoFocus />
                      <button onClick={() => saveName(m.id)} style={{ padding: "4px 10px", background: "#c96442", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditId(null)} style={{ padding: "4px 8px", background: "none", border: "1px solid #e8e2da", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1e1b18" }}>{m.displayName}</span>
                      {m.isNew && <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>NEW</span>}
                      <button onClick={() => { setEditId(m.id); setEditName(m.displayName); }}
                        style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 13, padding: 0 }}>✏️</button>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{m.modelId}</p>
                </div>

                {/* Provider badge */}
                <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>{m.provider}</span>

                {/* Plan */}
                <span style={{ fontSize: 11, fontWeight: 700, color: planColors[m.requiredPlan] || "#16a34a", background: (planColors[m.requiredPlan] || "#16a34a") + "15", borderRadius: 99, padding: "2px 8px", textTransform: "uppercase" }}>
                  {m.requiredPlan || "FREE"}
                </span>

                {/* Toggle */}
                <button onClick={() => toggle(m.id, m.enabled)}
                  style={{ padding: "5px 12px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: m.enabled ? "#dcfce7" : "#f1f5f9", color: m.enabled ? "#16a34a" : "#94a3b8" }}>
                  {m.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [summary,  setSummary]  = useState(null);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");   // "all"|"free"|"starter"|"pro"|"max"|"loss"
  const [sort,     setSort]     = useState("joined"); // "joined"|"revenue"|"cost"|"profit"
  const [selUser,  setSelUser]  = useState(null);
  const [showModels, setShowModels] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [s, u] = await Promise.all([
        apiFetch("/api/admin/summary"),
        apiFetch("/api/admin/users"),
      ]);
      if (s.error) throw new Error(s.error);
      setSummary(s);
      setUsers(u);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = users
    .filter((u) => {
      if (filter === "loss")    return u.profitInr < 0;
      if (filter !== "all")     return u.plan === filter;
      return true;
    })
    .filter((u) =>
      !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
                 u.email?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "revenue") return b.revenueInr  - a.revenueInr;
      if (sort === "cost")    return b.costInr     - a.costInr;
      if (sort === "profit")  return b.profitInr   - a.profitInr;
      return new Date(b.createdAt) - new Date(a.createdAt); // joined
    });

  if (error) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>🔒</p>
      <p style={{ fontSize: 16, color: "#dc2626", fontWeight: 600 }}>{error}</p>
      <p style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>Make sure ADMIN_EMAIL is set in your env vars.</p>
    </div>
  );

  const planFilters = ["all", "free", "starter", "pro", "max", "loss"];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f1eb", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1e1b18", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>rk.ai Admin</p>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>Revenue · Costs · Models</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: "#64748b" }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => setShowModels(true)} style={{ padding: "7px 16px", background: "#374151", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            🤖 Models
          </button>
          <button onClick={load} disabled={loading} style={{ padding: "7px 16px", background: loading ? "#374151" : "#c96442", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "⟳" : "↻ Refresh"}
          </button>
          <a href="/" style={{ padding: "7px 16px", background: "#374151", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            ← App
          </a>
        </div>
      </div>

      <div style={{ padding: "28px 28px 40px", maxWidth: 1200, margin: "0 auto" }}>
        {loading && !summary ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ fontSize: 18, color: "#94a3b8" }}>Loading dashboard...</p>
          </div>
        ) : summary && (
          <>
            {/* KPI grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              <Stat big label="Revenue this month"  value={INR(summary.revenueInr)} color="#16a34a"
                sub={`vs ${INR(summary.lastRevenueInr)} last month`} />
              <Stat big label="API Cost this month" value={INR(summary.costInr)} color="#dc2626"
                sub={`vs ${INR(summary.lastCostInr)} last month`} />
              <Stat big label="Net Profit"          value={INR(summary.profitInr)} color={summary.profitInr >= 0 ? "#16a34a" : "#dc2626"}
                sub={`${summary.marginPct}% margin`} />
              <Stat big label="Total Users"         value={summary.totalUsers}
                sub={`${summary.paidUsers} paying · ${summary.freeUsers} free`} />
            </div>

            {/* Plan breakdown + top models */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
              {/* Plan breakdown */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #e8e2da" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>👥 Users by Plan</p>
                {["free", "starter", "pro", "max"].map((plan) => {
                  const count = summary.planBreakdown?.[plan] || 0;
                  const total = summary.totalUsers || 1;
                  const barPct = Math.round((count / total) * 100);
                  const colors = { free: "#94a3b8", starter: "#3b82f6", pro: "#8b5cf6", max: "#f59e0b" };
                  return (
                    <div key={plan} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: colors[plan] }}>{plan}</span>
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>{count} users</span>
                      </div>
                      <div style={{ height: 6, background: "#f0ede8", borderRadius: 99 }}>
                        <div style={{ width: `${barPct}%`, height: "100%", background: colors[plan], borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top models by cost */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #e8e2da" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>💸 Top Models by Cost (this month)</p>
                {(summary.topModels || []).map((m, i) => (
                  <div key={m.model} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", width: 16 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{m.model.split("/").pop().slice(0, 32)}</p>
                      <p style={{ fontSize: 11, color: "#aaa" }}>{m.calls.toLocaleString()} calls</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{INR(m.costInr)}</span>
                  </div>
                ))}
                {!summary.topModels?.length && <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", paddingTop: 16 }}>No API calls this month yet</p>}
              </div>
            </div>

            {/* User table */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e2da", overflow: "hidden" }}>
              {/* Table controls */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0ede8", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
                  style={{ padding: "7px 12px", border: "1px solid #e8e2da", borderRadius: 8, fontSize: 13, outline: "none", minWidth: 180 }} />

                {/* Plan filter */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {planFilters.map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      style={{ padding: "5px 12px", borderRadius: 99, border: "1px solid #e8e2da", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        background: filter === f ? "#1e1b18" : "#fff", color: filter === f ? "#fff" : "#374151" }}>
                      {f === "loss" ? "🔴 Loss" : f}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <select value={sort} onChange={(e) => setSort(e.target.value)}
                  style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid #e8e2da", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
                  <option value="joined">Sort: Newest</option>
                  <option value="revenue">Sort: Revenue</option>
                  <option value="cost">Sort: API Cost</option>
                  <option value="profit">Sort: Profit</option>
                </select>

                <span style={{ fontSize: 12, color: "#aaa" }}>{filtered.length} users</span>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#faf8f5" }}>
                      {["User", "Plan", "Revenue", "API Cost", "Profit", "Budget Used", "Chats", "Joined"].map((h) => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f0ede8", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.id}
                        onClick={() => setSelUser(u)}
                        style={{ borderBottom: "1px solid #f0ede8", cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#fdfcfa" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#faf0ea"}
                        onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fdfcfa"}>

                        {/* User */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {u.avatar
                              ? <img src={u.avatar} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                              : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#c96442", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>{u.name?.[0]}</div>}
                            <div>
                              <p style={{ fontWeight: 600, color: "#1e1b18" }}>{u.name}</p>
                              <p style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td style={{ padding: "12px 16px" }}>
                          <PlanBadge plan={u.plan} />
                          {u.isExpired && <span style={{ fontSize: 10, color: "#dc2626", marginLeft: 6 }}>EXPIRED</span>}
                        </td>

                        {/* Revenue */}
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#16a34a" }}>
                          {INR(u.revenueInr)}
                        </td>

                        {/* API Cost */}
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: u.costInr > 0 ? "#dc2626" : "#94a3b8" }}>
                          {u.costInr > 0 ? INR(u.costInr) : "—"}
                          {u.costUsd > 0 && <p style={{ fontSize: 10, color: "#bbb" }}>{USD(u.costUsd)}</p>}
                        </td>

                        {/* Profit */}
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontWeight: 700, color: u.profitInr >= 0 ? "#16a34a" : "#dc2626" }}>
                            {u.profitInr >= 0 ? "+" : ""}{INR(u.profitInr)}
                          </span>
                        </td>

                        {/* Budget */}
                        <td style={{ padding: "12px 16px", minWidth: 100 }}>
                          {u.apiCostLimit > 0
                            ? <BudgetBar used={u.apiCostUsed} limit={u.apiCostLimit} pct={u.budgetPct} />
                            : <span style={{ fontSize: 12, color: "#94a3b8" }}>Free models</span>}
                        </td>

                        {/* Chats */}
                        <td style={{ padding: "12px 16px", color: "#374151" }}>
                          {u._count?.conversations || 0}
                        </td>

                        {/* Joined */}
                        <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 12 }}>
                          {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#aaa" }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {selUser && <UserModal user={selUser} onClose={() => setSelUser(null)} />}
      {showModels && <ModelManager onClose={() => setShowModels(false)} />}
    </div>
  );
}
