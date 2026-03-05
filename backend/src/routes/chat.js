import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')),
});
const upload = multer({ storage, limits: { fileSize: 10485760 } });

// ─────────────────────────────────────────────
//  Model Registry
// ─────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    label: 'Groq',
    free: true,
  },
  gemini: {
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    label: 'Google Gemini',
    free: true,
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    label: 'OpenAI',
    free: false,
  },
  anthropic: {
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514', 'claude-opus-4-6'],
    label: 'Anthropic',
    free: false,
  },
};

const DEFAULT_MODEL    = 'llama-3.3-70b-versatile';
const DEFAULT_PROVIDER = 'groq';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function detectProvider(modelId) {
  for (const [provider, config] of Object.entries(PROVIDERS)) {
    if (config.models.includes(modelId)) return provider;
  }
  return null;
}

function autoTitle(text) {
  return (
    text.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6).join(' ') ||
    'New Chat'
  );
}

// ─────────────────────────────────────────────
//  AI Caller
// ─────────────────────────────────────────────
async function callAI(provider, model, system, messages) {

  // 🟢 GROQ — Free Llama & Mixtral
  if (provider === 'groq') {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set in .env');
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    const res = await client.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [{ role: 'system', content: system }, ...messages],
    });
    return res.choices[0].message.content;
  }

  // 🔵 GEMINI — Free Google AI
  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in .env');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const geminiModel = genAI.getGenerativeModel({ model, systemInstruction: system });

    // Convert history (all except last message)
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;
    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  }

  // 💚 OPENAI — ChatGPT
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in .env');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [{ role: 'system', content: system }, ...messages],
    });
    return res.choices[0].message.content;
  }

  // 🟠 ANTHROPIC — Claude
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set in .env');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({ model, max_tokens: 2048, system, messages });
    return res.content[0].text;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ─────────────────────────────────────────────
//  POST /api/chat
// ─────────────────────────────────────────────
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const { message, conversationId } = req.body;

  if (!message?.trim())      return res.status(400).json({ error: 'Message is required' });
  if (!conversationId)       return res.status(400).json({ error: 'Conversation ID is required' });

  try {
    // Load conversation with last 20 messages
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user.id },
      include: {
        project: true,
        messages: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    // Save user message
    await prisma.message.create({
      data: { role: 'user', content: message, conversationId },
    });

    // Build message history
    const history = [
      ...conv.messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const system = conv.project?.systemPrompt || 'You are a helpful AI assistant.';

    // Detect provider from requested model
    let provider = DEFAULT_PROVIDER;
    let model    = DEFAULT_MODEL;

    const requested = req.body.model;
    if (requested && requested !== 'auto') {
      const detected = detectProvider(requested);
      if (detected) {
        provider = detected;
        model    = requested;
      }
    }

    console.log(`\n💬 User: "${message.slice(0, 60)}..."`);
    console.log(`🤖 Model: ${model} | Provider: ${PROVIDERS[provider].label} | Free: ${PROVIDERS[provider].free}`);

    // Call AI
    const reply = await callAI(provider, model, system, history);

    // Save assistant reply
    await prisma.message.create({
      data: { role: 'assistant', content: reply, model, conversationId },
    });

    // Auto-generate title on first message
    let title = null;
    if (conv.title === 'New Chat' && conv.messages.length === 0) {
      title = autoTitle(message);
      await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
    } else {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    console.log(`✅ Reply sent (${reply.length} chars)\n`);

    res.json({ reply, title, model, provider, free: PROVIDERS[provider].free });

  } catch (e) {
    console.error('❌ Chat error:', e.message);

    // User-friendly error messages
    let userMessage = e.message;
    if (e.message.includes('API_KEY'))       userMessage = `API key missing for this model. Please check your .env file.`;
    if (e.message.includes('quota'))         userMessage = `API quota exceeded. Try a different model.`;
    if (e.message.includes('rate limit'))    userMessage = `Too many requests. Please wait a moment and try again.`;
    if (e.message.includes('model'))         userMessage = `Model not available. Please select a different model.`;

    res.status(500).json({ error: userMessage });
  }
});

export default router;