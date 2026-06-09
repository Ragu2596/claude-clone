// frontend/src/hooks/useChat.js
// Clean chat hook. Uses api.js for HTTP, sse.js for stream parsing.
// No raw fetch() or SSE parsing here.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth }        from '../context/AuthContext';
import { convApi, projectApi, usageApi, modelApi, startChatStream } from '../services/api.js';
import { parseSSEStream } from '../services/sse.js';

export function useChat() {
  const { user } = useAuth();

  const [conversations,   setConversations]   = useState([]);
  const [activeId,        setActiveId]        = useState(null);
  const [messages,        setMessages]        = useState([]);
  const [streaming,       setStreaming]        = useState(false);
  const [isThinking,      setIsThinking]      = useState(false);
  const [projects,        setProjects]        = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [usage,           setUsage]           = useState(null);
  const [rateLimit,       setRateLimit]       = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [trialExhausted,  setTrialExhausted]  = useState(null);
  const [modelTrials,     setModelTrials]     = useState({});

  const abortRef    = useRef(null);
  const activeIdRef = useRef(null);

  const updateActiveId = (id) => { activeIdRef.current = id; setActiveId(id); };

  // ── Load on login ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadConvs();
    loadProjects();
    loadUsage();
    loadModelTrials();
  }, [user]);

  const loadConvs = useCallback(async (projectId) => {
    try {
      const r = await convApi.list(projectId);
      if (r.ok) setConversations(await r.json());
    } catch {}
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const r = await projectApi.list();
      if (r.ok) setProjects(await r.json());
    } catch {}
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const r = await usageApi.get();
      if (r.ok) setUsage(await r.json());
    } catch {}
  }, []);

  const loadModelTrials = useCallback(async () => {
    try {
      const r = await modelApi.trials();
      if (r.ok) setModelTrials(await r.json());
    } catch {}
  }, []);

  // ── Conversation management ─────────────────────────────────────────────────
  const selectConv = useCallback(async (id) => {
    if (!id) { updateActiveId(null); setMessages([]); return; }
    try {
      const r = await convApi.get(id);
      if (r.ok) { const d = await r.json(); setMessages(d.messages || []); updateActiveId(id); }
    } catch {}
  }, []);

  const createNewConv = useCallback(async (projectId) => {
    try {
      const r = await convApi.create('New Chat', projectId || null);
      if (!r.ok) return null;
      const c = await r.json();
      setConversations(prev => [c, ...prev]);
      setMessages([]);
      updateActiveId(c.id);
      return c.id;
    } catch { return null; }
  }, []);

  const deleteConv = useCallback(async (id) => {
    try {
      await convApi.delete(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeIdRef.current === id) { updateActiveId(null); setMessages([]); }
    } catch {}
  }, []);

  const pinConv = useCallback(async (id, pinned) => {
    try {
      await convApi.patch(id, { pinned });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned } : c));
    } catch {}
  }, []);

  const archiveConv = useCallback(async (id) => {
    try {
      await convApi.patch(id, { archived: true });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeIdRef.current === id) { updateActiveId(null); setMessages([]); }
    } catch {}
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text, file, model) => {
    if (!text?.trim() || streaming) return;

    setUpgradeRequired(false);
    setIsThinking(false);

    let cid = activeIdRef.current;
    if (!cid) {
      cid = await createNewConv(activeProjectId);
      if (!cid) return;
    }

    const userMsgId = 'user_' + Date.now();
    const asstMsgId = 'asst_' + Date.now();

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, fileUrl: file ? URL.createObjectURL(file) : null, fileName: file?.name, fileType: file?.type },
      { id: asstMsgId, role: 'assistant', content: '' },
    ]);
    setStreaming(true);

    let accumulated = '';
    abortRef.current = new AbortController();

    try {
      const res = await startChatStream({
        message: text, conversationId: cid, model, file,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));

        if (err.upgradeRequired) {
          setUpgradeRequired(true);
          throw new Error(err.error);
        }
        if (err.trialExhausted) {
          setTrialExhausted({ modelId: err.modelId });
          setModelTrials(prev => ({ ...prev, [err.modelId]: { used: 3, remaining: 0, exhausted: true } }));
        }
        if (err.limitReached) {
          setRateLimit({ window: err.window, count: err.count, limit: err.limit, retryAt: err.retryAt ? new Date(err.retryAt) : null, dayCount: err.dayCount, dayLimit: err.dayLimit, weekCount: err.weekCount, weekLimit: err.weekLimit, plan: err.plan });
          setUsage({ hourCount: err.dayCount, hourLimit: err.limit, dayCount: err.dayCount, dayLimit: err.dayLimit, weekCount: err.weekCount, weekLimit: err.weekLimit, plan: err.plan });
        }
        throw new Error(err.error || `Server error ${res.status}`);
      }

      // Parse SSE stream via sse.js service
      for await (const { type, data } of parseSSEStream(res)) {
        if (type === 'thinking_start' || data?.type === 'thinking_start') {
          setIsThinking(true);
        }
        if (data?.type === 'text' && data.text) {
          setIsThinking(false);
          accumulated += data.text;
          const snap = accumulated;
          setMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, content: snap } : m));
        }
        if (data?.type === 'title') {
          setConversations(prev => prev.map(c => c.id === cid ? { ...c, title: data.title } : c));
        }
        if (data?.type === 'done') {
          if (data.usage) { setUsage(data.usage); setRateLimit(null); }
          if (data.trial) {
            setModelTrials(prev => ({ ...prev, [data.trial.modelId]: { used: 3 - data.trial.remaining, remaining: data.trial.remaining, exhausted: data.trial.remaining <= 0 } }));
          }
          setMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, streaming: false } : m));
        }
        if (data?.type === 'error') throw new Error(data.error || 'Stream error');
      }

      // Sync final messages from server
      try {
        const r2 = await convApi.get(cid);
        if (r2.ok) {
          const d = await r2.json();
          if (d.messages?.length && d.messages[d.messages.length - 1].role === 'assistant') {
            setMessages(d.messages);
          }
        }
      } catch {}

    } catch (e) {
      if (e.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, content: accumulated || '_(stopped)_', streaming: false } : m));
      } else {
        console.error('sendMessage error:', e);
        setMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, content: '⚠️ ' + e.message, streaming: false } : m));
      }
    } finally {
      setStreaming(false);
      setIsThinking(false);
    }
  }, [streaming, activeProjectId, createNewConv]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setIsThinking(false);
  }, []);

  // ── Projects ────────────────────────────────────────────────────────────────
  const createProject = useCallback(async (name, desc, sysprompt) => {
    try {
      const r = await projectApi.create(name, desc, sysprompt);
      if (!r.ok) return null;
      const p = await r.json();
      setProjects(prev => [p, ...prev]);
      setActiveProjectId(p.id);
      updateActiveId(null);
      setMessages([]);
      await loadConvs(null);
      return p;
    } catch { return null; }
  }, [loadConvs]);

  const deleteProject = useCallback(async (id) => {
    try {
      await projectApi.delete(id);
      setProjects(prev => prev.filter(x => x.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
    } catch {}
  }, [activeProjectId]);

  const handleSetActiveProjectId = useCallback((id) => {
    setActiveProjectId(id);
    updateActiveId(null);
    setMessages([]);
    loadConvs(id);
  }, [loadConvs]);

  return {
    conversations, activeId, messages, streaming, isThinking,
    projects, activeProjectId,
    usage, rateLimit, upgradeRequired, trialExhausted, modelTrials,

    selectConv,
    newConv:            () => createNewConv(activeProjectId),
    deleteConv, pinConv, archiveConv,
    sendMessage, stopStream,
    createProject, deleteProject,
    setActiveProjectId: handleSetActiveProjectId,
    refreshUsage:       loadUsage,
  };
}