import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { checkCache, storeInCache, getFlywheelStats } from '../services/knowledgeCache.js';
import { logApiUsage, checkBudget, PLAN_BUDGETS } from '../services/costTracker.js';
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
// requiredPlan: null = free, 'starter' = starter+, 'pro' = pro+, 'max' = max only
const MODELS = {
  'auto':                      { provider: 'groq',       id: 'llama-3.3-70b-versatile',                 free: true,  requiredPlan: null      },
  'llama-3.3-70b-versatile':   { provider: 'groq',       id: 'llama-3.3-70b-versatile',                 free: true,  requiredPlan: null      },
  'mixtral-8x7b-32768':        { provider: 'groq',       id: 'mixtral-8x7b-32768',                      free: true,  requiredPlan: null      },
  'gemini-2.0-flash':          { provider: 'gemini',     id: 'gemini-2.0-flash',                        free: true,  requiredPlan: null      },
  'gemini-1.5-flash':          { provider: 'gemini',     id: 'gemini-1.5-flash',                        free: true,  requiredPlan: null      },
  'gemini-1.5-pro':            { provider: 'gemini',     id: 'gemini-1.5-pro',                          free: true,  requiredPlan: null      },
  'mistral-small':             { provider: 'mistral',    id: 'mistral-small-latest',                    free: true,  requiredPlan: null      },
  'mistral-large':             { provider: 'mistral',    id: 'mistral-large-latest',                    free: true,  requiredPlan: null      },
  'together-llama':            { provider: 'together',   id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', free: true,  requiredPlan: null      },
  'together-deepseek':         { provider: 'together',   id: 'deepseek-ai/DeepSeek-V3',                 free: true,  requiredPlan: null      },
  'together-qwen':             { provider: 'together',   id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',         free: true,  requiredPlan: null      },
  'perplexity-online':         { provider: 'perplexity', id: 'llama-3.1-sonar-small-128k-online',       free: false, requiredPlan: 'starter' },
  'perplexity-large-online':   { provider: 'perplexity', id: 'llama-3.1-sonar-large-128k-online',       free: false, requiredPlan: 'starter' },
  'claude-haiku-4-5-20251001': { provider: 'anthropic',  id: 'claude-haiku-4-5-20251001',               free: false, requiredPlan: 'starter' },
  'gpt-4o-mini':               { provider: 'openai',     id: 'gpt-4o-mini',                             free: false, requiredPlan: 'starter' },
  'claude-sonnet-4-20250514':  { provider: 'anthropic',  id: 'claude-sonnet-4-20250514',                free: false, requiredPlan: 'pro'     },
  'gpt-4o':                    { provider: 'openai',     id: 'gpt-4o',                                  free: false, requiredPlan: 'pro'     },
};

// ─── Rate limits — 3 rolling windows like Claude ─────────────
//   hourly  = burst protection   (rolling 1h)
//   daily   = fair use           (rolling 24h)
//   weekly  = heavy use cap      (rolling 7d)
const RATE_LIMITS = {
  free:    { hourly: 10,  daily: 20,    weekly: 80    },
  starter: { hourly: 40,  daily: 200,   weekly: 1000  },
  pro:     { hourly: 80,  daily: 1000,  weekly: 5000  },
  max:     { hourly: 500, daily: 9999,  weekly: 99999 },
};

function selectModel(requested) {
  return MODELS[requested] || MODELS['auto'];
}

// ─── Get active plan (auto-downgrade if expired) ──────────────
async function getActivePlan(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  if (!user) return 'free';

  if (user.plan !== 'free' && user.planExpiresAt && user.planExpiresAt < new Date()) {
    await prisma.user.update({ where: { id: userId }, data: { plan: 'free' } });
    console.log(`⏰ Plan expired for user ${userId} — downgraded to free`);
    return 'free';
  }
  return user.plan || 'free';
}

// ─── Check if plan allows model ───────────────────────────────
function planAllowsModel(model, userPlan) {
  if (!model.requiredPlan) return true;
  if (model.requiredPlan === 'starter') return ['starter', 'pro', 'max'].includes(userPlan);
  if (model.requiredPlan === 'pro')     return ['pro', 'max'].includes(userPlan);
  if (model.requiredPlan === 'max')     return userPlan === 'max';
  return false;
}

// ─── Rolling window message count helper ─────────────────────
async function countMsgsInWindow(userId, sinceDate) {
  return prisma.message.count({
    where: {
      role: 'user',
      conversation: { userId },
      createdAt: { gte: sinceDate },
    },
  });
}

// ─── Find when user will next be unblocked ───────────────────
// Returns the oldest message in the window — when it ages out, limit resets
async function nextAvailableAt(userId, windowMs, limit) {
  const since = new Date(Date.now() - windowMs);
  // Get the (limit)th most recent message — when that ages out user is free
  const msgs = await prisma.message.findMany({
    where: {
      role: 'user',
      conversation: { userId },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { createdAt: true },
  });
  if (msgs.length < limit) return null; // not actually blocked
  // When the oldest of these messages ages out of the window
  return new Date(msgs[0].createdAt.getTime() + windowMs);
}

// ─── Main rate limit check (3 windows) ───────────────────────
async function checkRateLimit(userId, userPlan) {
  const limits  = RATE_LIMITS[userPlan] || RATE_LIMITS.free;
  const now     = Date.now();

  const [hourCount, dayCount, weekCount] = await Promise.all([
    countMsgsInWindow(userId, new Date(now - 60 * 60 * 1000)),          // last 1h
    countMsgsInWindow(userId, new Date(now - 24 * 60 * 60 * 1000)),     // last 24h
    countMsgsInWindow(userId, new Date(now - 7 * 24 * 60 * 60 * 1000)), // last 7d
  ]);

  // Check hourly burst first
  if (hourCount >= limits.hourly) {
    const retryAt = await nextAvailableAt(userId, 60 * 60 * 1000, limits.hourly);
    return {
      exceeded:  true,
      window:    'hourly',
      count:     hourCount,
      limit:     limits.hourly,
      retryAt,
      dayCount,  dayLimit:  limits.daily,
      weekCount, weekLimit: limits.weekly,
      plan:      userPlan,
    };
  }

  // Check daily
  if (dayCount >= limits.daily) {
    const retryAt = await nextAvailableAt(userId, 24 * 60 * 60 * 1000, limits.daily);
    return {
      exceeded:  true,
      window:    'daily',
      count:     dayCount,
      limit:     limits.daily,
      retryAt,
      dayCount,  dayLimit:  limits.daily,
      weekCount, weekLimit: limits.weekly,
      plan:      userPlan,
    };
  }

  // Check weekly
  if (weekCount >= limits.weekly) {
    const retryAt = await nextAvailableAt(userId, 7 * 24 * 60 * 60 * 1000, limits.weekly);
    return {
      exceeded:  true,
      window:    'weekly',
      count:     weekCount,
      limit:     limits.weekly,
      retryAt,
      dayCount,  dayLimit:  limits.daily,
      weekCount, weekLimit: limits.weekly,
      plan:      userPlan,
    };
  }

  return {
    exceeded:  false,
    hourCount, hourLimit: limits.hourly,
    dayCount,  dayLimit:  limits.daily,
    weekCount, weekLimit: limits.weekly,
    plan:      userPlan,
  };
}

// ─── Generic OpenAI-compatible streaming ──────────────────────
async function streamOpenAICompatible({ apiKey, baseURL, model, systemPrompt, history, res }) {
  if (!apiKey) throw new Error(`API key missing for ${baseURL}`);
  const messages = [{ role: 'system', content: systemPrompt }, ...history];
  const response = await fetch(`${baseURL}/chat/completions`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model, messages, max_tokens: 4096, stream: true }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err.slice(0, 200)}`);
  }
  let fullText = '';
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
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
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini error ${response.status}`);
  let fullText = '';
  const reader  = response.body.getReader();
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
  if (provider === 'groq')       return streamOpenAICompatible({ apiKey: process.env.GROQ_API_KEY,       baseURL: 'https://api.groq.com/openai/v1',  model: id, systemPrompt, history, res });
  if (provider === 'mistral')    return streamOpenAICompatible({ apiKey: process.env.MISTRAL_API_KEY,    baseURL: 'https://api.mistral.ai/v1',        model: id, systemPrompt, history, res });
  if (provider === 'together')   return streamOpenAICompatible({ apiKey: process.env.TOGETHER_API_KEY,   baseURL: 'https://api.together.xyz/v1',      model: id, systemPrompt, history, res });
  if (provider === 'perplexity') return streamOpenAICompatible({ apiKey: process.env.PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai',        model: id, systemPrompt, history, res });
  if (provider === 'openai')     return streamOpenAICompatible({ apiKey: process.env.OPENAI_API_KEY,     baseURL: 'https://api.openai.com/v1',        model: id, systemPrompt, history, res });
  if (provider === 'gemini')     return streamGemini(id, systemPrompt, history, res);
  if (provider === 'anthropic')  return streamAnthropic(id, systemPrompt, history, res);
  throw new Error(`Unknown provider: ${provider}`);
}

// ─── Main chat route ───────────────────────────────────────────
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const { message, conversationId, model: requestedModel } = req.body;

  if (!message || !conversationId)
    return res.status(400).json({ error: 'message and conversationId required' });

  try {
    // Step 1: Get active plan
    const userPlan = await getActivePlan(req.user.id);

    // Step 2: Block file uploads for free plan
    if (req.file && userPlan === 'free') {
      return res.status(403).json({
        error: 'File uploads require Starter plan or above. Upgrade to upload files!',
        upgradeRequired: true,
        plan: userPlan,
      });
    }

    // Step 3: Check rate limits (hourly / daily / weekly rolling windows)
    const rateLimit = await checkRateLimit(req.user.id, userPlan);
    if (rateLimit.exceeded) {
      const { window, count, limit, retryAt, dayCount, dayLimit, weekCount, weekLimit } = rateLimit;

      const windowLabel = window === 'hourly' ? 'hour' : window === 'daily' ? '24 hours' : '7 days';
      const retryMsg    = retryAt
        ? ` Try again at ${retryAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : '';

      console.log(`🚫 ${window} limit: user=${req.user.id} plan=${userPlan} ${count}/${limit}`);

      return res.status(403).json({
        error:       `${window.charAt(0).toUpperCase() + window.slice(1)} limit reached (${limit} msgs/${windowLabel} on ${userPlan} plan).${retryMsg}`,
        limitReached: true,
        window,
        count,
        limit,
        retryAt,
        dayCount,  dayLimit,
        weekCount, weekLimit,
        plan: userPlan,
      });
    }

    const { dayCount, dayLimit, weekCount, weekLimit, hourCount, hourLimit } = rateLimit;

    // Step 3b: Check API budget (auto-fallback to free model if exhausted)
    const budget = await checkBudget(req.user.id, userPlan);
    const budgetExhausted = userPlan !== 'free' && !budget.hasbudget;
    if (budgetExhausted) {
      console.log(`💸 Budget exhausted: user=${req.user.id} plan=${userPlan} ${budget.used}/${budget.limit}µ$ — falling back to free model`);
    }

    // Step 4: Enforce model access by plan
    let chosenModel = selectModel(requestedModel);
    if (!planAllowsModel(chosenModel, userPlan)) {
      console.log(`🔒 Model ${requestedModel} requires ${chosenModel.requiredPlan}, user has ${userPlan} — falling back to auto`);
      chosenModel = MODELS['auto'];
    }

    // If user's monthly API budget is exhausted → silently fall back to free model
    // They still get service, just on Groq instead of Claude/GPT
    if (budgetExhausted && chosenModel.requiredPlan) {
      console.log(`💸 Budget fallback: ${chosenModel.id} → groq:llama-3.3-70b-versatile`);
      chosenModel = MODELS['llama-3.3-70b-versatile'];
    }

    console.log(`💬 Chat: "${message?.slice(0,40)}" plan=${userPlan} budget=${budget.pct}% → ${chosenModel.provider}:${chosenModel.id}`);

    const conv = await prisma.conversation.findFirst({
      where:   { id: conversationId, userId: req.user.id },
      include: { project: true, messages: { orderBy: { createdAt: 'asc' }, take: 40 } },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    let fileUrl = null, fileName = null, fileType = null;
    if (req.file) {
      fileUrl  = '/uploads/' + req.file.filename;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }
    await prisma.message.create({
      data: { role: 'user', content: message, conversationId, fileUrl, fileName, fileType },
    });

    // Check knowledge cache
    const hasFile      = !!req.file;
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
      send(res, { type: 'done', fromCache: true, usage: { hourCount: hourCount+1, hourLimit, dayCount: dayCount+1, dayLimit, weekCount: weekCount+1, weekLimit, plan: userPlan } });
      res.end();
      return;
    }

    // API call
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
          apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1',
          model: 'llama-3.3-70b-versatile', systemPrompt, history, res,
        });
      } catch {
        fullResponse = await streamAnthropic('claude-haiku-4-5-20251001', systemPrompt, history, res);
      }
    }

    console.log(`✅ Done — ${chosenModel.provider} len=${fullResponse.length} plan=${userPlan}`);

    // ── Track API cost automatically ─────────────────────────────
    const costMicro = await logApiUsage({
      userId:     req.user.id,
      modelId:    chosenModel.id,
      inputText:  message,
      outputText: fullResponse,
      fromCache:  false,
    });
    if (costMicro > 0) {
      console.log(`💰 Cost logged: $${(costMicro/1_000_000).toFixed(6)} for ${chosenModel.id}`);
    }

    await prisma.message.create({ data: { role: 'assistant', content: fullResponse, conversationId } });
    await storeInCache(message, fullResponse, chosenModel.id, hasFile);

    if (conv.title === 'New Chat' && conv.messages.length === 0) {
      const title = autoTitle(message);
      await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
      send(res, { type: 'title', title });
    } else {
      await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    send(res, { type: 'done', usage: { hourCount: hourCount+1, hourLimit, dayCount: dayCount+1, dayLimit, weekCount: weekCount+1, weekLimit, plan: userPlan, budgetPct: budget.pct, budgetExhausted } });
    res.end();

  } catch (e) {
    console.error('❌ Chat error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else { send(res, { type: 'error', error: e.message }); res.end(); }
  }
});

// ─── Flywheel stats ───────────────────────────────────────────
router.get('/flywheel-stats', authenticate, async (req, res) => {
  res.json(await getFlywheelStats());
});

export default router;