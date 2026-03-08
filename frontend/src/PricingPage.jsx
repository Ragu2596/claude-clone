import { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";

const API = import.meta.env.VITE_API_URL;

// ─── local fetch helper (same pattern as useChat.js) ─────────
function useApiFetch() {
  return (path, opts = {}) => {
    const token = localStorage.getItem("token");
    const url   = path.startsWith("http") ? path : API + path;
    return fetch(url, {
      ...opts,
      headers: {
        Authorization: "Bearer " + token,
        ...opts.headers,
      },
    });
  };
}

// ─── Icons ────────────────────────────────────────────────────
const CheckIcon = ({ color = "#16a34a" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ─── Plan definitions ─────────────────────────────────────────
const PLANS = [
  {
    id:    "free",
    name:  "Free",
    badge: null,
    desc:  "Try before you buy",
    color: "#6b7280",
    priceINR: { monthly: 0, yearly: 0 },
    priceUSD: { monthly: 0, yearly: 0 },
    features: [
      { text: "5 messages / day only",           included: true  },
      { text: "Groq & Gemini Flash only",         included: true  },
      { text: "No file uploads",                  included: false },
      { text: "No web search",                    included: false },
      { text: "No GPT-4o Mini / Claude Haiku",    included: false },
      { text: "No GPT-4o / Claude Sonnet",        included: false },
      { text: "No chat history export",           included: false },
      { text: "Priority speed",                   included: false },
    ],
  },
  {
    id:    "starter",
    name:  "Starter",
    badge: "POPULAR",
    desc:  "Best for daily use",
    color: "#f59e0b",
    priceINR: { monthly: 499,  yearly: 3990  },
    priceUSD: { monthly: 5.99, yearly: 47.99 },
    features: [
      { text: "100 messages / day",              included: true  },
      { text: "All free models (Groq, Gemini, Mistral)", included: true  },
      { text: "File uploads (images + PDFs)",    included: true  },
      { text: "Web search (Perplexity)",         included: true  },
      { text: "GPT-4o Mini / Claude Haiku",      included: true  },
      { text: "Full chat history",               included: true  },
      { text: "GPT-4o / Claude Sonnet",          included: false },
      { text: "Priority speed",                  included: false },
    ],
  },
  {
    id:    "pro",
    name:  "Pro",
    badge: "BEST VALUE",
    desc:  "For power users",
    color: "#c96442",
    priceINR: { monthly: 999,  yearly: 7990  },
    priceUSD: { monthly: 11.99, yearly: 95.99 },
    features: [
      { text: "500 messages / day",              included: true  },
      { text: "All free models",                 included: true  },
      { text: "File uploads (images + PDFs)",    included: true  },
      { text: "Web search (Perplexity)",         included: true  },
      { text: "GPT-4o Mini / Claude Haiku",      included: true  },
      { text: "GPT-4o / Claude Sonnet",          included: true  },
      { text: "Full chat history + export",      included: true  },
      { text: "Priority speed",                  included: false },
    ],
  },
  {
    id:    "max",
    name:  "Max",
    badge: "UNLIMITED",
    desc:  "For heavy users & teams",
    color: "#7c3aed",
    priceINR: { monthly: 1999,  yearly: 15990  },
    priceUSD: { monthly: 23.99, yearly: 191.99 },
    features: [
      { text: "Unlimited messages / day",        included: true  },
      { text: "All models including Claude Opus", included: true  },
      { text: "File uploads (images + PDFs)",    included: true  },
      { text: "Web search (Perplexity)",         included: true  },
      { text: "GPT-4o / Claude Sonnet & Opus",   included: true  },
      { text: "Full chat history + export",      included: true  },
      { text: "Priority speed",                  included: true  },
      { text: "Early access to new models",      included: true  },
    ],
  },
];

const PLAN_RANK = { free: 0, starter: 1, pro: 2, max: 3 };

export default function PricingPage({ onClose }) {
  const { user }   = useAuth();
  const apiFetch   = useApiFetch();            // ✅ uses JWT from localStorage
  // Default billing tab to what user actually paid for
  const savedBilling = localStorage.getItem("planBilling") || "monthly";
  const [billing,  setBilling]  = useState(savedBilling);
  const [currency, setCurrency] = useState("INR");
  const [loading,  setLoading]  = useState(null);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const currentPlan    = user?.plan || "free";
  const [currentBilling, setCurrentBilling] = useState(
    user?.plan === "free" ? "monthly" : (localStorage.getItem("planBilling") || "monthly")
  );

  // Sync billing period from backend on open — source of truth
  // This fixes existing users who paid before planBilling was saved to localStorage
  useEffect(() => {
    if (!user || user.plan === "free") return;
    const token = localStorage.getItem("token");
    fetch(`${import.meta.env.VITE_API_URL}/payments/my-billing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.billing) {
          setCurrentBilling(d.billing);   // mark their actual paid billing
          setBilling(d.billing);           // also switch the tab to match
          localStorage.setItem("planBilling", d.billing);
        }
      })
      .catch(() => {}); // silently fallback to localStorage value
  }, [user]);

  const fmt = (plan) => {
    const p = currency === "INR" ? plan.priceINR : plan.priceUSD;
    const v = billing === "yearly" ? p.yearly : p.monthly;
    if (v === 0) return "Free";
    return currency === "INR" ? `₹${v}` : `$${v}`;
  };

  const perMonthLabel = (plan) => {
    if (plan.id === "free" || billing !== "yearly") return null;
    const p = currency === "INR" ? plan.priceINR : plan.priceUSD;
    return currency === "INR"
      ? `₹${Math.round(p.yearly / 12)}/mo billed yearly`
      : `$${(p.yearly / 12).toFixed(2)}/mo billed yearly`;
  };

  const savingsLabel = (plan) => {
    if (plan.id === "free" || billing !== "yearly") return null;
    const p = currency === "INR" ? plan.priceINR : plan.priceUSD;
    const saved = (p.monthly * 12) - p.yearly;
    return currency === "INR" ? `Save ₹${saved}` : `Save $${saved.toFixed(2)}`;
  };

  const loadRazorpay = () => new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = res;
    s.onerror = () => rej(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(s);
  });

  const handleUpgrade = async (plan) => {
    if (plan.id === "free" || plan.id === currentPlan || loading) return;
    setError(""); setSuccess(""); setLoading(plan.id);

    try {
      // ✅ Create Razorpay order
      const r = await apiFetch("/payments/create-order", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: plan.id, billing }),
      });

      const order = await r.json();
      if (!r.ok) throw new Error(order.detail || order.error || "Failed to create order");

      await loadRazorpay();

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         order.key,
          amount:      order.amount,
          currency:    order.currency || "INR",
          name:        "rk.ai",
          description: `${plan.name} Plan — ${billing === "yearly" ? "Yearly" : "Monthly"}`,
          order_id:    order.orderId,
          prefill:     { name: user?.name || "", email: user?.email || "" },
          theme:       { color: plan.color },

          handler: async (response) => {
            try {
              setLoading("verifying");
              // ✅ Verify payment
              const vr = await apiFetch("/payments/verify", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                  plan:    plan.id,
                  billing: billing,
                }),
              });
              const vd = await vr.json();
              if (vr.ok && vd.success) {
                // ✅ Save billing period so "YOUR PLAN" badge shows correctly
                localStorage.setItem("planBilling", billing);
                setSuccess(`🎉 Welcome to rk.ai ${plan.name}! Your plan is now active.`);
                resolve();
                setTimeout(() => { onClose?.(); window.location.reload(); }, 2000);
              } else {
                reject(new Error(vd.error || vd.detail || "Verification failed"));
              }
            } catch (e) { reject(e); }
          },

          modal: { ondismiss: () => resolve() },
        });

        rzp.on("payment.failed", (resp) => {
          reject(new Error(resp.error?.description || "Payment failed"));
        });
        rzp.open();
      });

    } catch (e) {
      console.error("Payment error:", e);
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      if (loading !== "verifying") setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose?.(); }}>

      <div style={{ background: "#faf8f5", borderRadius: 22, maxWidth: 940, width: "100%", maxHeight: "95vh", overflowY: "auto", padding: "36px 28px", position: "relative", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>

        {/* Close */}
        <button
          onClick={() => !isLoading && onClose?.()}
          disabled={isLoading}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: isLoading ? "default" : "pointer", fontSize: 22, color: "#999", lineHeight: 1, padding: 6 }}>
          ✕
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Affordable AI for Everyone 🇮🇳
          </h1>
          <p style={{ color: "#666", fontSize: 14, maxWidth: 420, margin: "0 auto" }}>
            Built for Indian developers — way cheaper than ChatGPT or Claude
          </p>

          {/* Toggles */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            {/* Currency */}
            <div style={{ display: "inline-flex", background: "#e8e2da", borderRadius: 10, padding: 3, border: "1px solid #ddd7ce" }}>
              {[["INR", "₹ INR"], ["USD", "$ USD"]].map(([val, label]) => (
                <button key={val} onClick={() => setCurrency(val)} style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: currency === val ? "#fff" : "transparent", color: currency === val ? "#1a1a1a" : "#888", boxShadow: currency === val ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all .15s" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Billing */}
            <div style={{ display: "inline-flex", background: "#e8e2da", borderRadius: 10, padding: 3, border: "1px solid #ddd7ce" }}>
              {[["monthly", "Monthly"], ["yearly", "Yearly"]].map(([val, label]) => (
                <button key={val} onClick={() => setBilling(val)} style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, background: billing === val ? "#fff" : "transparent", color: billing === val ? "#1a1a1a" : "#888", boxShadow: billing === val ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all .15s" }}>
                  {label}
                  {val === "yearly" && <span style={{ fontSize: 9, fontWeight: 800, background: "#16a34a", color: "#fff", borderRadius: 99, padding: "1px 6px" }}>2 FREE</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Banners */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13, textAlign: "center" }}>
            ❌ {error}
          </div>
        )}
        {success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#16a34a", fontSize: 13, textAlign: "center" }}>
            {success}
          </div>
        )}
        {loading === "verifying" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#92400e", fontSize: 13, textAlign: "center" }}>
            ⏳ Verifying your payment, please wait...
          </div>
        )}

        {/* Plan Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {PLANS.map(plan => {
            // "YOUR PLAN" only when plan AND billing both match what user actually paid for
            const isCurrent    = plan.id === currentPlan && (plan.id === "free" || billing === currentBilling);
            const isUpgrade    = PLAN_RANK[plan.id] > PLAN_RANK[currentPlan];
            const isDowngrade  = PLAN_RANK[plan.id] < PLAN_RANK[currentPlan] && plan.id !== "free";
            const isProcessing = loading === plan.id;
            const monthlyStr   = perMonthLabel(plan);
            const saveStr      = savingsLabel(plan);

            // Button label logic
            const btnLabel = isProcessing           ? "Opening…"
              : loading === "verifying"             ? "Verifying…"
              : isCurrent                           ? "✓ Active"
              : plan.id === "free"                  ? "Free Forever"
              : isDowngrade                         ? `Switch to ${plan.name}`
              : `Get ${plan.name}`;

            const btnBg = isCurrent   ? `${plan.color}18`
              : isUpgrade             ? plan.color
              : isDowngrade           ? "#f3f4f6"
              : "#f3f4f6";

            const btnColor = isCurrent   ? plan.color
              : isUpgrade              ? "#fff"
              : isDowngrade            ? "#6b7280"
              : "#9ca3af";

            const btnDisabled = isCurrent || isLoading || plan.id === "free";

            return (
              <div key={plan.id}
                style={{ background: "#fff", border: `2px solid ${isCurrent ? plan.color : "#e8e2da"}`, borderRadius: 16, padding: "22px 16px", display: "flex", flexDirection: "column", position: "relative", boxShadow: isCurrent ? `0 4px 20px ${plan.color}25` : "0 2px 8px rgba(0,0,0,0.05)", transition: "transform .2s, box-shadow .2s, border-color .2s", cursor: isCurrent ? "default" : "pointer" }}
                onMouseEnter={e => {
                  if (!isCurrent) {
                    e.currentTarget.style.transform    = "translateY(-5px)";
                    e.currentTarget.style.boxShadow    = `0 12px 32px ${plan.color}40`;
                    e.currentTarget.style.borderColor  = plan.color;
                    e.currentTarget.style.background   = `${plan.color}06`;
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform   = "translateY(0)";
                  e.currentTarget.style.boxShadow   = isCurrent ? `0 4px 20px ${plan.color}25` : "0 2px 8px rgba(0,0,0,0.05)";
                  e.currentTarget.style.borderColor = isCurrent ? plan.color : "#e8e2da";
                  e.currentTarget.style.background  = "#fff";
                }}>

                {/* Badge */}
                {(plan.badge || isCurrent) && (
                  <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 99, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    {isCurrent ? "✓ YOUR PLAN" : plan.badge}
                  </div>
                )}

                <div style={{ marginTop: (plan.badge || isCurrent) ? 8 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: plan.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>{plan.name}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: "#888", marginBottom: 14 }}>{plan.desc}</p>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: plan.id === "free" ? "#6b7280" : plan.color, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {fmt(plan)}
                    {plan.id !== "free" && <span style={{ fontSize: 12, fontWeight: 500, color: "#aaa" }}>/{billing === "yearly" ? "yr" : "mo"}</span>}
                  </div>
                  {monthlyStr && <div style={{ fontSize: 10.5, color: "#888",    marginTop: 3 }}>{monthlyStr}</div>}
                  {saveStr    && <div style={{ fontSize: 10.5, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>{saveStr} 🎉</div>}
                  {plan.id === "free" && <div style={{ fontSize: 10.5, color: "#aaa", marginTop: 3 }}>No card needed</div>}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={btnDisabled}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, marginBottom: 18, transition: "all .15s", cursor: btnDisabled ? "default" : "pointer", background: btnBg, color: btnColor, opacity: isProcessing ? 0.75 : 1 }}
                  onMouseEnter={e => {
                    if (!btnDisabled) {
                      e.currentTarget.style.opacity   = "0.88";
                      e.currentTarget.style.transform = "scale(1.02)";
                      e.currentTarget.style.boxShadow = `0 4px 14px ${plan.color}55`;
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity   = "1";
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}>
                  {btnLabel}
                </button>

                {/* Features */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {f.included ? <CheckIcon color={plan.color} /> : <XIcon />}
                      </div>
                      <span style={{ fontSize: 12, color: f.included ? "#333" : "#bbb", lineHeight: 1.45 }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11.5, color: "#aaa", lineHeight: 1.8 }}>
          <p>🔒 Secure payments via Razorpay &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; GST applicable</p>
          <p>Prices in {currency === "INR" ? "Indian Rupees (₹)" : "US Dollars ($)"} &nbsp;·&nbsp; Limits reset daily at midnight</p>
        </div>
      </div>
    </div>
  );
}
