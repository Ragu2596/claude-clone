// backend/src/routes/chat.js
// Thin route handler — orchestrates services, owns no business logic itself.
// Every decision is made by a service or model layer.

import express        from 'express';
import multer         from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath }  from 'url';

import { authenticate }                    from '../middleware/auth.js';
import { config }                          from '../config/index.js';
import { send, startSSE }                  from '../lib/sse.js';
import prisma                              from '../lib/prisma.js';
import { callProvider }                    from '../providers/index.js';
import { getActivePlan, checkRateLimit, checkModelDailyLimit, resolveModel, incrementTrial } from '../services/planService.js';
import { checkBudget, logApiUsage }        from '../services/costService.js';
import { checkCache, storeInCache, shouldSkipCache, getFlywheelStats } from '../services/cacheService.js';
import { getUserMemory, updateUserMemory, buildSystemPrompt } from '../services/memoryService.js';
import { syncModels }                      from '../services/modelSync.js';
import { getLangInstruction }              from '../models/language.js';
import { STATIC_MODELS, RATE_LIMITS }      from '../models/plan.js';

const router = express.Router();

// ── File upload ───────────────────────────────────────────────────────────────
const __dirname  = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', '..', config.uploadDir);
const storage    = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')),
});
const upload = multer({ storage, limits: { fileSize: config.maxFileSize } });

// ── Daily model sync ──────────────────────────────────────────────────────────
let lastSync = 0;
function maybeSyncModels() {
  const now = Date.now();
  if (now - lastSync > 86400000) {
    lastSync = now;
    syncModels().catch(e => console.error('⚠️ Model sync:', e.message));
  }
}
maybeSyncModels();

// ── Base system prompt ────────────────────────────────────────────────────────
function getBaseSystemPrompt() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZoneName:'short' });
  return `You are rk.ai, a powerful AI assistant built on Claude by Anthropic. Be helpful, accurate, and direct.

Current date and time: ${dateStr}, ${timeStr}

IMPORTANT — always follow these rules:
1. You KNOW today's date — always answer date/time questions accurately using the date above.
2. Wrap ALL code and file content in fenced code blocks with the correct language tag.
3. When asked to CREATE or GENERATE any file, give COMPLETE ready-to-use content — never truncate.
4. Always consider the full conversation history when answering follow-up questions.
5. Be concise — no unnecessary disclaimers.`;
}
const BASE_SYSTEM_PROMPT = getBaseSystemPrompt();

