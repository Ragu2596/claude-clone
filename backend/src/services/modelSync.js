// backend/src/services/modelSync.js
// Auto-discovers new models from all providers daily
// Saves to DB → frontend fetches from /api/models instead of hardcoded list

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Unique name pools per provider ───────────────────────────
const NAME_POOLS = {
  groq:       ["Spark", "Bolt", "Flare", "Rush", "Dash", "Blaze", "Surge", "Zing", "Volt", "Zest"],
  gemini:     ["Nova", "Stellar", "Comet", "Pulsar", "Nebula", "Quasar", "Vega", "Lyra", "Crest", "Aura"],
  mistral:    ["Breeze", "Storm", "Gale", "Drift", "Mist", "Haze", "Zephyr", "Sirocco", "Squall", "Frost"],
  together:   ["Titan", "Depth", "Orion", "Atlas", "Forge", "Nexus", "Zenith", "Rift", "Core", "Vortex"],
  openai:     ["Swift", "Pulse", "Edge", "Prime", "Sharp", "Keen", "Ace", "Peak", "Vibe", "Crisp"],
  anthropic:  ["Flash", "Apex", "Prism", "Echo", "Sage", "Lumen", "Fuse", "Arc", "Halo", "Dusk"],
  perplexity: ["Scout", "Trace", "Seek", "Hunt", "Radar", "Probe", "Track", "Scan", "Find", "Quest"],
};

// ── Groq models to always exclude (safety/moderation — not chat models) ──
const GROQ_BLOCKLIST = new Set([
  'llama-guard-4-12b',
  'llama-prompt-guard-2-22m',
  'llama-prompt-guard-2-86m',
  'llama-guard-3-8b',
]);

// ── Plan assignment ───────────────────────────────────────────
function inferPlan(modelId, provider) {
  const id = modelId.toLowerCase();

  // Free providers
  if (['groq', 'gemini', 'mistral', 'together'].includes(provider)) return null;

  // Anthropic
  if (id.includes('haiku'))  return 'starter';
  if (id.includes('sonnet')) return 'pro';
  if (id.includes('opus'))   return 'max';

  // OpenAI
  if (id.includes('mini') || id.includes('nano'))  return 'starter';
  if (id.includes('o1-mini'))                       return 'pro';
  if (id.includes('4o') || id.includes('gpt-4'))   return 'pro';
  if (id.includes('o1') || id.includes('o3'))      return 'max';

  // Perplexity
  if (id.includes('small'))                         return 'starter';
  if (id.includes('large') || id.includes('huge')) return 'pro';

  return 'starter';
}

// ── Badge assignment ──────────────────────────────────────────
function inferBadge(modelId, provider) {
  if (['groq', 'gemini', 'mistral', 'together'].includes(provider)) return 'FREE';
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
  anthropic:  '#c96442',
  perplexity: '#06b6d4',
};

// ── Assign unique display name to a new model ─────────────────
async function assignUniqueName(provider, modelId) {
  const existing = await prisma.modelConfig.findUnique({ where: { modelId } });
  if (existing) return existing.displayName;

  const used = await prisma.modelConfig.findMany({
    where:  { provider },
    select: { displayName: true },
  });
  const usedNames = new Set(used.map(m => m.displayName));

  const pool = NAME_POOLS[provider] || NAME_POOLS.openai;
  const name = pool.find(n => !usedNames.has(n)) || `${provider}-${Date.now()}`;
  return name;
}

// ── Fetch live models from providers ─────────────────────────

async function fetchGroqModels() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    const data = await res.json();
    return (data.data || [])
      .filter(m =>
        (m.id.includes('llama') || m.id.includes('mixtral') || m.id.includes('gemma')) &&
        !m.id.includes('whisper') &&
        !m.id.includes('vision-preview') &&
        !m.id.includes('guard') &&
        !m.id.includes('prompt-guard') &&
        !GROQ_BLOCKLIST.has(m.id)
      )
      .map(m => ({ modelId: m.id, provider: 'groq', group: 'groq' }));
  } catch (e) {
    console.error('⚠️  Groq model fetch failed:', e.message);
    return [];
  }
}

async function fetchOpenAIModels() {
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY not set — using static OpenAI models only');
    return [];
  }
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    const data = await res.json();
    return (data.data || [])
      .filter(m =>
        (m.id.startsWith('gpt-4') || m.id.startsWith('o1') || m.id.startsWith('o3')) &&
        !m.id.includes('preview') &&
        !m.id.includes('instruct') &&
        !m.id.includes('0301') &&
        !m.id.includes('0314')
      )
      .map(m => ({ modelId: m.id, provider: 'openai', group: 'openai' }));
  } catch (e) {
    console.error('⚠️  OpenAI model fetch failed:', e.message);
    return [];
  }
}

