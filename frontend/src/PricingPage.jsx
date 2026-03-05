import { useState } from "react";
import { useAuth } from "./context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const plans = [
  {
    id:    "free",
    name:  "Free",
    price: 0,
    desc:  "For personal use",
    color: "#6b7280",
    features: [
      "Groq Llama 3.3 70B (free)",
      "Google Gemini Flash (free)",
      "10 conversations/day",
      "Basic file uploads",
      "Community support",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id:       "pro",
    name:     "Pro",
    price:    999,
    priceUSD: 12,
    desc:     "Research, code, and organize",
    color:    "#c96442",
    popular:  true,
    features: [
      "Everything in Free",
      "GPT-4o & Claude Sonnet",
      "Unlimited conversations",
      "Priority response speed",
      "File uploads up to 50MB",
      "Custom system prompts",
      "Email support",
    ],
    cta: "Upgrade to Pro",
  },
  {
    id:       "max",
    name:     "Max",
    price:    2999,
    priceUSD: 36,
    desc:     "Higher limits, priority access",
    color:    "#7c3aed",
    features: [
      "Everything in Pro",
      "Claude Opus & GPT-4 Turbo",
      "5x more usage than Pro",
      "Highest output limits",
      "Early access to new models",
      "Priority at peak times",
      "Dedicated support",
    ],
    cta: "Upgrade to Max",
  },
];

export default function PricingPage({ onClose }) {
  const { user, authFetch } = useAuth();
  const [billing, setBilling] = useState("monthly"); // monthly | yearly
  const [loading, setLoading] = useState(null);
  const [error, setError]     = useState("");

  const getPrice = (plan) => {
    if (plan.price === 0) return "Free";
    const p = billing === "yearly" ? Math.round(plan.price * 0.83) : plan.price;
    return `₹${p}/mo`;
  };

  const handleUpgrade = async (plan) => {
    if (plan.disabled) return;
    setError("");
    setLoading(plan.id);

    try {
      // 1. Create Razorpay order from backend
      const r = await authFetch("/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id, billing }),
      });
      const order = await r.json();
      if (!r.ok) throw new Error(order.error || "Failed to create order");

      // 2. Open Razorpay checkout
      const options = {
        key:         order.key,
        amount:      order.amount,
        currency:    order.currency,
        name:        "rk.ai",
        description: `${plan.name} Plan`,
        order_id:    order.orderId,
        prefill: {
          name:  user?.name  || "",
          email: user?.email || "",
        },
        theme: { color: plan.color },
        handler: async (response) => {
          // 3. Verify payment on backend
          const vr = await authFetch("/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, plan: plan.id, billing }),
          });
          const vd = await vr.json();
          if (vr.ok && vd.success) {
            alert(`🎉 Welcome to rk.ai ${plan.name}! Your plan is now active.`);
            onClose?.();
            window.location.reload();
          } else {
            setError("Payment verification failed. Please contact support.");
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      };

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = res; s.onerror = rej;
          document.body.appendChild(s);
        });
      }

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#faf8f5", borderRadius: 20, maxWidth: 900, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "40px 32px", position: "relative" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#999", lineHeight: 1 }}>✕</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Plans that grow with you</h1>
          <p style={{ color: "#666", marginTop: 6, fontSize: 15 }}>Choose the right plan for your needs</p>

          {/* Billing toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 0, marginTop: 20, background: "#e8e2da", borderRadius: 10, padding: 3 }}>
            {["monthly", "yearly"].map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{ padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: billing === b ? "#fff" : "transparent", color: billing === b ? "#1a1a1a" : "#666", boxShadow: billing === b ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all .15s" }}>
                {b === "monthly" ? "Monthly" : "Yearly · Save 17%"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 20, color: "#dc2626", fontSize: 13, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Plans */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {plans.map(plan => (
            <div key={plan.id} style={{ background: "#fff", border: `2px solid ${plan.popular ? plan.color : "#e8e2da"}`, borderRadius: 16, padding: "24px 20px", position: "relative", transition: "transform .15s", display: "flex", flexDirection: "column" }}
              onMouseEnter={e => { if (!plan.disabled) e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>

              {plan.popular && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 99, whiteSpace: "nowrap" }}>
                  MOST POPULAR
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{plan.name}</h2>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>{plan.desc}</p>
                <div style={{ fontSize: 30, fontWeight: 800, color: plan.color, letterSpacing: "-0.03em" }}>
                  {getPrice(plan)}
                </div>
                {plan.price > 0 && (
                  <p style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>
                    {billing === "yearly" ? "billed annually" : "billed monthly"}
                    {plan.priceUSD ? ` · ~$${billing === "yearly" ? Math.round(plan.priceUSD * 0.83) : plan.priceUSD} USD` : ""}
                  </p>
                )}
              </div>

              {/* CTA button */}
              <button onClick={() => handleUpgrade(plan)} disabled={plan.disabled || loading === plan.id}
                style={{ width: "100%", padding: "11px", background: plan.disabled ? "#f0f0f0" : plan.color, border: "none", borderRadius: 10, color: plan.disabled ? "#aaa" : "#fff", fontSize: 14, fontWeight: 600, cursor: plan.disabled ? "default" : "pointer", marginBottom: 20, opacity: loading === plan.id ? 0.75 : 1, transition: "all .15s" }}
                onMouseEnter={e => { if (!plan.disabled) e.currentTarget.style.opacity = "0.88"; }}
                onMouseLeave={e => { if (!plan.disabled) e.currentTarget.style.opacity = "1"; }}>
                {loading === plan.id ? "Processing..." : plan.cta}
              </button>

              {/* Features */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {plan.id === "free" ? "Includes" : "Everything in " + (plan.id === "pro" ? "Free" : "Pro") + ", plus:"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flexShrink: 0, marginTop: 1 }}><CheckIcon /></div>
                      <span style={{ fontSize: 13, color: "#444", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 24 }}>
          Payments processed securely by Razorpay · Cancel anytime · GST applicable
        </p>
      </div>
    </div>
  );
}
