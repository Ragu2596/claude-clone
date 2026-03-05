import { createContext, useContext, useState, useEffect, useCallback } from "react";

const Ctx = createContext(null);
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
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
    const msg   = p.get("msg");

    if (token || error) window.history.replaceState({}, "", "/");

    if (token) {
      localStorage.setItem("token", token);
      fetchUser(token);
    } else if (error) {
      const msgs = {
        google_failed:         "Google sign-in failed. Please try again.",
        google_no_user:        "Could not get your Google account. Try again.",
        google_not_configured: "Google login is not set up yet.",
      };
      setOauthError(msgs[error] || msg || "Sign-in failed. Please try again.");
      setLoading(false);
    } else {
      fetchUser();
    }
  }, []);

  const login = async (email, password) => {
    const r = await fetch(`${API}/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("token", d.token);
    setUser(d.user);
  };

  const register = async (name, email, password) => {
    const r = await fetch(`${API}/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("token", d.token);
    setUser(d.user);
  };

  const logout = () => { localStorage.removeItem("token"); setUser(null); };

  // ✅ WARM UP backend first, THEN redirect to Google
  // This ensures backend is awake before Google sends the code back
  const googleLogin = async () => {
    try {
      // 1. Wake up backend (fire and forget — just needs to start)
      const warmupPromise = fetch(`${API}/health`).catch(() => {});

      // 2. Build Google OAuth URL directly (no backend needed for this step)
      const clientId    = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const callbackUrl = `${API}/auth/google/callback`;

      if (clientId) {
        // ✅ BEST: Build URL in frontend — backend never touched for redirect
        const params = new URLSearchParams({
          client_id:     clientId,
          redirect_uri:  callbackUrl,
          response_type: "code",
          scope:         "openid email profile",
          prompt:        "select_account",
          access_type:   "online",
        });
        // Wait for warmup to start (not finish — just initiate the request)
        await Promise.race([warmupPromise, new Promise(r => setTimeout(r, 500))]);
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      } else {
        // Fallback: go through backend (old way)
        await warmupPromise;
        window.location.href = `${API}/auth/google`;
      }
    } catch (e) {
      window.location.href = `${API}/auth/google`;
    }
  };

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
