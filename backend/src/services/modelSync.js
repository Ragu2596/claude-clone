// backend/src/services/modelSync.js
// Auto-discovers new models from all providers daily.
// Saves to DB → frontend fetches from /api/models instead of hardcoded list.

import prisma  from '../lib/prisma.js';
import { config } from '../config/index.js';

// ── Unique name pools per provider ────────────────────────────────────────────
const NAME_POOLS = {
  groq:       ['Spark', 'Bolt', 'Flare', 'Rush', 'Dash', 'Blaze', 'Surge', 'Zing', 'Volt', 'Zest'],
  gemini:     ['Nova', 'Stellar', 'Comet', 'Pulsar', 'Nebula', 'Quasar', 'Vega', 'Lyra', 'Crest', 'Aura'],
  mistral:    ['Breeze', 'Storm', 'Gale', 'Drift', 'Mist', 'Haze', 'Zephyr', 'Sirocco', 'Squall', 'Frost'],
  together:   ['Titan', 'Depth', 'Orion', 'Atlas', 'Forge', 'Nexus', 'Zenith', 'Rift', 'Core', 'Vortex'],
  openai:     ['Swift', 'Pulse', 'Edge', 'Prime', 'Sharp', 'Keen', 'Ace', 'Peak', 'Vibe', 'Crisp'],
  anthropic:  ['Flash', 'Apex', 'Prism', 'Echo', 'Sage', 'Lumen', 'Fuse', 'Arc', 'Halo', 'Dusk'],
  perplexity: ['Scout', 'Trace', 'Seek', 'Hunt', 'Radar', 'Probe', 'Track', 'Scan', 'Find', 'Quest'],
};

const GROQ_BLOCKLIST = new Set([
  'llama-guard-4-12b', 'llama-prompt-guard-2-22m',
  'llama-prompt-guard-2-86m', 'llama-guard-3-8b',
]);

const ALL_EXCLUDED = [
  'llama-guard-4-12b', 'llama-guard-3-8b',
  'llama-prompt-guard-2-22m', 'llama-prompt-guard-2-86m',
  'whisper-large-v3', 'whisper-large-v3-turbo',
];

const PROVIDER_COLORS = {
  groq: '#16a34a', gemini: '#4285f4', mistral: '#f97316',
  together: '#8b5cf6', openai: '#10a37f', anthropic: '#c96442', perplexity: '#06b6d4',
};

// ── Plan inference ────────────────────────────────────────────────────────────
function inferPlan(modelId, provider) {
  const id = modelId.toLowerCase();
  if (['groq', 'gemini', 'mistral', 'together'].includes(provider)) return null;
  if (provider === 'anthropic') {
    if (id.includes('haiku'))  return 'starter';
    if (id.includes('sonnet')) return 'pro';
    if (id.includes('opus'))   return 'max';
  }
  if (provider === 'openai') {
    if (id.includes('mini') || id.includes('nano')) return 'starter';
    if (id.includes('o1-mini'))                     return 'pro';
    if (id.includes('4o') || id.includes('gpt-4'))  return 'pro';
    if (id.includes('o1') || id.includes('o3'))     return 'max';
  }
  if (provider === 'perplexity') {
    if (id.includes('small'))                          return 'starter';
    if (id.includes('large') || id.includes('huge'))   return 'pro';
  }
  return 'starter';
}

function inferBadge(modelId, provider) {
  if (['groq', 'gemini', 'mistral', 'together'].includes(provider)) return 'FREE';
  if (provider === 'perplexity') return 'WEB';
  const id = modelId.toLowerCase();
  if (id.includes('mini') || id.includes('nano') || id.includes('haiku') || id.includes('small')) return 'FAST';
  if (id.includes('opus') || id.includes('o1') || id.includes('o3')) return 'MAX';
  return 'PRO';
}

// ── Unique name assignment ────────────────────────────────────────────────────
async function assignUniqueName(provider, modelId) {
  const existing = await prisma.modelConfig.findUnique({ where: { modelId } });
  if (existing) return existing.displayName;

  const used      = await prisma.modelConfig.findMany({ where: { provider }, select: { displayName: true } });
  const usedNames = new Set(used.map(m => m.displayName));
  const pool      = NAME_POOLS[provider] || NAME_POOLS.openai;
  return pool.find(n => !usedNames.has(n)) || `${provider}-${Date.now()}`;
}

// ── Live model fetchers ───────────────────────────────────────────────────────
async function fetchGroqModels() {
  try {
    const res  = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${config.groqKey}` } });
    const data = await res.json();
    return (data.data || [])
      .filter(m => (m.id.includes('llama') || m.id.includes('mixtral') || m.id.includes('gemma')) && !m.id.includes('whisper') && !m.id.includes('guard') && !m.id.includes('prompt-guard') && !GROQ_BLOCKLIST.has(m.id))
      .map(m => ({ modelId: m.id, provider: 'groq', group: 'groq' }));
  } catch (e) { console.error('⚠️ Groq model fetch failed:', e.message); return []; }
}

async function fetchOpenAIModels() {
  if (!config.openaiKey) return [];
  try {
    const res  = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${config.openaiKey}` } });
    const data = await res.json();
    return (data.data || [])
      .filter(m => (m.id.startsWith('gpt-4') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('o4')) && !m.id.includes('preview') && !m.id.includes('instruct') && !m.id.includes('0301') && !m.id.includes('0314'))
      .map(m => ({ modelId: m.id, provider: 'openai', group: 'openai' }));
  } catch (e) { console.error('⚠️ OpenAI model fetch failed:', e.message); return []; }
}

