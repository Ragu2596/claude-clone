// backend/src/services/modelSync.js
// Auto-discovers new models from all providers daily
// Saves to DB → frontend fetches from /api/models instead of hardcoded list

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Unique name generator ─────────────────────────────────────
// Pools of names — auto-assigned to new models in order
const NAME_POOLS = {
  groq:       ["Spark", "Bolt", "Flare", "Rush", "Dash", "Zap", "Blaze", "Surge", "Zing", "Volt"],
  gemini:     ["Nova", "Stellar", "Comet", "Pulsar", "Nebula", "Quasar", "Vega", "Lyra", "Crest", "Aura"],
  mistral:    ["Breeze", "Storm", "Gale", "Drift", "Mist", "Haze", "Zephyr", "Sirocco", "Squall", "Frost"],
  together:   ["Titan", "Depth", "Orion", "Atlas", "Forge", "Nexus", "Apex", "Zenith", "Rift", "Core"],
  openai:     ["Swift", "Pulse", "Edge", "Crest", "Prime", "Sharp", "Keen", "Ace", "Peak", "Vibe"],
  anthropic:  ["Flash", "Apex", "Prism", "Echo", "Sage", "Lumen", "Fuse", "Arc", "Halo", "Dusk"],
  perplexity: ["Scout", "Trace", "Seek", "Hunt", "Radar", "Probe", "Track", "Scan", "Find", "Quest"],
};

// ── Plan assignment rules by model name keywords ─────────────
function inferPlan(modelId, provider) {
  const id = modelId.toLowerCase();
  if (provider === 'groq' || provider === 'gemini' || provider === 'mistral' || provider === 'together') {
    return null; // free
  }
  // OpenAI
  if (id.includes('mini') || id.includes('nano'))  return 'starter';
  if (id.includes('4o') || id.includes('gpt-4'))   return 'pro';
  if (id.includes('o1') || id.includes('o3'))      return 'max';
  // Anthropic
  if (id.includes('haiku'))   return 'starter';
  if (id.includes('sonnet'))  return 'pro';
  if (id.includes('opus'))    return 'max';
  // Perplexity
  if (id.includes('small'))   return 'starter';
  if (id.includes('large') || id.includes('huge')) return 'pro';
  return 'starter'; // default for paid providers
}

// ── Badge assignment ──────────────────────────────────────────
function inferBadge(modelId, provider) {
  if (provider === 'groq' || provider === 'gemini' || provider === 'mistral' || provider === 'together') return 'FREE';
  if (provider === 'perplexity') return 'WEB';
  const id = modelId.toLowerCase();
  if (id.includes('mini') || id.includes('nano') || id.includes('haiku') || id.includes('small')) return 'FAST';
  if (id.includes('opus') || id.includes('o1') || id.includes('o3')) return 'MAX';
  return 'PRO';
}

// ── Color per provider ────────────────────────────────────────
const PROVIDER_COLORS = {
  groq:       '#16a34a',
  gemini:     '#4285f4',
  mistral:    '#f97316',
  together:   '#8b5cf6',
  openai:     '#10a37f',
  anthropic:  '#f59e0b',
  perplexity: '#06b6d4',
};

// ── Assign unique name to a new model ─────────────────────────
async function assignUniqueName(provider, modelId) {
  // Check if already named
  const existing = await prisma.modelConfig.findUnique({ where: { modelId } });
  if (existing) return existing.displayName;

  // Get all used names for this provider
  const used = await prisma.modelConfig.findMany({
    where: { provider },
    select: { displayName: true },
  });
  const usedNames = new Set(used.map(m => m.displayName));

  // Pick first unused name from pool
  const pool = NAME_POOLS[provider] || NAME_POOLS.openai;
  const name = pool.find(n => !usedNames.has(n)) || `${provider}-${Date.now()}`;
  return name;
}

// ── Fetch models from each provider ──────────────────────────

