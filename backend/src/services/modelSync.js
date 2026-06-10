// backend/src/services/modelSync.js
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';

const STATIC_MODELS = [
  { modelId: 'claude-opus-4-6',          plan: 'max',     badge: 'MAX',  name: 'Opus 4.6'   },
  { modelId: 'claude-sonnet-4-5-20250929',        plan: 'pro',     badge: 'PRO',  name: 'Sonnet 4.6' },
  { modelId: 'claude-sonnet-4-5-20250929', plan: 'pro',     badge: 'PRO',  name: 'Sonnet 4.5' },
  { modelId: 'claude-haiku-4-6',         plan: 'starter', badge: 'FAST', name: 'Haiku 4.6'  },
  { modelId: 'claude-haiku-4-5-20251001',plan: 'starter', badge: 'FAST', name: 'Haiku 4.5'  },
];

function inferPlan(id) {
  if (id.includes('haiku'))  return 'starter';
  if (id.includes('sonnet')) return 'pro';
  if (id.includes('opus'))   return 'max';
  return 'pro';
}
function inferBadge(id) {
  if (id.includes('haiku'))  return 'FAST';
  if (id.includes('sonnet')) return 'PRO';
  if (id.includes('opus'))   return 'MAX';
  return 'PRO';
}
function inferName(modelId) {
  const id = modelId.toLowerCase();
  const m  = modelId.match(/(\d+)-(\d{1,2})$/) || modelId.match(/(\d+)-(\d{8})/);
  const ver = m ? (m[2].length > 2 ? m[1] : `${m[1]}.${m[2]}`) : '';
  if (id.includes('opus'))   return ver ? `Opus ${ver}`   : 'Opus';
  if (id.includes('sonnet')) return ver ? `Sonnet ${ver}` : 'Sonnet';
  if (id.includes('haiku'))  return ver ? `Haiku ${ver}`  : 'Haiku';
  return modelId.replace('claude-','').replace(/-\d{8}/,'').replace(/-/g,' ');
}

async function fetchLive() {
  if (!config.anthropicKey) return [];
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).filter(m => m.id.startsWith('claude-')).map(m => m.id);
  } catch { return []; }
}

export async function syncModels() {
  console.log('[modelSync] Starting...');

  // Step 1: Keep ONLY known good Claude model IDs — delete everything else
  const validIds = new Set(STATIC_MODELS.map(s => s.modelId));
  const all = await prisma.modelConfig.findMany({ select: { modelId: true } });
  for (const m of all) {
    if (!validIds.has(m.modelId)) {
      await prisma.modelConfig.delete({ where: { modelId: m.modelId } });
      console.log(`[modelSync] Deleted unknown model: ${m.modelId}`);
    }
  }

  // Step 2: Update existing static models with correct names
  for (const s of STATIC_MODELS) {
    const existing = await prisma.modelConfig.findUnique({ where: { modelId: s.modelId } });
    if (existing) {
      if (existing.displayName !== s.name) {
        await prisma.modelConfig.update({
          where: { modelId: s.modelId },
          data: { displayName: s.name, badge: s.badge, requiredPlan: s.plan, color: '#c96442' },
        });
        console.log(`[modelSync] Fixed name: ${s.modelId} → ${s.name}`);
      }
      continue;
    }
    await prisma.modelConfig.create({
      data: { modelId: s.modelId, provider: 'anthropic', group: 'anthropic', displayName: s.name, badge: s.badge, color: '#c96442', requiredPlan: s.plan, enabled: true, isNew: true },
    });
    console.log(`[modelSync] Added: ${s.modelId} → ${s.name}`);
  }

  // Step 3: Add any new live models from Anthropic API
  const liveIds = await fetchLive();
  const known   = new Set(STATIC_MODELS.map(s => s.modelId));
  for (const modelId of liveIds) {
    if (known.has(modelId)) continue;
    const exists = await prisma.modelConfig.findUnique({ where: { modelId } });
    if (exists) continue;
    await prisma.modelConfig.create({
      data: { modelId, provider: 'anthropic', group: 'anthropic', displayName: inferName(modelId), badge: inferBadge(modelId), color: '#c96442', requiredPlan: inferPlan(modelId), enabled: true, isNew: true },
    });
    console.log(`[modelSync] New live model: ${modelId} → ${inferName(modelId)}`);
  }

  // Step 4: Clear isNew after 7 days
  await prisma.modelConfig.updateMany({
    where: { isNew: true, createdAt: { lt: new Date(Date.now() - 7*86400000) } },
    data:  { isNew: false },
  });

  console.log('[modelSync] Done');
}

export async function getEnabledModels() {
  return prisma.modelConfig.findMany({
    where:   { enabled: true, provider: 'anthropic' },
    orderBy: [{ requiredPlan: 'desc' }, { createdAt: 'desc' }],
  });
}
