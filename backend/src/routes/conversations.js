import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/conversations  (optionally ?projectId=xxx)
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId } = req.query;

    // Build where clause - fix null filter for Prisma compatibility
    let where;
    if (projectId) {
      where = { userId: req.user.id, projectId: projectId };
    } else {
      // Get conversations NOT in any project
      where = {
        userId: req.user.id,
        OR: [
          { projectId: null },
          { projectId: { equals: null } }
        ]
      };
    }

    const convs = await prisma.conversation.findMany({
      where: { userId: req.user.id, projectId: projectId || null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true, projectId: true }
    });

    res.json(convs);
  } catch (e) {
    console.error('GET /conversations error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/conversations/:id  (with messages)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json(conv);
  } catch (e) {
    console.error('GET /conversations/:id error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/conversations
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, projectId } = req.body;
    const conv = await prisma.conversation.create({
      data: {
        title: title || 'New Chat',
        userId: req.user.id,
        projectId: projectId || null
      }
    });
    res.json(conv);
  } catch (e) {
    console.error('POST /conversations error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/conversations/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { title: req.body.title || conv.title }
    });
    res.json(updated);
  } catch (e) {
    console.error('PATCH /conversations/:id error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/conversations/all — delete ALL conversations for the user
// ⚠️ Must be defined BEFORE /:id route to avoid "all" being treated as an id
router.delete('/all', authenticate, async (req, res) => {
  try {
    const { count } = await prisma.conversation.deleteMany({
      where: { userId: req.user.id },
    });
    console.log(`🗑️  Deleted all ${count} conversations for user ${req.user.id}`);
    res.json({ success: true, deleted: count });
  } catch (e) {
    console.error('DELETE /conversations/all error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    await prisma.conversation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /conversations/:id error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;