// backend/src/models/plan.js
// All plan definitions, rate limits, model access, and daily caps.
// Single source of truth — import everywhere you need plan data.

// ── Plan tiers ────────────────────────────────────────────────────────────────
export const PLANS = ['free', 'starter', 'pro', 'max'];

// ── Rate limits — 3 rolling windows, same as Claude ──────────────────────────
export const RATE_LIMITS = {
  free:    { fiveHour: 9999,  daily: 99999,  weekly: 999999  },
  starter: { fiveHour: 30,    daily: 100,    weekly: 500     },
  pro:     { fiveHour: 60,    daily: 500,    weekly: 3000    },
  max:     { fiveHour: 150,   daily: 2000,   weekly: 10000   },
};

// ── Monthly API budgets in micro-dollars (1 USD = 1,000,000 µ$) ──────────────
export const PLAN_BUDGETS = {
  free:    0,
  starter: 3_000_000,   // $3.00  (~₹250)
  pro:     6_000_000,   // $6.00  (~₹500)
  max:     14_000_000,  // $14.00 (~₹1165)
};

// ── Per-model daily caps ──────────────────────────────────────────────────────
export const MODEL_DAILY_LIMITS = {
  'claude-opus-4-6':                       { free: 0, starter: 0,  pro: 0,   max: 20  },
  'claude-sonnet-4-6':                     { free: 0, starter: 0,  pro: 100, max: 300 },
  'claude-sonnet-4-20250514':              { free: 0, starter: 0,  pro: 100, max: 300 },
  'claude-haiku-4-6':                      { free: 0, starter: 50, pro: 999, max: 999 },
  'claude-haiku-4-5-20251001':             { free: 0, starter: 50, pro: 999, max: 999 },
  'o3':                                    { free: 0, starter: 0,  pro: 20,  max: 100 },
  'o4-mini':                               { free: 0, starter: 20, pro: 100, max: 300 },
  'o1-mini':                               { free: 0, starter: 0,  pro: 30,  max: 100 },
  'gpt-4o':                                { free: 0, starter: 0,  pro: 100, max: 300 },
  'gpt-4o-mini':                           { free: 0, starter: 50, pro: 999, max: 999 },
  'llama-3.1-sonar-large-128k-online':     { free: 0, starter: 0,  pro: 50,  max: 200 },
  'llama-3.1-sonar-small-128k-online':     { free: 0, starter: 20, pro: 100, max: 500 },
};

// ── Static fallback model registry ───────────────────────────────────────────
// Used when ModelConfig DB is empty. DB is the source of truth at runtime.
export const STATIC_MODELS = {
  'auto':                                     { provider: 'groq',       id: 'llama-3.3-70b-versatile',                 free: true,  requiredPlan: null      },
  'llama-3.3-70b-versatile':                  { provider: 'groq',       id: 'llama-3.3-70b-versatile',                 free: true,  requiredPlan: null      },
  'mixtral-8x7b-32768':                       { provider: 'groq',       id: 'mixtral-8x7b-32768',                      free: false, requiredPlan: 'starter' },
  'gemini-2.0-flash':                         { provider: 'gemini',     id: 'gemini-2.0-flash',                        free: true,  requiredPlan: null      },
  'gemini-1.5-flash':                         { provider: 'gemini',     id: 'gemini-1.5-flash',                        free: false, requiredPlan: 'starter' },
  'gemini-1.5-pro':                           { provider: 'gemini',     id: 'gemini-1.5-pro',                          free: false, requiredPlan: 'starter' },
  'mistral-small':                            { provider: 'mistral',    id: 'mistral-small-latest',                    free: false, requiredPlan: 'starter' },
  'mistral-large':                            { provider: 'mistral',    id: 'mistral-large-latest',                    free: false, requiredPlan: 'starter' },
  'together-llama':                           { provider: 'together',   id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', free: false, requiredPlan: 'starter' },
  'together-deepseek':                        { provider: 'together',   id: 'deepseek-ai/DeepSeek-V3',                 free: false, requiredPlan: 'starter' },
  'together-qwen':                            { provider: 'together',   id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',         free: false, requiredPlan: 'starter' },
  'perplexity-online':                        { provider: 'perplexity', id: 'llama-3.1-sonar-small-128k-online',       free: false, requiredPlan: 'starter' },
  'perplexity-large-online':                  { provider: 'perplexity', id: 'llama-3.1-sonar-large-128k-online',       free: false, requiredPlan: 'starter' },
  'claude-haiku-4-5-20251001':                { provider: 'anthropic',  id: 'claude-haiku-4-5-20251001',               free: false, requiredPlan: 'starter' },
  'claude-haiku-4-6':                         { provider: 'anthropic',  id: 'claude-haiku-4-6',                        free: false, requiredPlan: 'starter' },
  'gpt-4o-mini':                              { provider: 'openai',     id: 'gpt-4o-mini',                             free: false, requiredPlan: 'starter' },
  'o4-mini':                                  { provider: 'openai',     id: 'o4-mini',                                 free: false, requiredPlan: 'starter' },
  'claude-sonnet-4-20250514':                 { provider: 'anthropic',  id: 'claude-sonnet-4-20250514',                free: false, requiredPlan: 'pro'     },
  'claude-sonnet-4-6':                        { provider: 'anthropic',  id: 'claude-sonnet-4-6',                       free: false, requiredPlan: 'pro'     },
  'gpt-4o':                                   { provider: 'openai',     id: 'gpt-4o',                                  free: false, requiredPlan: 'pro'     },
  'o3':                                       { provider: 'openai',     id: 'o3',                                      free: false, requiredPlan: 'pro'     },
  'claude-opus-4-6':                          { provider: 'anthropic',  id: 'claude-opus-4-6',                         free: false, requiredPlan: 'max'     },
};

export const FREE_FALLBACK_MODEL = STATIC_MODELS['llama-3.3-70b-versatile'];
export const TRIAL_LIMIT = 3;

export const EXCLUDED_MODELS = new Set([
  'llama-guard-4-12b', 'llama-guard-3-8b',
  'llama-prompt-guard-2-22m', 'llama-prompt-guard-2-86m',
  'whisper-large-v3', 'whisper-large-v3-turbo',
]);

// ── Plan access check ─────────────────────────────────────────────────────────
export function planAllowsModel(model, userPlan) {
  if (!model.requiredPlan) return true;
  if (model.requiredPlan === 'starter') return ['starter', 'pro', 'max'].includes(userPlan);
  if (model.requiredPlan === 'pro')     return ['pro', 'max'].includes(userPlan);
  if (model.requiredPlan === 'max')     return userPlan === 'max';
  return false;
}
