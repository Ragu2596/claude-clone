import express   from 'express';
import prisma    from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const convs = await prisma.conversation.findMany({
      where:   { userId: req.user.id, projectId: req.query.projectId || null },
      orderBy: { updatedAt: 'desc' },
      select:  { id: true, title: true, createdAt: true, updatedAt: true, projectId: true },
    });
    res.json(convs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data:  { title: req.body.title || conv.title },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/all', authenticate, async (req, res) => {
  try {
    const ids = (await prisma.conversation.findMany({ where: { userId: req.user.id }, select: { id: true } })).map(c => c.id);
    if (!ids.length) return res.json({ success: true, deleted: 0 });
    await prisma.message.deleteMany({ where: { conversationId: { in: ids } } });
    const { count } = await prisma.conversation.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, deleted: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
