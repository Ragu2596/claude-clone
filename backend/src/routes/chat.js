import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { checkCache, storeInCache, getFlywheelStats } from '../services/knowledgeCache.js';
import { logApiUsage, checkBudget, PLAN_BUDGETS } from '../services/costTracker.js';
import { syncModels } from '../services/modelSync.js';
import dotenv from 'dotenv';
import { getUserMemory, updateUserMemory } from '../services/userMemory.js';
dotenv.config();

const router = express.Router();

// ── Language code → instruction map ──────────────────────────────────────────
const LANG_INSTRUCTIONS = {
  en: '',  // default — no instruction needed
  hi: 'IMPORTANT: You MUST respond entirely in Hindi (हिन्दी). Do not use English.',
  ta: 'IMPORTANT: You MUST respond entirely in Tamil (தமிழ்). Do not use English.',
  te: 'IMPORTANT: You MUST respond entirely in Telugu (తెలుగు). Do not use English.',
  kn: 'IMPORTANT: You MUST respond entirely in Kannada (ಕನ್ನಡ). Do not use English.',
  mr: 'IMPORTANT: You MUST respond entirely in Marathi (मराठी). Do not use English.',
  bn: 'IMPORTANT: You MUST respond entirely in Bengali (বাংলা). Do not use English.',
  gu: 'IMPORTANT: You MUST respond entirely in Gujarati (ગુજરાતી). Do not use English.',
  pa: 'IMPORTANT: You MUST respond entirely in Punjabi (ਪੰਜਾਬੀ). Do not use English.',
  zh: 'IMPORTANT: You MUST respond entirely in Chinese (中文). Do not use English.',
  ja: 'IMPORTANT: You MUST respond entirely in Japanese (日本語). Do not use English.',
  ko: 'IMPORTANT: You MUST respond entirely in Korean (한국어). Do not use English.',
  es: 'IMPORTANT: You MUST respond entirely in Spanish (Español). Do not use English.',
  fr: 'IMPORTANT: You MUST respond entirely in French (Français). Do not use English.',
  de: 'IMPORTANT: You MUST respond entirely in German (Deutsch). Do not use English.',
  ar: 'IMPORTANT: You MUST respond entirely in Arabic (العربية). Do not use English.',
};


const prisma = new PrismaClient();

