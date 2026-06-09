// backend/src/routes/models.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncModels, getEnabledModels } from '../services/modelSync.js';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';

const router = express.Router();

// ── GET /api/models — fetch all enabled models for frontend ───
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

// ── POST /api/models/sync — manually trigger sync (admin only)
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

// ── PATCH /api/models/:id — admin: rename or disable a model ──
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

// ── GET /api/models/trials — trial status for all paid models ─
router.get('/trials', authenticate, async (req, res) => {
  try {
    const trials = await prisma.modelTrial.findMany({
      where: { userId: req.user.id },
    });
    const map = {};
    for (const t of trials) {
      map[t.modelId] = {
        used:      t.useCount,
        remaining: Math.max(0, 3 - t.useCount),
        exhausted: t.exhausted,
      };
    }
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;