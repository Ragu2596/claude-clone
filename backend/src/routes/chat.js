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
const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 } });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function autoTitle(text) {
  return text.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6).join(' ') || 'New Chat';
}
function send(res, data) {
  res.write('data: ' + JSON.stringify(data) + '\n\n');
  if (res.flush) res.flush();
}

// ─── Model Registry ───────────────────────────────────────────
const MODELS = {
  // AUTO
  'auto':                        { provider: 'groq',       id: 'llama-3.3-70b-versatile',                free: true  },

  // FREE — Groq
  'llama-3.3-70b-versatile':     { provider: 'groq',       id: 'llama-3.3-70b-versatile',                free: true  },
  'mixtral-8x7b-32768':          { provider: 'groq',       id: 'mixtral-8x7b-32768',                     free: true  },

  // FREE — Gemini
  'gemini-2.0-flash':            { provider: 'gemini',     id: 'gemini-2.0-flash',                       free: true  },
  'gemini-1.5-flash':            { provider: 'gemini',     id: 'gemini-1.5-flash',                       free: true  },
  'gemini-1.5-pro':              { provider: 'gemini',     id: 'gemini-1.5-pro',                         free: true  },

  // FREE — Mistral
  'mistral-small':               { provider: 'mistral',    id: 'mistral-small-latest',                   free: true  },
  'mistral-large':               { provider: 'mistral',    id: 'mistral-large-latest',                   free: true  },

  // FREE credits — Together AI (50+ open source models)
  'together-llama':              { provider: 'together',   id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',free: true  },
  'together-deepseek':           { provider: 'together',   id: 'deepseek-ai/DeepSeek-V3',                free: true  },
  'together-qwen':               { provider: 'together',   id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',        free: true  },

  // PAID + WEB SEARCH — Perplexity
  'perplexity-online':           { provider: 'perplexity', id: 'llama-3.1-sonar-small-128k-online',      free: false, webSearch: true },
  'perplexity-large-online':     { provider: 'perplexity', id: 'llama-3.1-sonar-large-128k-online',      free: false, webSearch: true },

  // PAID — Anthropic
  'claude-haiku-4-5-20251001':   { provider: 'anthropic',  id: 'claude-haiku-4-5-20251001',              free: false },
  'claude-sonnet-4-20250514':    { provider: 'anthropic',  id: 'claude-sonnet-4-20250514',               free: false },

  // PAID — OpenAI
  'gpt-4o-mini':                 { provider: 'openai',     id: 'gpt-4o-mini',                            free: false },
  'gpt-4o':                      { provider: 'openai',     id: 'gpt-4o',                                 free: false },
};

function selectModel(requested) {
  return MODELS[requested] || MODELS['auto'];
}

// ─── Generic OpenAI-compatible streaming ──────────────────────
// Works for: Groq, Mistral, Together, Perplexity, OpenAI
async function streamOpenAICompatible({ apiKey, baseURL, model, systemPrompt, history, res }) {
  if (!apiKey) throw new Error(`API key missing for ${baseURL}`);

  const messages = [{ role: 'system', content: systemPrompt }, ...history];

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 4096, stream: true }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err.slice(0, 200)}`);
  }

  let fullText = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const text = JSON.parse(data).choices?.[0]?.delta?.content || '';
        if (text) { fullText += text; send(res, { type: 'text', text }); }
      } catch {}
    }
  }
  return fullText;
}

// ─── Gemini streaming ──────────────────────────────────────────
async function streamGemini(model, systemPrompt, history, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini error ${response.status}`);

  let fullText = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
      try {
        const text = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) { fullText += text; send(res, { type: 'text', text }); }
      } catch {}
    }
  }
  return fullText;
}

// ─── Anthropic streaming ───────────────────────────────────────
async function streamAnthropic(model, systemPrompt, history, res) {
  let fullText = '';
  const stream = anthropic.messages.stream({ model, max_tokens: 4096, system: systemPrompt, messages: history });
  stream.on('text', text => { fullText += text; send(res, { type: 'text', text }); });
  await stream.finalMessage();
  return fullText;
}

