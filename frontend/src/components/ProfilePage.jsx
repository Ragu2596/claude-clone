import { useState } from "react";

const LogOutIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);

export default function ProfilePage({ user, onClose, onLogout }) {
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #d1d5db",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#0d0d0d" }}>
            Account
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "#9ca3af",
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* User Avatar & Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 32,
              paddingBottom: 24,
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#ff6b35",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 600, color: "#0d0d0d" }}>
                {user?.name || user?.email?.split("@")[0] || "User"}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#565869" }}>
                {user?.email || "No email"}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#9ca3af" }}>
                Plan: <strong>{user?.plan || "Free"}</strong>
              </p>
            </div>
          </div>

          {/* Account Info */}
          <div style={{ marginBottom: 32 }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#565869" }}>
              Account Details
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#565869", fontWeight: 500 }}>Email</span>
                <span style={{ fontSize: 13, color: "#0d0d0d", fontWeight: 500 }}>{user?.email}</span>
              </div>
              <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#565869", fontWeight: 500 }}>Plan</span>
                <span style={{ fontSize: 13, color: "#0d0d0d", fontWeight: 500 }}>{user?.plan || "Free"}</span>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div style={{ paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
            <button
              onClick={onLogout}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#ffffff",
                border: "1px solid #ef4444",
                borderRadius: 6,
                color: "#ef4444",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fef2f2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              <LogOutIcon size={16} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}