async function fetchGroqModels() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    const data = await res.json();
    return (data.data || [])
      .filter(m => m.id.includes('llama') || m.id.includes('mixtral') || m.id.includes('gemma'))
      .filter(m => !m.id.includes('whisper') && !m.id.includes('vision-preview'))
      .map(m => ({ modelId: m.id, provider: 'groq', group: 'groq' }));
  } catch (e) {
    console.error('⚠️ Groq model fetch failed:', e.message);
    return [];
  }
}

async function fetchOpenAIModels() {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    const data = await res.json();
    return (data.data || [])
      .filter(m => m.id.startsWith('gpt-4') || m.id.startsWith('o1') || m.id.startsWith('o3'))
      .filter(m => !m.id.includes('preview') && !m.id.includes('instruct') && !m.id.includes('0301') && !m.id.includes('0314'))
      .map(m => ({ modelId: m.id, provider: 'openai', group: 'openai' }));
  } catch (e) {
    console.error('⚠️ OpenAI model fetch failed:', e.message);
    return [];
  }
}

async function fetchAnthropicModels() {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      }
    });
    const data = await res.json();
    return (data.data || [])
      .filter(m => m.id.includes('claude'))
      .map(m => ({ modelId: m.id, provider: 'anthropic', group: 'anthropic' }));
  } catch (e) {
    console.error('⚠️ Anthropic model fetch failed:', e.message);
    return [];
  }
}

// Static models for providers without model list APIs
function getStaticModels() {
  return [
    { modelId: 'gemini-2.0-flash',                         provider: 'gemini',     group: 'gemini'     },
    { modelId: 'gemini-1.5-flash',                         provider: 'gemini',     group: 'gemini'     },
    { modelId: 'gemini-1.5-pro',                           provider: 'gemini',     group: 'gemini'     },
    { modelId: 'mistral-small-latest',                     provider: 'mistral',    group: 'mistral'    },
    { modelId: 'mistral-large-latest',                     provider: 'mistral',    group: 'mistral'    },
    { modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',  provider: 'together',   group: 'together'   },
    { modelId: 'deepseek-ai/DeepSeek-V3',                  provider: 'together',   group: 'together'   },
    { modelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',          provider: 'together',   group: 'together'   },
    { modelId: 'llama-3.1-sonar-small-128k-online',        provider: 'perplexity', group: 'perplexity' },
    { modelId: 'llama-3.1-sonar-large-128k-online',        provider: 'perplexity', group: 'perplexity' },
  ];
}

// ── Main sync function ────────────────────────────────────────
export async function syncModels() {
  console.log('🔄 Syncing models from all providers...');

  const [groqModels, openaiModels, anthropicModels] = await Promise.all([
    fetchGroqModels(),
    fetchOpenAIModels(),
    fetchAnthropicModels(),
  ]);

  const allModels = [...groqModels, ...openaiModels, ...anthropicModels, ...getStaticModels()];
  let newCount = 0;

  for (const m of allModels) {
    const existing = await prisma.modelConfig.findUnique({ where: { modelId: m.modelId } });
    if (existing) continue; // already known

    // New model found! Assign unique name
    const displayName = await assignUniqueName(m.provider, m.modelId);
    const requiredPlan = inferPlan(m.modelId, m.provider);
    const badge = inferBadge(m.modelId, m.provider);
    const color = PROVIDER_COLORS[m.provider] || '#6b7280';

    await prisma.modelConfig.create({
      data: {
        modelId:     m.modelId,
        provider:    m.provider,
        group:       m.group,
        displayName,
        badge,
        color,
        requiredPlan,
        enabled:     true,
        isNew:       true,
      }
    });

    console.log(`✨ New model: ${m.modelId} → "${displayName}" (${m.provider})`);
    newCount++;
  }

  // Mark old "isNew" flags after 7 days
  await prisma.modelConfig.updateMany({
    where: { isNew: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    data:  { isNew: false },
  });

  console.log(`✅ Model sync done — ${newCount} new models added`);
  return newCount;
}

// ── Get all enabled models for frontend ──────────────────────
export async function getEnabledModels() {
  return prisma.modelConfig.findMany({
    where:   { enabled: true },
    orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
  });
}