function autoTitle(text) {
  return text.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6).join(' ') || 'New Chat';
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const { message, conversationId, model: requestedModel } = req.body;
  if (!message || !conversationId)
    return res.status(400).json({ error: 'message and conversationId required' });

  try {
    const userId   = req.user.id;
    const userPlan = await getActivePlan(userId);
    const hasFile  = !!req.file;

    // ── 1. Resolve model with plan + trial checks ─────────────────────────────
    const modelResult = await resolveModel(requestedModel, userId, userPlan, hasFile);
    if (modelResult.error) return res.status(modelResult.error.status).json(modelResult.error.body);
    let { chosenModel, trialInfo } = modelResult;

    // ── 2. Rate limit ─────────────────────────────────────────────────────────
    const rateLimit = await checkRateLimit(userId, userPlan, chosenModel.free);
    if (rateLimit.exceeded) {
      const { window, count, limit, retryAt, dayCount, dayLimit, weekCount, weekLimit } = rateLimit;
      const label    = window === 'daily' ? '24 hours' : window === 'fiveHour' ? '5 hours' : '7 days';
      const retryMsg = retryAt ? ` Try again at ${new Date(retryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
      return res.status(403).json({ error: `Limit reached (${limit} msgs/${label} on ${userPlan} plan).${retryMsg}`, limitReached: true, window, count, limit, retryAt, dayCount, dayLimit, weekCount, weekLimit, plan: userPlan });
    }

    const { dayCount, dayLimit, weekCount, weekLimit, fiveHourCount: hourCount, fiveHourLimit: hourLimit } = rateLimit;

    // ── 3. Per-model daily cap ────────────────────────────────────────────────
    const modelLimit = await checkModelDailyLimit(userId, chosenModel.id, userPlan);
    if (modelLimit.exceeded) {
      return res.status(429).json({ error: 'Model daily limit reached', modelLimitExceeded: true, modelId: modelLimit.modelId, limit: modelLimit.limit, count: modelLimit.count, retryAt: modelLimit.retryAt });
    }

    // ── 4. API budget check — silent fallback ─────────────────────────────────
    const budget          = await checkBudget(userId, userPlan);
    const budgetExhausted = userPlan !== 'free' && !budget.hasbudget;
    if (budgetExhausted && chosenModel.requiredPlan) {
      console.log(`💸 Budget fallback: ${chosenModel.id} → groq`);
      chosenModel = STATIC_MODELS['claude-haiku-4-6'] || STATIC_MODELS['claude-haiku-4-5-20251001'];
    }

    // ── 5. Extended thinking for opus ─────────────────────────────────────────
    const enableThinking = chosenModel.id === 'claude-opus-4-6' && message.length > 100;

    console.log(`💬 "${message.slice(0,40)}" plan=${userPlan} → ${chosenModel.provider}:${chosenModel.id}${enableThinking ? ' [thinking]' : ''}`);

    // ── 6. Load conversation + save user message ──────────────────────────────
    const conv = await prisma.conversation.findFirst({
      where:   { id: conversationId, userId },
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
      data: { role: 'user', content: message, conversationId, fileUrl, fileName, fileType, modelUsed: chosenModel.id },
    });

    // ── 7. Cache check ────────────────────────────────────────────────────────
    const existingCount = conv.messages.length;
    const skipCache     = shouldSkipCache(message, existingCount);
    const cachedAnswer  = skipCache ? null : await checkCache(message, hasFile);

    if (cachedAnswer) {
      console.log('⚡ CACHE HIT — FREE!');
      startSSE(res);
      const words = cachedAnswer.split(' ');
      for (let i = 0; i < words.length; i++) {
        send(res, { type: 'text', text: (i === 0 ? '' : ' ') + words[i], fromCache: true });
        if (i % 8 === 0) await new Promise(r => setTimeout(r, 8));
      }
      await prisma.message.create({ data: { role: 'assistant', content: cachedAnswer, conversationId } });
      await updateConvTitle(conv, conversationId, message, res);
      send(res, { type: 'done', fromCache: true, usage: { hourCount: (hourCount||0)+1, hourLimit, dayCount: dayCount+1, dayLimit, weekCount: weekCount+1, weekLimit, plan: userPlan } });
      return res.end();
    }

    // ── 8. Build system prompt ────────────────────────────────────────────────
    const basePrompt   = conv.project?.systemPrompt || BASE_SYSTEM_PROMPT;
    const userMemory   = await getUserMemory(userId);
    const langInstr    = getLangInstruction(req.body.lang || 'en');
    const systemPrompt = buildSystemPrompt(basePrompt, userMemory, langInstr);

    const history = [
      ...conv.messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // ── 9. Stream AI response ─────────────────────────────────────────────────
    startSSE(res);
    const fullResponse = await callProvider(chosenModel, systemPrompt, history, res, enableThinking);

    console.log(`✅ Done — ${chosenModel.provider} len=${fullResponse.length}`);

    // ── 10. Post-response saves (non-blocking where possible) ─────────────────
    await prisma.message.create({ data: { role: 'assistant', content: fullResponse, conversationId } });

    if (trialInfo) {
      await incrementTrial(userId, chosenModel.id);
      console.log(`🎁 Trial used: ${chosenModel.id} — ${trialInfo.remaining - 1} remaining`);
    }

    const costMicro = await logApiUsage({ userId, modelId: chosenModel.id, inputText: message, outputText: fullResponse });
    if (costMicro > 0) console.log(`💰 Cost: $${(costMicro/1_000_000).toFixed(6)}`);

    if (!skipCache) await storeInCache(message, fullResponse, chosenModel.id, hasFile);

    // Memory update is fire-and-forget — never delays the user
    updateUserMemory(userId, message, fullResponse).catch(e =>
      console.warn('⚠️ Memory update failed:', e.message)
    );

    await updateConvTitle(conv, conversationId, message, res);

    send(res, {
      type:  'done',
      usage: { hourCount: (hourCount||0)+1, hourLimit, dayCount: dayCount+1, dayLimit, weekCount: weekCount+1, weekLimit, plan: userPlan, budgetPct: budget.pct, budgetExhausted },
      trial: trialInfo ? { modelId: chosenModel.id, remaining: trialInfo.remaining - 1 } : null,
    });
    res.end();

  } catch (e) {
    console.error('❌ Chat error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else { send(res, { type: 'error', error: e.message }); res.end(); }
  }
});

// Helper — update conversation title on first message
async function updateConvTitle(conv, conversationId, message, res) {
  if (conv.title === 'New Chat' && conv.messages.length === 0) {
    const title = autoTitle(message);
    await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
    send(res, { type: 'title', title });
  } else {
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/usage
// ─────────────────────────────────────────────────────────────────────────────
router.get('/usage', authenticate, async (req, res) => {
  try {
    const userPlan = await getActivePlan(req.user.id);
    const limits   = RATE_LIMITS[userPlan] || RATE_LIMITS.free;
    const now      = Date.now();
    const count    = (since) => prisma.message.count({ where: { role: 'user', conversation: { userId: req.user.id }, createdAt: { gte: new Date(since) } } });

    const [fiveHourCount, dayCount, weekCount] = await Promise.all([
      count(now - 5 * 3600000),
      count(now - 86400000),
      count(now - 7 * 86400000),
    ]);

    res.json({ hourCount: fiveHourCount, hourLimit: limits.fiveHour, dayCount, dayLimit: limits.daily, weekCount, weekLimit: limits.weekly, plan: userPlan });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/flywheel-stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/flywheel-stats', authenticate, async (req, res) => {
  res.json(await getFlywheelStats());
});

export default router;