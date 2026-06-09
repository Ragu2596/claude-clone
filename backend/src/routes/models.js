// backend/src/routes/models.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncModels, getEnabledModels } from '../services/modelSync.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = express.Router();

// ── Static model definitions (used to seed DB on first run) ──────────────────
// ✅ UPDATED: Added claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-6, o3, o4-mini
export const STATIC_MODELS = [
  // ── FREE ──────────────────────────────────────────────────────────────────
  { modelId: 'llama-3.3-70b-versatile',   provider: 'groq',       group: 'Fast',       displayName: 'Spark',   badge: 'FREE',    color: '#10b981', requiredPlan: null,      contextWindow: 128000, supportsVision: false, supportsFiles: false },
  { modelId: 'gemini-2.0-flash',          provider: 'gemini',     group: 'Fast',       displayName: 'Flash',   badge: 'FREE',    color: '#3b82f6', requiredPlan: null,      contextWindow: 1048576, supportsVision: true, supportsFiles: false },
  // ── STARTER ───────────────────────────────────────────────────────────────
  { modelId: 'gpt-4o-mini',               provider: 'openai',     group: 'OpenAI',     displayName: 'Swift',   badge: 'STARTER', color: '#10a37f', requiredPlan: 'starter', contextWindow: 128000, supportsVision: true,  supportsFiles: false },
  { modelId: 'o4-mini',                   provider: 'openai',     group: 'OpenAI',     displayName: 'Reason',  badge: 'STARTER', color: '#10a37f', requiredPlan: 'starter', contextWindow: 128000, supportsVision: true,  supportsFiles: false },
  { modelId: 'claude-haiku-4-6',          provider: 'anthropic',  group: 'Anthropic',  displayName: 'Breeze',  badge: 'STARTER', color: '#d97706', requiredPlan: 'starter', contextWindow: 200000, supportsVision: true,  supportsFiles: true  },
  { modelId: 'claude-haiku-4-5-20251001', provider: 'anthropic',  group: 'Anthropic',  displayName: 'Breeze-', badge: 'STARTER', color: '#d97706', requiredPlan: 'starter', contextWindow: 200000, supportsVision: true,  supportsFiles: true  },
  { modelId: 'gemini-1.5-pro',            provider: 'gemini',     group: 'Gemini',     displayName: 'Prism',   badge: 'STARTER', color: '#3b82f6', requiredPlan: 'starter', contextWindow: 2097152, supportsVision: true, supportsFiles: false },
  { modelId: 'mistral-large',             provider: 'mistral',    group: 'Mistral',    displayName: 'Mistral', badge: 'STARTER', color: '#f59e0b', requiredPlan: 'starter', contextWindow: 128000, supportsVision: false, supportsFiles: false },
  { modelId: 'perplexity-online',         provider: 'perplexity', group: 'Web',        displayName: 'Lens',    badge: 'STARTER', color: '#8b5cf6', requiredPlan: 'starter', contextWindow: 127072, supportsVision: false, supportsFiles: false },
  { modelId: 'together-deepseek',         provider: 'together',   group: 'Open',       displayName: 'Deep',    badge: 'STARTER', color: '#ef4444', requiredPlan: 'starter', contextWindow: 65536,  supportsVision: false, supportsFiles: false },
  // ── PRO ───────────────────────────────────────────────────────────────────
  { modelId: 'claude-sonnet-4-6',         provider: 'anthropic',  group: 'Anthropic',  displayName: 'Nova',    badge: 'PRO',     color: '#f97316', requiredPlan: 'pro',     contextWindow: 200000, supportsVision: true,  supportsFiles: true  },
  { modelId: 'claude-sonnet-4-20250514',  provider: 'anthropic',  group: 'Anthropic',  displayName: 'Nova-',   badge: 'PRO',     color: '#f97316', requiredPlan: 'pro',     contextWindow: 200000, supportsVision: true,  supportsFiles: true  },
  { modelId: 'gpt-4o',                    provider: 'openai',     group: 'OpenAI',     displayName: 'Apex',    badge: 'PRO',     color: '#10a37f', requiredPlan: 'pro',     contextWindow: 128000, supportsVision: true,  supportsFiles: false },
  { modelId: 'o3',                        provider: 'openai',     group: 'OpenAI',     displayName: 'Orion',   badge: 'PRO',     color: '#10a37f', requiredPlan: 'pro',     contextWindow: 200000, supportsVision: true,  supportsFiles: false },
  { modelId: 'perplexity-large-online',   provider: 'perplexity', group: 'Web',        displayName: 'Lens+',   badge: 'PRO',     color: '#8b5cf6', requiredPlan: 'pro',     contextWindow: 127072, supportsVision: false, supportsFiles: false },
  // ── MAX ───────────────────────────────────────────────────────────────────
  { modelId: 'claude-opus-4-6',           provider: 'anthropic',  group: 'Anthropic',  displayName: 'Titan',   badge: 'MAX',     color: '#dc2626', requiredPlan: 'max',     contextWindow: 200000, supportsVision: true,  supportsFiles: true  },
];

// ── GET /api/models — fetch all enabled models for frontend ───────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let models = await getEnabledModels();

    // If DB is empty (first run), seed from static list
    if (models.length === 0) {
      await seedModels();
      models = await getEnabledModels();
    }

    res.json(models);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/models/trials — trial status for all paid models ─────────────────
router.get('/trials', authenticate, async (req, res) => {
  try {
    const trials = await prisma.modelTrial.findMany({ where: { userId: req.user.id } });
    const map = {};
    for (const t of trials) {
      map[t.modelId] = { used: t.useCount, remaining: Math.max(0, 3 - t.useCount), exhausted: t.exhausted };
    }
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/models/sync — manually trigger sync (admin only) ────────────────
router.post('/sync', authenticate, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' });
  try {
    const newCount = await syncModels();
    const models   = await getEnabledModels();
    res.json({ success: true, newCount, total: models.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/models/:id — admin: rename, disable, change plan ───────────────
router.patch('/:id', authenticate, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' });
  const { displayName, enabled, requiredPlan, badge } = req.body;
  try {
    const model = await prisma.modelConfig.update({
      where: { id: req.params.id },
      data: {
        ...(displayName  !== undefined && { displayName  }),
        ...(enabled      !== undefined && { enabled      }),
        ...(requiredPlan !== undefined && { requiredPlan }),
        ...(badge        !== undefined && { badge        }),
      },
    });
    res.json(model);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Seed static models into DB (runs once on first startup) ───────────────────
async function seedModels() {
  console.log('🌱 Seeding model registry...');
  for (const m of STATIC_MODELS) {
    await prisma.modelConfig.upsert({
      where:  { modelId: m.modelId },
      update: { displayName: m.displayName, badge: m.badge, color: m.color, requiredPlan: m.requiredPlan, contextWindow: m.contextWindow, supportsVision: m.supportsVision, supportsFiles: m.supportsFiles },
      create: { ...m, enabled: true, isNew: true },
    });
  }
  console.log(`✅ Seeded ${STATIC_MODELS.length} models`);
}

export default router;