import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API = "http://localhost:3001";

export function useChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const abortRef = useRef(null);
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

  // keep ref in sync with state
  const updateActiveId = (id) => {
    activeIdRef.current = id;
    setActiveId(id);
  };

  // ── Load data ────────────────────────────────────────────────
  const loadConvs = useCallback(async (pid) => {
    try {
      const url = pid ? `/api/conversations?projectId=${pid}` : `/api/conversations`;
      const r = await apiFetch(url);
      if (r.ok) setConversations(await r.json());
    } catch (e) { console.error("loadConvs:", e); }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const r = await apiFetch("/api/projects");
      if (r.ok) setProjects(await r.json());
    } catch (e) { console.error("loadProjects:", e); }
  }, []);

  useEffect(() => {
    if (user) { loadProjects(); loadConvs(null); }
  }, [user]);

  // ── Conversation actions ──────────────────────────────────────
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat", projectId: pid || null }),
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

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = useCallback(async (text, file, model) => {
    if (!text?.trim()) return;

    // get conversation id - use ref to avoid stale closure
    let cid = activeIdRef.current;
    if (!cid) {
      cid = await createNewConv(activeProjectId);
      if (!cid) { console.error("Failed to create conversation"); return; }
    }

    // Add user message + empty assistant bubble to UI immediately
    const userMsgId = "user_" + Date.now();
    const asstMsgId = "asst_" + Date.now();

    const userMsg = {
      id: userMsgId,
      role: "user",
      content: text,
      fileUrl: file ? URL.createObjectURL(file) : null,
      fileName: file?.name || null,
      fileType: file?.type || null,
    };

    setMessages(prev => [...prev, userMsg, { id: asstMsgId, role: "assistant", content: "" }]);
    setStreaming(true);

    // We use a ref to accumulate streamed content so React batching doesn't lose chunks
    let accumulated = "";

    try {
      const fd = new FormData();
      fd.append("conversationId", cid);
      fd.append("message", text);
      if (model && model !== "auto") fd.append("model", model);
      if (file) fd.append("file", file);

      abortRef.current = new AbortController();

      const res = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { Authorization: "Bearer " + getToken() },
        body: fd,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      // Read SSE stream chunk by chunk
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          let data;
          try { data = JSON.parse(jsonStr); }
          catch (_) { continue; }

          if (data.type === "text" && data.text) {
            accumulated += data.text;
            // Update the assistant bubble in real-time
            const snapshot = accumulated; // capture for closure
            setMessages(prev =>
              prev.map(m => m.id === asstMsgId ? { ...m, content: snapshot } : m)
            );
          }

          if (data.type === "title" && data.title) {
            setConversations(prev =>
              prev.map(c => c.id === cid ? { ...c, title: data.title } : c)
            );
          }

          if (data.type === "error") {
            throw new Error(data.error || "Stream error");
          }
        }
      }

      // Ensure final content is set even if last chunk had no newline
      if (accumulated) {
        setMessages(prev =>
          prev.map(m => m.id === asstMsgId ? { ...m, content: accumulated } : m)
        );
      }

      // Replace temp IDs with real DB IDs (silently, non-critical)
      try {
        const r2 = await apiFetch(`/api/conversations/${cid}`);
        if (r2.ok) {
          const d = await r2.json();
          const msgs = d.messages || [];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
            setMessages(msgs);
          }
        }
      } catch (_) {
        // Not critical - temp IDs are fine
      }

    } catch (e) {
      if (e.name === "AbortError") {
        // User stopped - keep what was streamed
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
    }
  }, [activeProjectId, createNewConv]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  // ── Project actions ───────────────────────────────────────────
  const createProject = useCallback(async (name, desc, sysprompt) => {
    try {
      const r = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, systemPrompt: sysprompt }),
      });
      if (r.ok) { const p = await r.json(); setProjects(prev => [p, ...prev]); return p; }
    } catch (e) { console.error("createProject:", e); }
  }, []);

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
    conversations,
    activeId,
    messages,
    streaming,
    projects,
    activeProjectId,
    selectConv,
    setActiveProjectId: handleSetActiveProjectId,
    newConv: () => createNewConv(activeProjectId),
    deleteConv,
    sendMessage,
    stopStream,
    createProject,
    deleteProject,
  };
}