// ── Daily model sync ──────────────────────────────────────────
// Runs once on startup + every 24h to pick up new models
let lastSync = 0;
async function maybeSyncModels() {
  const now = Date.now();
  if (now - lastSync > 24 * 60 * 60 * 1000) {
    lastSync = now;
    syncModels().catch(e => console.error('⚠️ Model sync error:', e.message));
  }
}
maybeSyncModels();
const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 } });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BASE_SYSTEM_PROMPT = `You are rk.ai, a powerful AI assistant. Be helpful, accurate, and direct.

IMPORTANT — always follow these rules:
1. Wrap ALL code and file content in fenced code blocks with the correct language tag.
   Use: \`\`\`xml  \`\`\`json  \`\`\`csv  \`\`\`yaml  \`\`\`html  \`\`\`sql  \`\`\`svg  \`\`\`python  \`\`\`javascript  etc.
2. When asked to CREATE or GENERATE any file:
   - Give COMPLETE, ready-to-use content — never truncate or use placeholders
   - "Create a PDF" → generate HTML in \`\`\`html (user prints as PDF)
   - "Create a Word doc" → generate content in \`\`\`markdown
   - "Create CSV/Excel" → generate \`\`\`csv with real data
   - Multiple files → one code block per file with a filename comment at the top
3. Always consider the full conversation history when answering follow-up questions.
4. Be concise — no unnecessary disclaimers. NEVER say you cannot create or generate files — always produce the content.`;

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
  // FREE users: only Groq Llama 3.3 + Gemini Flash — everything else needs Starter+
  'auto':                      { provider: 'groq',       id: 'llama-3.3-70b-versatile',                 free: true,  requiredPlan: null      },
  'llama-3.3-70b-versatile':   { provider: 'groq',       id: 'llama-3.3-70b-versatile',                 free: true,  requiredPlan: null      },
  'mixtral-8x7b-32768':        { provider: 'groq',       id: 'mixtral-8x7b-32768',                      free: false, requiredPlan: 'starter' },
  'gemini-2.0-flash':          { provider: 'gemini',     id: 'gemini-2.0-flash',                        free: true,  requiredPlan: null      },
  'gemini-1.5-flash':          { provider: 'gemini',     id: 'gemini-1.5-flash',                        free: false, requiredPlan: 'starter' },
  'gemini-1.5-pro':            { provider: 'gemini',     id: 'gemini-1.5-pro',                          free: false, requiredPlan: 'starter' },
  'mistral-small':             { provider: 'mistral',    id: 'mistral-small-latest',                    free: false, requiredPlan: 'starter' },
  'mistral-large':             { provider: 'mistral',    id: 'mistral-large-latest',                    free: false, requiredPlan: 'starter' },
  'together-llama':            { provider: 'together',   id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', free: false, requiredPlan: 'starter' },
  'together-deepseek':         { provider: 'together',   id: 'deepseek-ai/DeepSeek-V3',                 free: false, requiredPlan: 'starter' },
  'together-qwen':             { provider: 'together',   id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',         free: false, requiredPlan: 'starter' },
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
  free:    { fiveHour: 9999, daily: 99999, weekly: 999999 }, // very limited — just to try
  starter: { fiveHour: 30,  daily: 100,  weekly: 500   }, // ₹499/mo — reasonable daily use
  pro:     { fiveHour: 60,  daily: 500,  weekly: 3000  }, // ₹999/mo — power users
  max:     { fiveHour: 150, daily: 2000, weekly: 10000 }, // ₹1999/mo — unlimited feel
};

// ── Per-model daily caps — protect against expensive model abuse ──
// Opus is 25x more expensive than Haiku — must hard-cap per day
const MODEL_DAILY_LIMITS = {
  // Anthropic
  'claude-opus-4-6':           { free: 0, starter: 0, pro: 0,   max: 20  },
  'claude-sonnet-4-6':         { free: 0, starter: 0, pro: 100, max: 300 },
  'claude-haiku-4-5-20251001': { free: 0, starter: 50, pro: 999, max: 999 },
  // OpenAI
  'o1-mini':   { free: 0, starter: 0,  pro: 30,  max: 100 },
  'gpt-4o':    { free: 0, starter: 0,  pro: 100, max: 300 },
  'gpt-4o-mini': { free: 0, starter: 50, pro: 999, max: 999 },
  // Perplexity (web search — costs money per call)
  'llama-3.1-sonar-large-128k-online': { free: 0, starter: 0,  pro: 50,  max: 200 },
  'llama-3.1-sonar-small-128k-online': { free: 0, starter: 20, pro: 100, max: 500 },
};

// DB-backed model lookup (falls back to static if DB empty)
// Models that are NOT for chat — exclude from selection always
const EXCLUDED_MODELS = [
  'llama-guard-4-12b', 'llama-guard-3-8b',
  'llama-prompt-guard-2-22m', 'llama-prompt-guard-2-86m',
  'whisper-large-v3', 'whisper-large-v3-turbo',  // audio models
];

async function selectModel(requested) {
  if (requested === 'auto') return MODELS['auto'];
  try {
    const { PrismaClient } = await import('@prisma/client');
    const p = new PrismaClient();
    const m = await p.modelConfig.findFirst({
      where: {
        modelId: requested,
        enabled: true,
        NOT: { modelId: { in: EXCLUDED_MODELS } },
      },
    });
    if (m) return { provider: m.provider, id: m.modelId, requiredPlan: m.requiredPlan, free: !m.requiredPlan };
  } catch {}
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

// ─── Free trial: 3 msgs per paid model for free users ────────
const TRIAL_LIMIT = 3;

async function getTrialStatus(userId, modelId) {
  const trial = await prisma.modelTrial.findUnique({
    where: { userId_modelId: { userId, modelId } },
  });
  const used = trial?.useCount || 0;
  const remaining = Math.max(0, TRIAL_LIMIT - used);
  return { used, remaining, exhausted: used >= TRIAL_LIMIT };
}

async function incrementTrial(userId, modelId) {
  await prisma.modelTrial.upsert({
    where:  { userId_modelId: { userId, modelId } },
    update: { useCount: { increment: 1 }, exhausted: true },
    create: { userId, modelId, useCount: 1, exhausted: false },
  });
  // Mark exhausted if reached limit
  const trial = await prisma.modelTrial.findUnique({
    where: { userId_modelId: { userId, modelId } },
  });
  if (trial && trial.useCount >= TRIAL_LIMIT) {
    await prisma.modelTrial.update({
      where: { userId_modelId: { userId, modelId } },
      data:  { exhausted: true },
    });
  }
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

// ─── Per-model daily limit check ─────────────────────────────
async function checkModelDailyLimit(userId, modelId, userPlan) {
  const limits = MODEL_DAILY_LIMITS[modelId];
  if (!limits) return { exceeded: false }; // free models — no limit

  const planLimit = limits[userPlan] ?? 0;
  if (planLimit === 999) return { exceeded: false }; // effectively unlimited

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.message.count({
    where: {
      role: 'user',
      modelUsed: modelId,
      conversation: { userId },
      createdAt: { gte: since },
    },
  });

  if (count >= planLimit) {
    return {
      exceeded:  true,
      modelId,
      count,
      limit:     planLimit,
      window:    'model_daily',
      retryAt:   new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
  return { exceeded: false, count, limit: planLimit };
}

// ─── Main rate limit check (5hr window + daily + weekly) ─────
async function checkRateLimit(userId, userPlan, modelFree = false) {
  if (modelFree) return { exceeded: false };
  const limits = RATE_LIMITS[userPlan] || RATE_LIMITS.free;
  const now    = Date.now();

  const [fiveHourCount, dayCount, weekCount] = await Promise.all([
    countMsgsInWindow(userId, new Date(now - 5 * 60 * 60 * 1000)),        // last 5h  (like Claude Pro)
    countMsgsInWindow(userId, new Date(now - 24 * 60 * 60 * 1000)),       // last 24h
    countMsgsInWindow(userId, new Date(now - 7 * 24 * 60 * 60 * 1000)),   // last 7d
  ]);

  // Check 5-hour burst window first (primary limit — like Claude Pro)
  if (fiveHourCount >= limits.fiveHour) {
    const retryAt = await nextAvailableAt(userId, 5 * 60 * 60 * 1000, limits.fiveHour);
    return {
      exceeded:      true,
      window:        'fiveHour',
      count:         fiveHourCount,
      limit:         limits.fiveHour,
      retryAt,
      dayCount,      dayLimit:  limits.daily,
      weekCount,     weekLimit: limits.weekly,
      plan:          userPlan,
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
    exceeded:      false,
    fiveHourCount, fiveHourLimit: limits.fiveHour,
    dayCount,      dayLimit:      limits.daily,
    weekCount,     weekLimit:     limits.weekly,
    plan:          userPlan,
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

function shouldSkipCache(message, existingMessageCount) {
  if (existingMessageCount > 0) return true;
  if (message.length < 40) return true;
  const lower = message.toLowerCase().trim();
  const contextual = [
    'show me','give me','can you','what about','explain more','tell me more',
    'how about','also','another','more ','now ','then ','next ','make it',
    'change ','update ','fix ','modify ','same ','that ','this ','it ',
    'the above','previous','last ','again','redo'
  ];
  return contextual.some(p => lower.startsWith(p));
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

    // Step 3: Select model + Check rate limits
    let chosenModel = await selectModel(requestedModel);
    
    const rateLimit = await checkRateLimit(req.user.id, userPlan, chosenModel.free);
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

    // Step 4: Enforce model access by plan

    if (!planAllowsModel(chosenModel, userPlan)) {
      console.log(`🔒 Model  requires , user has  — falling back to auto`);
      chosenModel = MODELS['auto'];
    }

    // Step 3a: Trial check — free users get 3 msgs per paid model
    let trialInfo = null;
    if (userPlan === 'free' && chosenModel.requiredPlan) {
      const trial = await getTrialStatus(req.user.id, chosenModel.id);
      if (trial.exhausted) {
        return res.status(403).json({
          error:         `Trial exhausted for this model. Upgrade to continue using it!`,
          trialExhausted: true,
          modelId:       chosenModel.id,
          plan:          userPlan,
        });
      }
      trialInfo = trial; // will increment after response
      console.log(`🎁 Trial: user=${req.user.id} model=${chosenModel.id} used=${trial.used}/${TRIAL_LIMIT}`);
    }

    // Step 3b: Check API budget (auto-fallback to free model if exhausted)
    const budget = await checkBudget(req.user.id, userPlan);
    const budgetExhausted = userPlan !== 'free' && !budget.hasbudget;
    if (budgetExhausted) {
      console.log(`💸 Budget exhausted: user=${req.user.id} plan=${userPlan} ${budget.used}/${budget.limit}µ$ — falling back to free model`);
    }

    // Step 5: Check per-model daily limit (e.g. Opus max 20/day)
    const modelLimit = await checkModelDailyLimit(req.user.id, chosenModel.id, userPlan);
    if (modelLimit.exceeded) {
      return res.status(429).json({
        error:       'Model daily limit reached',
        modelLimitExceeded: true,
        modelId:     modelLimit.modelId,
        limit:       modelLimit.limit,
        count:       modelLimit.count,
        retryAt:     modelLimit.retryAt,
        message:     `You've used all ${modelLimit.limit} daily messages for this model. Try again tomorrow or use a different model.`,
      });
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
      data: { role: 'user', content: message, conversationId, fileUrl, fileName, fileType, modelUsed: chosenModel.id },
    });

    // Check knowledge cache
    const hasFile      = !!req.file;
    const existingMessageCount = conv.messages.length;
    const skipCache = shouldSkipCache(message, existingMessageCount);
    const cachedAnswer = skipCache ? null : await checkCache(message, hasFile);
      if (!skipCache) console.log(`🔄 Cache skipped — ${existingMessageCount} prior msgs`);
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
    const userLang     = req.body.lang || 'en';
    const langInstr    = LANG_INSTRUCTIONS[userLang] || '';
    const userMemory   = await getUserMemory(req.user.id);
    const basePrompt   = conv.project?.systemPrompt || BASE_SYSTEM_PROMPT;
    const memoryPrompt = userMemory ? `${basePrompt}\n\n--- What I know about this user from past conversations ---\n${userMemory}\n---` : basePrompt;
    const systemPrompt = langInstr ? `${memoryPrompt}

${langInstr}` : basePrompt;

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
        fullResponse = await streamOpenAICompatible({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant', systemPrompt, history, res });
      }
    }

    console.log(`✅ Done — ${chosenModel.provider} len=${fullResponse.length} plan=${userPlan}`);

    // ── Increment trial counter if this was a trial message ─────
    if (trialInfo !== null) {
      await incrementTrial(req.user.id, chosenModel.id);
      const remaining = trialInfo.remaining - 1;
      console.log(`🎁 Trial used: ${chosenModel.id} — ${remaining} remaining`);
    }

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
    if (!skipCache) await storeInCache(message, fullResponse, chosenModel.id, hasFile);

    if (conv.title === 'New Chat' && conv.messages.length === 0) {
      const title = autoTitle(message);
      await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
      send(res, { type: 'title', title });
    } else {
      await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    send(res, { type: 'done', usage: { hourCount: hourCount+1, hourLimit, dayCount: dayCount+1, dayLimit, weekCount: weekCount+1, weekLimit, plan: userPlan, budgetPct: budget.pct, budgetExhausted }, trial: trialInfo ? { modelId: chosenModel.id, remaining: trialInfo.remaining - 1 } : null });
    res.end();

  } catch (e) {
    console.error('❌ Chat error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else { send(res, { type: 'error', error: e.message }); res.end(); }
  }
});

// ─── Current usage — called on page load so bar shows immediately ─────────────
router.get('/usage', authenticate, async (req, res) => {
  try {
    const userPlan = await getActivePlan(req.user.id);
    const limits   = RATE_LIMITS[userPlan] || RATE_LIMITS.free;
    const now      = Date.now();

    const [fiveHourCount, dayCount, weekCount] = await Promise.all([
      countMsgsInWindow(req.user.id, new Date(now - 5 * 60 * 60 * 1000)),
      countMsgsInWindow(req.user.id, new Date(now - 24 * 60 * 60 * 1000)),
      countMsgsInWindow(req.user.id, new Date(now - 7 * 24 * 60 * 60 * 1000)),
    ]);

    res.json({
      hourCount:  fiveHourCount,
      hourLimit:  limits.fiveHour,
      dayCount,
      dayLimit:   limits.daily,
      weekCount,
      weekLimit:  limits.weekly,
      plan:       userPlan,
    });
  } catch (e) {
    console.error('Usage fetch error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Flywheel stats ───────────────────────────────────────────
router.get('/flywheel-stats', authenticate, async (req, res) => {
  res.json(await getFlywheelStats());
});

export default router;