async function fetchAnthropicModels() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  ANTHROPIC_API_KEY not set — using static Anthropic models only');
    return [];
  }
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
    console.error('⚠️  Anthropic model fetch failed:', e.message);
    return [];
  }
}

// ── Static models — always seeded regardless of API fetch ─────
function getStaticModels() {
  return [
    // ── Anthropic (pinned) ────────────────────────────────────
    { modelId: 'claude-haiku-4-5-20251001', provider: 'anthropic',  group: 'anthropic'  }, // Flash  → starter
    { modelId: 'claude-sonnet-4-6',         provider: 'anthropic',  group: 'anthropic'  }, // Apex   → pro
    { modelId: 'claude-opus-4-6',           provider: 'anthropic',  group: 'anthropic'  }, // Prism  → max

    // ── OpenAI (pinned) ───────────────────────────────────────
    { modelId: 'gpt-4o-mini',              provider: 'openai',     group: 'openai'     }, // Swift  → starter
    { modelId: 'gpt-4o',                   provider: 'openai',     group: 'openai'     }, // Pulse  → pro
    { modelId: 'o1-mini',                  provider: 'openai',     group: 'openai'     }, // Edge   → pro

    // ── Gemini ────────────────────────────────────────────────
    { modelId: 'gemini-2.0-flash',         provider: 'gemini',     group: 'gemini'     }, // Nova    → free
    { modelId: 'gemini-1.5-flash',         provider: 'gemini',     group: 'gemini'     }, // Stellar → free
    { modelId: 'gemini-1.5-pro',           provider: 'gemini',     group: 'gemini'     }, // Comet   → free

    // ── Mistral ───────────────────────────────────────────────
    { modelId: 'mistral-small-latest',     provider: 'mistral',    group: 'mistral'    }, // Breeze → free
    { modelId: 'mistral-large-latest',     provider: 'mistral',    group: 'mistral'    }, // Storm  → free

    // ── Together AI ───────────────────────────────────────────
    { modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', provider: 'together', group: 'together' }, // Titan → free
    { modelId: 'deepseek-ai/DeepSeek-V3',                 provider: 'together', group: 'together' }, // Depth → free
    { modelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',         provider: 'together', group: 'together' }, // Orion → free

    // ── Perplexity ────────────────────────────────────────────
    { modelId: 'llama-3.1-sonar-small-128k-online', provider: 'perplexity', group: 'perplexity' }, // Scout → starter
    { modelId: 'llama-3.1-sonar-large-128k-online', provider: 'perplexity', group: 'perplexity' }, // Trace → pro
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

  // Static first (higher priority) → live-fetched after
  const allModels = [...getStaticModels(), ...groqModels, ...openaiModels, ...anthropicModels];

  // Deduplicate — static wins over API-fetched
  const seen = new Set();
  const uniqueModels = allModels.filter(m => {
    if (seen.has(m.modelId)) return false;
    seen.add(m.modelId);
    return true;
  });

  let newCount = 0;

  for (const m of uniqueModels) {
    const existing = await prisma.modelConfig.findUnique({ where: { modelId: m.modelId } });
    if (existing) continue;

    const displayName  = await assignUniqueName(m.provider, m.modelId);
    const requiredPlan = inferPlan(m.modelId, m.provider);
    const badge        = inferBadge(m.modelId, m.provider);
    const color        = PROVIDER_COLORS[m.provider] || '#6b7280';

    await prisma.modelConfig.create({
      data: {
        modelId:      m.modelId,
        provider:     m.provider,
        group:        m.group,
        displayName,
        badge,
        color,
        requiredPlan,
        enabled:      true,
        isNew:        true,
      }
    });

    console.log(`✨ New model: ${m.modelId} → "${displayName}" (${m.provider})`);
    newCount++;
  }

  // Clear isNew flag after 7 days
  await prisma.modelConfig.updateMany({
    where: { isNew: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    data:  { isNew: false },
  });

  console.log(`✅ Model sync complete — ${newCount} new model(s) added`);
  return newCount;
}

// ── Get all enabled models for frontend ──────────────────────
export async function getEnabledModels() {
  return prisma.modelConfig.findMany({
    where:   { enabled: true },
    orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
  });
}