import express from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json(projects);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, systemPrompt } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const p = await prisma.project.create({ data: { name, description: description || null, systemPrompt: systemPrompt || 'You are a helpful AI assistant.', userId: req.user.id } });
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.project.update({ where: { id: req.params.id }, data: { name: req.body.name || p.name, description: req.body.description !== undefined ? req.body.description : p.description, systemPrompt: req.body.systemPrompt || p.systemPrompt } });
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Not found' });
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

export default router;