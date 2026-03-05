import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { checkCache, storeInCache, getFlywheelStats } from '../services/knowledgeCache.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 } });

function autoTitle(text) {
  return text.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6).join(' ') || 'New Chat';
}

function send(res, data) {
  res.write('data: ' + JSON.stringify(data) + '\n\n');
  if (res.flush) res.flush();
}

// ─── Main chat route ──────────────────────────────────────────────────────────
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const { message, conversationId, model: requestedModel } = req.body;
  console.log(`💬 Chat request: conv=${conversationId}, msg="${message?.slice(0,50)}" model=${requestedModel}`);

  if (!message || !conversationId)
    return res.status(400).json({ error: 'message and conversationId required' });

  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user.id },
      include: {
        project: true,
        messages: { orderBy: { createdAt: 'asc' }, take: 40 }
      }
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    // Save user message
    let fileUrl = null, fileName = null, fileType = null;
    if (req.file) {
      fileUrl = '/uploads/' + req.file.filename;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }
    await prisma.message.create({
      data: { role: 'user', content: message, conversationId, fileUrl, fileName, fileType }
    });

    // ─── ⚡ DB FIRST: Check knowledge cache ───────────────────────────────────
    const hasFile = !!req.file;
    const isFirstMessage = conv.messages.length === 0; // only cache on fresh questions
    const cachedAnswer = await checkCache(message, hasFile);

    if (cachedAnswer) {
      // ✅ Cache HIT — serve instantly, zero API cost!
      console.log('⚡ Serving from cache — FREE response!');

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true',
      });

      // Stream cached answer word by word (feels live to user)
      const words = cachedAnswer.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? '' : ' ') + words[i];
        send(res, { type: 'text', text: chunk, fromCache: true });
        // Small delay to simulate natural streaming
        if (i % 8 === 0) await new Promise(r => setTimeout(r, 10));
      }

      // Save assistant message
      await prisma.message.create({
        data: { role: 'assistant', content: cachedAnswer, conversationId }
      });

      // Auto-title
      if (conv.title === 'New Chat' && conv.messages.length === 0) {
        const title = autoTitle(message);
        await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
        send(res, { type: 'title', title });
      } else {
        await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      }

      send(res, { type: 'done', fromCache: true });
      res.end();
      return;
    }

    // ─── 🌐 DB MISS: Call 3rd party API ──────────────────────────────────────
    console.log('🌐 Cache miss — calling API...');

    // Build history
    const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });

    const systemPrompt = conv.project?.systemPrompt ||
      'You are rk.ai, a helpful AI assistant. Be concise, accurate and helpful.';

    // Determine which model to use
    const chosenModel = selectModel(requestedModel, req.user);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
      'Access-Control-Allow-Credentials': 'true',
    });

    let fullResponse = '';

    if (chosenModel.provider === 'anthropic') {
      const stream = anthropic.messages.stream({
        model: chosenModel.id,
        max_tokens: 4096,
        system: systemPrompt,
        messages: history,
      });
      stream.on('text', (text) => { fullResponse += text; send(res, { type: 'text', text }); });
      stream.on('error', (err) => { console.error('❌ Stream error:', err.message); send(res, { type: 'error', error: err.message }); });
      await stream.finalMessage();
    } else {
      // Fallback for other providers — use Anthropic by default
      const stream = anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: history,
      });
      stream.on('text', (text) => { fullResponse += text; send(res, { type: 'text', text }); });
      await stream.finalMessage();
    }

    console.log(`✅ API done, response length: ${fullResponse.length}`);

    // Save assistant message
    await prisma.message.create({
      data: { role: 'assistant', content: fullResponse, conversationId }
    });

    // ─── 💾 STORE IN DB FOREVER ───────────────────────────────────────────────
    // Next user who asks same question gets it FREE from DB
    await storeInCache(message, fullResponse, chosenModel.id, hasFile);

    // Auto-title
    if (conv.title === 'New Chat' && conv.messages.length === 0) {
      const title = autoTitle(message);
      await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
      send(res, { type: 'title', title });
    } else {
      await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    send(res, { type: 'done' });
    res.end();

  } catch (e) {
    console.error('❌ Chat route error:', e.message, e.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else {
      send(res, { type: 'error', error: e.message });
      res.end();
    }
  }
});

// ─── Flywheel stats endpoint ──────────────────────────────────────────────────
router.get('/flywheel-stats', authenticate, async (req, res) => {
  const stats = await getFlywheelStats();
  res.json(stats);
});

// ─── Model selection helper ───────────────────────────────────────────────────
function selectModel(requested, user) {
  const models = {
    'claude-sonnet-4-20250514':  { id: 'claude-sonnet-4-20250514',  provider: 'anthropic' },
    'claude-haiku-4-5-20251001': { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
    'gpt-4o':                    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' }, // fallback to claude
    'gpt-4o-mini':               { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
    'auto':                      { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  };
  return models[requested] || models['auto'];
}

export default router;