// backend/src/routes/models.js
// Claude-only model registry. Auto-syncs from Anthropic API daily.
// When Anthropic releases a new Claude model, it appears automatically.

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';
import { syncModels, getEnabledModels } from '../services/modelSync.js';

const router = express.Router();

// GET /api/models
router.get('/', authenticate, async (req, res) => {
  try {
    let models = await getEnabledModels();
    if (models.length === 0) {
      await syncModels();
      models = await getEnabledModels();
    }
    res.json(models);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/models/trials
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

// POST /api/models/sync — admin only, manual trigger
router.post('/sync', authenticate, async (req, res) => {
  if (req.user.email !== config.adminEmail)
    return res.status(403).json({ error: 'Admin only' });
  try {
    const newCount = await syncModels();
    const models   = await getEnabledModels();
    res.json({ success: true, newCount, total: models.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/models/:id — admin: rename, disable, change plan tier
router.patch('/:id', authenticate, async (req, res) => {
  if (req.user.email !== config.adminEmail)
    return res.status(403).json({ error: 'Admin only' });
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

export default router;
