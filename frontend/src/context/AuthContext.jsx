import { createContext, useContext, useState, useEffect, useCallback } from "react";

const Ctx = createContext(null);

// ✅ Uses production URL automatically — no more localhost!
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState(null);

  const fetchUser = async (tok) => {
    const t = tok || localStorage.getItem("token");
    if (!t) { setLoading(false); return; }
    try {
      const r = await fetch(`${API}/auth/me`, { headers: { Authorization: "Bearer " + t } });
      if (r.ok) setUser(await r.json());
      else { localStorage.removeItem("token"); setUser(null); }
    } catch (e) { localStorage.removeItem("token"); }
    setLoading(false);
  };

  useEffect(() => {
    const p     = new URLSearchParams(window.location.search);
    const token = p.get("token");
    const error = p.get("error");

    // Always clean the URL — removes ?token=xxx or ?error=xxx
    if (token || error) window.history.replaceState({}, "", "/");

    if (token) {
      localStorage.setItem("token", token);
      fetchUser(token);
    } else if (error) {
      const msgs = {
        google_failed:  "Google sign-in failed. Please try again.",
        google_no_user: "Could not get your Google account. Try again.",
        oauth_failed:   "Sign-in was cancelled or failed.",
      };
      setOauthError(msgs[error] || "Sign-in failed. Please try again.");
      setLoading(false);
    } else {
      fetchUser();
    }
  }, []);

  const login = async (email, password) => {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("token", d.token);
    setUser(d.user);
  };

  const register = async (name, email, password) => {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("token", d.token);
    setUser(d.user);
  };

  const logout = () => { localStorage.removeItem("token"); setUser(null); };

  // ✅ Google login goes to PRODUCTION backend, not localhost
  const googleLogin = () => { window.location.href = `${API}/auth/google`; };

  const authFetch = useCallback(async (url, opts = {}) => {
    const t    = localStorage.getItem("token");
    const full = url.startsWith("http") ? url : `${API}${url}`;
    const r    = await fetch(full, {
      ...opts,
      headers: { ...opts.headers, Authorization: "Bearer " + t },
    });
    if (r.status === 401) { logout(); throw new Error("Session expired"); }
    return r;
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, oauthError, setOauthError, login, register, logout, googleLogin, authFetch }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