// ─── Route all providers ───────────────────────────────────────
async function callProvider(chosenModel, systemPrompt, history, res) {
  const { provider, id } = chosenModel;

  if (provider === 'groq') {
    return streamOpenAICompatible({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      model: id, systemPrompt, history, res
    });
  }
  if (provider === 'mistral') {
    return streamOpenAICompatible({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: 'https://api.mistral.ai/v1',
      model: id, systemPrompt, history, res
    });
  }
  if (provider === 'together') {
    return streamOpenAICompatible({
      apiKey: process.env.TOGETHER_API_KEY,
      baseURL: 'https://api.together.xyz/v1',
      model: id, systemPrompt, history, res
    });
  }
  if (provider === 'perplexity') {
    return streamOpenAICompatible({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
      model: id, systemPrompt, history, res
    });
  }
  if (provider === 'openai') {
    return streamOpenAICompatible({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      model: id, systemPrompt, history, res
    });
  }
  if (provider === 'gemini') {
    return streamGemini(id, systemPrompt, history, res);
  }
  if (provider === 'anthropic') {
    return streamAnthropic(id, systemPrompt, history, res);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// ─── Main chat route ───────────────────────────────────────────
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const { message, conversationId, model: requestedModel } = req.body;
  const chosenModel = selectModel(requestedModel);
  console.log(`💬 Chat: "${message?.slice(0,40)}" → ${chosenModel.provider}:${chosenModel.id} (free=${chosenModel.free})`);

  if (!message || !conversationId)
    return res.status(400).json({ error: 'message and conversationId required' });

  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user.id },
      include: { project: true, messages: { orderBy: { createdAt: 'asc' }, take: 40 } }
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    let fileUrl = null, fileName = null, fileType = null;
    if (req.file) {
      fileUrl = '/uploads/' + req.file.filename;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }
    await prisma.message.create({
      data: { role: 'user', content: message, conversationId, fileUrl, fileName, fileType }
    });

    // ⚡ DB FIRST
    const hasFile = !!req.file;
    const cachedAnswer = await checkCache(message, hasFile);

    if (cachedAnswer) {
      console.log('⚡ CACHE HIT — FREE!');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive', 'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true',
      });
      const words = cachedAnswer.split(' ');
      for (let i = 0; i < words.length; i++) {
        send(res, { type: 'text', text: (i === 0 ? '' : ' ') + words[i], fromCache: true });
        if (i % 8 === 0) await new Promise(r => setTimeout(r, 8));
      }
      await prisma.message.create({ data: { role: 'assistant', content: cachedAnswer, conversationId } });
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

    // 🌐 API CALL
    console.log(`🌐 Cache miss — calling ${chosenModel.provider}...`);
    const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });
    const systemPrompt = conv.project?.systemPrompt || 'You are rk.ai, a helpful AI assistant. Be concise, accurate and helpful.';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
      'Access-Control-Allow-Credentials': 'true',
    });

    let fullResponse = '';
    try {
      fullResponse = await callProvider(chosenModel, systemPrompt, history, res);
    } catch (apiErr) {
      console.error(`❌ ${chosenModel.provider} failed: ${apiErr.message} — falling back to Groq`);
      try {
        fullResponse = await streamOpenAICompatible({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: 'https://api.groq.com/openai/v1',
          model: 'llama-3.3-70b-versatile', systemPrompt, history, res
        });
      } catch {
        fullResponse = await streamAnthropic('claude-haiku-4-5-20251001', systemPrompt, history, res);
      }
    }

    console.log(`✅ Done — ${chosenModel.provider} len=${fullResponse.length}`);

    await prisma.message.create({ data: { role: 'assistant', content: fullResponse, conversationId } });

    // 💾 STORE IN DB FOREVER
    await storeInCache(message, fullResponse, chosenModel.id, hasFile);

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
    console.error('❌ Chat error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else { send(res, { type: 'error', error: e.message }); res.end(); }
  }
});

router.get('/flywheel-stats', authenticate, async (req, res) => {
  res.json(await getFlywheelStats());
});

export default router;