async function fetchAnthropicModels() {
  if (!config.anthropicKey) return [];
  try {
    const res  = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' } });
    const data = await res.json();
    return (data.data || [])
      .filter(m => m.id.includes('claude'))
      .map(m => ({ modelId: m.id, provider: 'anthropic', group: 'anthropic' }));
  } catch (e) { console.error('⚠️ Anthropic model fetch failed:', e.message); return []; }
}

// ── Static pinned models — always seeded ─────────────────────────────────────
function getStaticModels() {
  return [
    { modelId: 'claude-haiku-4-5-20251001',               provider: 'anthropic',  group: 'anthropic'  },
    { modelId: 'claude-haiku-4-6',                        provider: 'anthropic',  group: 'anthropic'  },
    { modelId: 'claude-sonnet-4-6',                       provider: 'anthropic',  group: 'anthropic'  },
    { modelId: 'claude-opus-4-6',                         provider: 'anthropic',  group: 'anthropic'  },
    { modelId: 'gpt-4o-mini',                             provider: 'openai',     group: 'openai'     },
    { modelId: 'gpt-4o',                                  provider: 'openai',     group: 'openai'     },
    { modelId: 'o4-mini',                                 provider: 'openai',     group: 'openai'     },
    { modelId: 'o3',                                      provider: 'openai',     group: 'openai'     },
    { modelId: 'o1-mini',                                 provider: 'openai',     group: 'openai'     },
    { modelId: 'gemini-2.0-flash',                        provider: 'gemini',     group: 'gemini'     },
    { modelId: 'gemini-1.5-flash',                        provider: 'gemini',     group: 'gemini'     },
    { modelId: 'gemini-1.5-pro',                          provider: 'gemini',     group: 'gemini'     },
    { modelId: 'mistral-small-latest',                    provider: 'mistral',    group: 'mistral'    },
    { modelId: 'mistral-large-latest',                    provider: 'mistral',    group: 'mistral'    },
    { modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', provider: 'together',   group: 'together'   },
    { modelId: 'deepseek-ai/DeepSeek-V3',                 provider: 'together',   group: 'together'   },
    { modelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',         provider: 'together',   group: 'together'   },
    { modelId: 'llama-3.1-sonar-small-128k-online',       provider: 'perplexity', group: 'perplexity' },
    { modelId: 'llama-3.1-sonar-large-128k-online',       provider: 'perplexity', group: 'perplexity' },
  ];
}

// ── Main sync ─────────────────────────────────────────────────────────────────
export async function syncModels() {
  console.log('🔄 Syncing models...');

  try {
    const disabled = await prisma.modelConfig.updateMany({ where: { modelId: { in: ALL_EXCLUDED } }, data: { enabled: false } });
    if (disabled.count > 0) console.log(`🚫 Disabled ${disabled.count} non-chat models`);
  } catch (e) { console.warn('Could not disable guard models:', e.message); }

  const [groqModels, openaiModels, anthropicModels] = await Promise.all([
    fetchGroqModels(), fetchOpenAIModels(), fetchAnthropicModels(),
  ]);

  const allModels    = [...getStaticModels(), ...groqModels, ...openaiModels, ...anthropicModels];
  const seen         = new Set();
  const uniqueModels = allModels.filter(m => { if (seen.has(m.modelId)) return false; seen.add(m.modelId); return true; });

  let newCount = 0;
  for (const m of uniqueModels) {
    const existing = await prisma.modelConfig.findUnique({ where: { modelId: m.modelId } });
    if (existing) continue;

    const displayName  = await assignUniqueName(m.provider, m.modelId);
    const requiredPlan = inferPlan(m.modelId, m.provider);
    const badge        = inferBadge(m.modelId, m.provider);
    const color        = PROVIDER_COLORS[m.provider] || '#6b7280';

    await prisma.modelConfig.create({
      data: { modelId: m.modelId, provider: m.provider, group: m.group, displayName, badge, color, requiredPlan, enabled: true, isNew: true },
    });
    console.log(`✨ New model: ${m.modelId} → "${displayName}" (${m.provider})`);
    newCount++;
  }

  await prisma.modelConfig.updateMany({
    where: { isNew: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    data:  { isNew: false },
  });

  console.log(`✅ Sync complete — ${newCount} new model(s)`);
  return newCount;
}

// ── Get enabled models for frontend ──────────────────────────────────────────
export async function getEnabledModels() {
  return prisma.modelConfig.findMany({
    where:   { enabled: true },
    orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
  });
}