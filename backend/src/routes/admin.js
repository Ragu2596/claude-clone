// backend/src/routes/admin.js
// Access: GET /api/admin/summary  and  GET /api/admin/users
// Protected: only your email (ADMIN_EMAIL env var) can access

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAllUserStats, getBusinessSummary } from '../services/costTracker.js';
import { PrismaClient } from '@prisma/client';
const prisma  = new PrismaClient();
const router  = express.Router();

// ── Admin-only middleware ──────────────────────────────────────
function adminOnly(req, res, next) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return res.status(403).json({ error: 'ADMIN_EMAIL not configured' });
  if (req.user.email !== adminEmail) return res.status(403).json({ error: 'Not authorized' });
  next();
}

// ── GET /api/admin/summary ─────────────────────────────────────
router.get('/summary', authenticate, adminOnly, async (req, res) => {
  try {
    const summary = await getBusinessSummary();
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────
router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const users = await getAllUserStats();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/user/:id/logs ───────────────────────────────
router.get('/user/:id/logs', authenticate, adminOnly, async (req, res) => {
  try {
    const logs = await prisma.apiUsageLog.findMany({
      where:   { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
