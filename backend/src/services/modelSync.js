// backend/src/services/modelSync.js
// Fetches ALL Claude models from Anthropic API automatically.
// New models (claude-opus-5, claude-sonnet-5, etc.) appear the next day.
// No other providers — Claude only.

import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';

// ── Plan inference from model ID ──────────────────────────────
// Anthropic naming convention: haiku=fast/cheap, sonnet=balanced, opus=powerful
function inferPlan(modelId) {
  const id = clean.toLowerCase();
  if (id.includes('haiku'))  return 'starter';
  if (id.includes('sonnet')) return 'pro';
  if (id.includes('opus'))   return 'max';
  // Future model names we don't know yet — default to pro
  return 'pro';
}

function inferBadge(modelId) {
  const id = clean.toLowerCase();
  if (id.includes('haiku'))  return 'FAST';
  if (id.includes('sonnet')) return 'PRO';
  if (id.includes('opus'))   return 'MAX';
  return 'PRO';
}

// Human-friendly display names — maps model ID patterns to clean names
function inferDisplayName(modelId) {
  // Remove date suffix: claude-sonnet-4-20250514 → claude-sonnet-4
  const clean = modelId.replace(/-\d{8}$/, '').replace(/-\d{10}$/, '');
  const id = clean.toLowerCase();
  // Extract version number if present e.g. claude-sonnet-4-6 → "Sonnet 4.6"
  const versionMatch = modelId.match(/(\d+)-(\d+)(?:-(\d+))?/);
  const version = versionMatch
    ? `${versionMatch[1]}.${versionMatch[2]}${versionMatch[3] ? '.' + versionMatch[3] : ''}`
    : '';

  if (id.includes('opus'))   return version ? `Opus ${version}`   : 'Opus';
  if (id.includes('sonnet')) return version ? `Sonnet ${version}` : 'Sonnet';
  if (id.includes('haiku'))  return version ? `Haiku ${version}`  : 'Haiku';
  return clean.replace('claude-', '').replace(/-/g, ' ');
}

// Models to always exclude (non-chat models)
const EXCLUDED = new Set([
  'claude-instant-1',
  'claude-instant-1.2',
]);

// ── Fetch live from Anthropic API ─────────────────────────────
async function fetchAnthropicModels() {
  if (!config.anthropicKey) {
    console.warn('[modelSync] ANTHROPIC_API_KEY not set — using static fallback');
    return [];
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key':         config.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      console.error(`[modelSync] Anthropic API error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.data || [])
      .filter(m => m.id.startsWith('claude-') && !EXCLUDED.has(m.id))
      .map(m => ({ modelId: m.id, createdAt: m.created_at }));
  } catch (e) {
    console.error('[modelSync] Fetch failed:', e.message);
    return [];
  }
}

// ── Static fallback — always seeded on first run ──────────────
// These are updated whenever we deploy. Live sync adds new ones automatically.
function getStaticModels() {
  return [
    // MAX tier — most powerful
    { modelId: 'claude-opus-4-6',          plan: 'max',     badge: 'MAX',  name: 'Opus 4.6'   },
    // PRO tier — best balance
    { modelId: 'claude-sonnet-4-6',        plan: 'pro',     badge: 'PRO',  name: 'Sonnet 4.6' },
    { modelId: 'claude-sonnet-4-20250514', plan: 'pro',     badge: 'PRO',  name: 'Sonnet 4'   },
    // STARTER tier — fast & affordable
    { modelId: 'claude-haiku-4-6',         plan: 'starter', badge: 'FAST', name: 'Haiku 4.6'  },
    { modelId: 'claude-haiku-4-5-20251001',plan: 'starter', badge: 'FAST', name: 'Haiku 4.5'  },
  ];
}

// ── Main sync function ────────────────────────────────────────
export async function syncModels() {
  console.log('[modelSync] Starting Claude model sync...');

  const liveModels   = await fetchAnthropicModels();
  const staticModels = getStaticModels();

  // Merge: live models take priority, static fills gaps
  const seen    = new Set();
  const allModels = [];

  for (const m of liveModels) {
    if (!seen.has(m.modelId)) { seen.add(m.modelId); allModels.push({ modelId: m.modelId }); }
  }
  for (const m of staticModels) {
    if (!seen.has(m.modelId)) { seen.add(m.modelId); allModels.push({ modelId: m.modelId }); }
  }

  let newCount = 0;

  for (const { modelId } of allModels) {
    const existing = await prisma.modelConfig.findUnique({ where: { modelId } });
    if (existing) continue; // already in DB — skip

    // New model found — determine its properties
    const staticDef = staticModels.find(s => s.modelId === modelId);
    const plan        = staticDef?.plan  || inferPlan(modelId);
    const badge       = staticDef?.badge || inferBadge(modelId);
    const displayName = staticDef?.name  || inferDisplayName(modelId);

    await prisma.modelConfig.create({
      data: {
        modelId,
        provider:    'anthropic',
        group:       'anthropic',
        displayName,
        badge,
        color:       '#c96442', // Claude orange for all Claude models
        requiredPlan: plan,
        enabled:     true,
        isNew:       true,
      },
    });

    console.log(`[modelSync] NEW model: ${modelId} → "${displayName}" (${plan})`);
    newCount++;
  }

  // Mark models older than 7 days as no longer "new"
  await prisma.modelConfig.updateMany({
    where: { isNew: true, createdAt: { lt: new Date(Date.now() - 7 * 86400000) } },
    data:  { isNew: false },
  });

  console.log(`[modelSync] Done — ${newCount} new model(s) added`);
  return newCount;
}

// ── Get enabled models for frontend ──────────────────────────
export async function getEnabledModels() {
  return prisma.modelConfig.findMany({
    where:   { enabled: true, provider: 'anthropic' },
    orderBy: [
      // Sort: opus first, then sonnet, then haiku — newest versions first within each
      { requiredPlan: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}
