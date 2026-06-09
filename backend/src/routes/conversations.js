// backend/src/routes/conversations.js
import express   from 'express';
import prisma    from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/conversations
router.get('/', authenticate, async (req, res) => {
  try {
    const convs = await prisma.conversation.findMany({
      where:   { userId: req.user.id, projectId: req.query.projectId || null },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      select:  { id: true, title: true, pinned: true, createdAt: true, updatedAt: true, projectId: true },
    });
    res.json(convs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/conversations/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({
      where:   { id: req.params.id, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json(conv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/conversations
router.post('/', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.create({
      data: { title: req.body.title || 'New Chat', userId: req.user.id, projectId: req.body.projectId || null },
    });
    res.json(conv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/conversations/:id  (rename, pin, archive)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!conv) return res.status(404).json({ error: 'Not found' });

    const { title, pinned, archived } = req.body;
    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data:  {
        ...(title    !== undefined && { title }),
        ...(pinned   !== undefined && { pinned }),
        ...(archived !== undefined && { archived }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/conversations/all  (must be before /:id)
router.delete('/all', authenticate, async (req, res) => {
  try {
    const userId  = req.user.id;
    const convIds = await prisma.conversation.findMany({ where: { userId }, select: { id: true } });
    const ids     = convIds.map(c => c.id);
    if (ids.length === 0) return res.json({ success: true, deleted: 0 });

    await prisma.message.deleteMany({ where: { conversationId: { in: ids } } });
    const { count } = await prisma.conversation.deleteMany({ where: { userId } });
    res.json({ success: true, deleted: count });
  } catch (e) {
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
    res.status(500).json({ error: e.message });
  }
});

export default router;