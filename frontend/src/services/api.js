// frontend/src/services/api.js
// All fetch calls in one place. Components/hooks import from here.
// Never call fetch() directly from components.

const API = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('token') || '';
}

async function apiFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : API + path;
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + getToken(), ...opts.headers },
  });
  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email, password)          => apiFetch('/auth/login',    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }),
  register: (name, email, password)    => apiFetch('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) }),
  me:       ()                         => apiFetch('/auth/me'),
};

// ── Conversations ─────────────────────────────────────────────────────────────
export const convApi = {
  list:       (projectId)         => apiFetch(`/api/conversations${projectId ? `?projectId=${projectId}` : ''}`),
  get:        (id)                => apiFetch(`/api/conversations/${id}`),
  create:     (title, projectId) => apiFetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, projectId }) }),
  patch:      (id, data)         => apiFetch(`/api/conversations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  delete:     (id)               => apiFetch(`/api/conversations/${id}`, { method: 'DELETE' }),
  deleteAll:  ()                 => apiFetch('/api/conversations/all', { method: 'DELETE' }),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectApi = {
  list:   ()                               => apiFetch('/api/projects'),
  create: (name, description, systemPrompt) => apiFetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, systemPrompt }) }),
  delete: (id)                             => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
};

// ── Models ────────────────────────────────────────────────────────────────────
export const modelApi = {
  list:   () => apiFetch('/api/models'),
  trials: () => apiFetch('/api/models/trials'),
};

// ── Chat (SSE stream) ─────────────────────────────────────────────────────────
export function startChatStream({ message, conversationId, model, lang, file, signal }) {
  const fd = new FormData();
  fd.append('conversationId', conversationId);
  fd.append('message', message);
  fd.append('model', model || 'auto');
  fd.append('lang', lang || localStorage.getItem('rk-lang') || 'en');
  if (file) fd.append('file', file);

  return fetch(API + '/api/chat', {
    method:  'POST',
    headers: { Authorization: 'Bearer ' + getToken() },
    body:    fd,
    signal,
  });
}

// ── Usage ─────────────────────────────────────────────────────────────────────
export const usageApi = {
  get: () => apiFetch('/api/chat/usage'),
};

// ── Support ───────────────────────────────────────────────────────────────────
export const supportApi = {
  chat: (message, history) => apiFetch('/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history }) }),
};
