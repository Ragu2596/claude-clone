import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL;

export function useChat() {
  const { user } = useAuth();
  const [conversations,    setConversations]    = useState([]);
  const [activeId,         setActiveId]         = useState(null);
  const [messages,         setMessages]         = useState([]);
  const [streaming,        setStreaming]         = useState(false);
  const [projects,         setProjects]         = useState([]);
  const [activeProjectId,  setActiveProjectId]  = useState(null);
  const [usage,            setUsage]            = useState(null);
  const [rateLimit,        setRateLimit]        = useState(null);
  const [upgradeRequired,  setUpgradeRequired]  = useState(false);
  const [trialExhausted,   setTrialExhausted]   = useState(null);
  // ✅ NEW: show "Thinking..." indicator when claude-opus-4-6 uses extended thinking
  const [isThinking,       setIsThinking]       = useState(false);
  // ✅ NEW: trial status map { modelId: { used, remaining, exhausted } }
  const [modelTrials,      setModelTrials]      = useState({});

  const abortRef    = useRef(null);
  const activeIdRef = useRef(null);

  function getToken() {
    return localStorage.getItem("token");
  }

  async function apiFetch(path, opts = {}) {
    const url = path.startsWith("http") ? path : API + path;
    return fetch(url, {
      ...opts,
      headers: { Authorization: "Bearer " + getToken(), ...opts.headers },
    });
  }

  const updateActiveId = (id) => {
    activeIdRef.current = id;
    setActiveId(id);
  };

  const loadConvs = useCallback(async (_pid) => {
    try {
      const r = await apiFetch("/api/conversations");
      if (r.ok) setConversations(await r.json());
    } catch (e) { console.error("loadConvs:", e); }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const r = await apiFetch("/api/projects");
      if (r.ok) setProjects(await r.json());
    } catch (e) { console.error("loadProjects:", e); }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const r = await apiFetch("/api/chat/usage");
      if (r.ok) setUsage(await r.json());
    } catch (e) { console.error("loadUsage:", e); }
  }, []);

  // ✅ NEW: load trial status for all paid models on startup
  const loadModelTrials = useCallback(async () => {
    try {
      const r = await apiFetch("/api/models/trials");
      if (r.ok) setModelTrials(await r.json());
    } catch (e) { console.error("loadModelTrials:", e); }
  }, []);

  useEffect(() => {
    if (user) {
      loadProjects();
      loadConvs(null);
      loadUsage();
      loadModelTrials();
    }
  }, [user]);

  const selectConv = useCallback(async (id) => {
    if (!id) { updateActiveId(null); setMessages([]); return; }
    try {
      const r = await apiFetch(`/api/conversations/${id}`);
      if (r.ok) {
        const d = await r.json();
        setMessages(d.messages || []);
        updateActiveId(id);
      }
    } catch (e) { console.error("selectConv:", e); }
  }, []);

  const createNewConv = useCallback(async (pid) => {
    try {
      const r = await apiFetch("/api/conversations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: "New Chat", projectId: pid || null }),
      });
      if (!r.ok) return null;
      const c = await r.json();
      setConversations(prev => [c, ...prev]);
      setMessages([]);
      updateActiveId(c.id);
      return c.id;
    } catch (e) { console.error("createNewConv:", e); return null; }
  }, []);

  const deleteConv = useCallback(async (id) => {
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeIdRef.current === id) { updateActiveId(null); setMessages([]); }
    } catch (e) { console.error("deleteConv:", e); }
  }, []);

  // ✅ NEW: pin a conversation (shows at top of sidebar like Claude)
  const pinConv = useCallback(async (id, pinned) => {
    try {
      await apiFetch(`/api/conversations/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pinned }),
      });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned } : c));
    } catch (e) { console.error("pinConv:", e); }
  }, []);

  // ✅ NEW: archive a conversation (hide from main list without deleting)
  const archiveConv = useCallback(async (id) => {
    try {
      await apiFetch(`/api/conversations/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ archived: true }),
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeIdRef.current === id) { updateActiveId(null); setMessages([]); }
    } catch (e) { console.error("archiveConv:", e); }
  }, []);

  const sendMessage = useCallback(async (text, file, model) => {
    if (!text?.trim()) return;

    setUpgradeRequired(false);
    setIsThinking(false);  // ✅ reset thinking state

    let cid = activeIdRef.current;
    if (!cid) {
      cid = await createNewConv(activeProjectId);
      if (!cid) { console.error("Failed to create conversation"); return; }
    }

    const userMsgId = "user_" + Date.now();
    const asstMsgId = "asst_" + Date.now();

    const userMsg = {
      id:       userMsgId,
      role:     "user",
      content:  text,
      fileUrl:  file ? URL.createObjectURL(file) : null,
      fileName: file?.name  || null,
      fileType: file?.type  || null,
    };

    setMessages(prev => [...prev, userMsg, { id: asstMsgId, role: "assistant", content: "" }]);
    setStreaming(true);

    let accumulated = "";

    try {
      const fd = new FormData();
      fd.append("conversationId", cid);
      fd.append("message", text);
      fd.append("model", model || "auto");
      fd.append("lang", localStorage.getItem("rk-lang") || "en");
      if (file) fd.append("file", file);

      abortRef.current = new AbortController();

      const res = await fetch(API + "/api/chat", {
        method:  "POST",
        headers: { Authorization: "Bearer " + getToken() },
        body:    fd,
        signal:  abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));

        if (err.upgradeRequired) {
          setUpgradeRequired(true);
          if (err.plan) setUsage(prev => prev ? { ...prev, plan: err.plan } : null);
          throw new Error(err.error || "File uploads require Starter plan or above.");
        }

        if (err.trialExhausted) {
          setTrialExhausted({ modelId: err.modelId });
          // ✅ Update local trial map so UI reflects immediately
          setModelTrials(prev => ({ ...prev, [err.modelId]: { used: 3, remaining: 0, exhausted: true } }));
        }

        if (err.limitReached) {
          setRateLimit({
            window:    err.window,
            count:     err.count,
            limit:     err.limit,
            retryAt:   err.retryAt ? new Date(err.retryAt) : null,
            dayCount:  err.dayCount,
            dayLimit:  err.dayLimit,
            weekCount: err.weekCount,
            weekLimit: err.weekLimit,
            plan:      err.plan,
          });
          setUsage({ hourCount: err.window === 'hourly' ? err.count : err.dayCount, hourLimit: err.limit, dayCount: err.dayCount, dayLimit: err.dayLimit, weekCount: err.weekCount, weekLimit: err.weekLimit, plan: err.plan });
        }

        throw new Error(err.error || `Server error ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;
          let data;
          try { data = JSON.parse(jsonStr); } catch (_) { continue; }

          // ✅ NEW: handle thinking indicator events from claude-opus-4-6
          if (data.type === "thinking_start") {
            setIsThinking(true);
          }

          if (data.type === "text" && data.text) {
            setIsThinking(false);  // thinking done, text starting
            accumulated += data.text;
            const snapshot = accumulated;
            setMessages(prev =>
              prev.map(m => m.id === asstMsgId ? { ...m, content: snapshot } : m)
            );
          }

          if (data.type === "title" && data.title) {
            setConversations(prev =>
              prev.map(c => c.id === cid ? { ...c, title: data.title } : c)
            );
          }

          if (data.type === "done" && data.usage) {
            setUsage(data.usage);
            setRateLimit(null);

            // ✅ Update trial count from server response
            if (data.trial) {
              setModelTrials(prev => ({
                ...prev,
                [data.trial.modelId]: {
                  used:      3 - data.trial.remaining,
                  remaining: data.trial.remaining,
                  exhausted: data.trial.remaining <= 0,
                },
              }));
            }
          }

          if (data.type === "error") {
            throw new Error(data.error || "Stream error");
          }
        }
      }

      if (accumulated) {
        setMessages(prev =>
          prev.map(m => m.id === asstMsgId ? { ...m, content: accumulated } : m)
        );
      }

      // Sync final messages from server to catch any DB-saved content
      try {
        const r2 = await apiFetch(`/api/conversations/${cid}`);
        if (r2.ok) {
          const d    = await r2.json();
          const msgs = d.messages || [];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
            setMessages(msgs);
          }
        }
      } catch (_) {}

    } catch (e) {
      if (e.name === "AbortError") {
        setMessages(prev =>
          prev.map(m =>
            m.id === asstMsgId
              ? { ...m, id: "done_" + Date.now(), content: accumulated || "(stopped)" }
              : m
          )
        );
      } else {
        console.error("sendMessage error:", e);
        setMessages(prev =>
          prev.map(m =>
            m.id === asstMsgId
              ? { ...m, id: "err_" + Date.now(), content: "⚠️ " + e.message }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      setIsThinking(false);
    }
  }, [activeProjectId, createNewConv]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setIsThinking(false);
  }, []);

  const createProject = useCallback(async (name, desc, sysprompt) => {
    try {
      const r = await apiFetch("/api/projects", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, description: desc, systemPrompt: sysprompt }),
      });
      if (r.ok) {
        const p = await r.json();
        setProjects(prev => [p, ...prev]);
        setActiveProjectId(p.id);
        updateActiveId(null);
        setMessages([]);
        await loadConvs(null);
        return p;
      }
    } catch (e) { console.error("createProject:", e); }
  }, [loadConvs]);

  const deleteProject = useCallback(async (id) => {
    try {
      await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects(prev => prev.filter(x => x.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
    } catch (e) { console.error("deleteProject:", e); }
  }, [activeProjectId]);

  const handleSetActiveProjectId = useCallback((id) => {
    setActiveProjectId(id);
    updateActiveId(null);
    setMessages([]);
    loadConvs(id);
  }, [loadConvs]);

  return {
    conversations, activeId, messages, streaming,
    projects, activeProjectId,
    usage,
    rateLimit,
    upgradeRequired,
    trialExhausted,
    isThinking,     // ✅ NEW: show "Thinking..." when opus is reasoning
    modelTrials,    // ✅ NEW: trial status map for all paid models

    selectConv,
    setActiveProjectId: handleSetActiveProjectId,
    newConv:       () => createNewConv(activeProjectId),
    deleteConv,
    pinConv,        // ✅ NEW
    archiveConv,    // ✅ NEW
    sendMessage,
    stopStream,
    createProject,
    deleteProject,
  };
}