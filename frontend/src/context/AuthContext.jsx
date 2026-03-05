import { createContext, useContext, useState, useEffect, useCallback } from "react";

const Ctx = createContext(null);

const API       = import.meta.env.VITE_API_URL;
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [oauthError, setOauthError] = useState(null);

  const fetchUser = async (tok) => {
    const t = tok || localStorage.getItem("token");
    if (!t) { setLoading(false); return; }
    try {
      const r = await fetch(`${API}/auth/me`, {
        headers: { Authorization: "Bearer " + t },
      });
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
        google_not_configured: "Google login is not configured.",
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

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const googleLogin = () => {
    // Warm up backend while browser builds URL
    fetch(`${API}/health`).catch(() => {});

    const params = new URLSearchParams({
      client_id:     GOOGLE_ID,
      redirect_uri:  `${API}/auth/google/callback`,
      response_type: "code",
      scope:         "openid email profile",
      prompt:        "select_account",
      access_type:   "online",
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
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
