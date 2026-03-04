import { createContext, useContext, useState, useEffect, useCallback } from "react";

const Ctx = createContext(null);
const API = "http://localhost:3001";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (tok) => {
    const t = tok || localStorage.getItem("token");
    if (!t) { setLoading(false); return; }
    try {
      const r = await fetch(API + "/auth/me", { headers: { Authorization: "Bearer " + t } });
      if (r.ok) setUser(await r.json());
      else { localStorage.removeItem("token"); setUser(null); }
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("token");
    if (t) { localStorage.setItem("token", t); window.history.replaceState({}, "", "/"); fetchUser(t); }
    else fetchUser();
  }, []);

  const login = async (email, password) => {
    const r = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("token", d.token);
    setUser(d.user);
  };

  const register = async (name, email, password) => {
    const r = await fetch(API + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("token", d.token);
    setUser(d.user);
  };

  const logout = () => { localStorage.removeItem("token"); setUser(null); };
  const googleLogin = () => { window.location.href = API + "/auth/google"; };

  const authFetch = useCallback(async (url, opts = {}) => {
    const t = localStorage.getItem("token");
    const full = url.startsWith("http") ? url : API + url;
    return fetch(full, { ...opts, headers: { ...opts.headers, Authorization: "Bearer " + t } });
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, googleLogin, authFetch }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);