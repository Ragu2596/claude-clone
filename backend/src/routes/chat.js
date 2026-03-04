import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 10485760 } });

const GROQ_MODELS      = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
const ANTHROPIC_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514', 'claude-opus-4-6'];
const OPENAI_MODELS    = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

const DEFAULT_MODEL    = 'llama-3.3-70b-versatile';
const DEFAULT_PROVIDER = 'groq';

function autoTitle(t) {
  return t.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6).join(' ') || 'New Chat';
}

async function callAI(provider, model, system, messages) {
  if (provider === 'groq') {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in .env');
    const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
    const r = await client.chat.completions.create({
      model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 2048,
    });
    return r.choices[0].message.content;
  }
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set in .env');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 2048,
    });
    return r.choices[0].message.content;
  }
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({ model, max_tokens: 2048, system, messages });
    return r.content[0].text;
  }
  throw new Error('Unknown provider: ' + provider);
}

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const { message, conversationId } = req.body;
  if (!message || !conversationId) return res.status(400).json({ error: 'missing fields' });

  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user.id },
      include: { project: true, messages: { orderBy: { createdAt: 'asc' }, take: 20 } }
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    await prisma.message.create({ data: { role: 'user', content: message, conversationId } });

    const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });

    const system = conv.project?.systemPrompt || 'You are a helpful AI assistant.';

    // No plan checks — pick model freely
    let provider = DEFAULT_PROVIDER;
    let model    = DEFAULT_MODEL;

    const requested = req.body.model;
    if (requested && requested !== 'auto') {
      if (GROQ_MODELS.includes(requested))           { provider = 'groq';      model = requested; }
      else if (OPENAI_MODELS.includes(requested))    { provider = 'openai';    model = requested; }
      else if (ANTHROPIC_MODELS.includes(requested)) { provider = 'anthropic'; model = requested; }
    }

    console.log(`🤖 ${model} (${provider})`);

    const reply = await callAI(provider, model, system, history);

    await prisma.message.create({ data: { role: 'assistant', content: reply, model, conversationId } });

    let title = null;
    if (conv.title === 'New Chat' && conv.messages.length === 0) {
      title = autoTitle(message);
      await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
    } else {
      await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    res.json({ reply, title, model, provider });

  } catch (e) {
    console.error('❌ Chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;