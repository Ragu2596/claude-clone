import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cost per 1K tokens (approx) for each model
const MODEL_COSTS = {
  'claude-sonnet-4-20250514':  0.003,
  'claude-haiku-4-5-20251001': 0.00025,
  'gpt-4o':                    0.005,
  'gpt-4o-mini':               0.00015,
  'gemini-2.0-flash':          0.0001,
  'gemini-1.5-pro':            0.00125,
  'llama-3.3-70b-versatile':   0.0,
  'mixtral-8x7b-32768':        0.0,
  'auto':                      0.002,
};

/**
 * Normalize a question for consistent hashing:
 * - lowercase
 * - remove punctuation
 * - collapse whitespace
 * Only cache simple factual questions (not conversational context)
 */
function normalizeQuestion(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashQuestion(normalized) {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Estimate cost saved by serving from cache instead of API
 */
function estimateCost(answer, model) {
  const tokens = Math.ceil(answer.length / 4); // rough: 4 chars per token
  const costPer1k = MODEL_COSTS[model] || 0.002;
  return (tokens / 1000) * costPer1k;
}

/**
 * Check if question is cacheable:
 * - Single-turn (no personal context like "my", "I am", "remember")
 * - Not a file upload question
 * - Reasonably short question (< 500 chars)
 */
function isCacheable(message, hasFile) {
  if (hasFile) return false;
  if (message.length > 500) return false;

  // Don't cache personal/contextual questions
  const personalPatterns = [
    /\b(my|mine|i am|i'm|i have|i've|i was|i need|i want|tell me about me|our|we are|we have)\b/i,
    /\b(above|previous|earlier|last message|you said|you told)\b/i,
    /\b(continue|follow up|also|furthermore|additionally)\b/i,
  ];
  for (const p of personalPatterns) {
    if (p.test(message)) return false;
  }

  return true;
}

/**
 * DB FIRST: Check cache before calling API
 * Returns cached answer or null
 */
export async function checkCache(message, hasFile = false) {
  if (!isCacheable(message, hasFile)) {
    return null;
  }

  const normalized = normalizeQuestion(message);
  const hash = hashQuestion(normalized);

  try {
    const cached = await prisma.knowledgeCache.findUnique({
      where: { questionHash: hash }
    });

    if (cached) {
      // Increment hit count and update stats
      const cost = estimateCost(cached.answer, cached.model);
      await prisma.knowledgeCache.update({
        where: { id: cached.id },
        data: {
          hitCount:  { increment: 1 },
          savedCost: { increment: cost },
        }
      });

      // Update daily stats
      await updateDailyStats({ hit: true, cost });

      console.log(`⚡ CACHE HIT [${hash.slice(0,8)}] hitCount=${cached.hitCount + 1} saved=$${cost.toFixed(4)}`);
      return cached.answer;
    }

    return null;
  } catch (e) {
    console.error('Cache check error:', e.message);
    return null; // fail silently, fall through to API
  }
}

/**
 * API LAST: After getting API response, store in DB forever
 */
export async function storeInCache(message, answer, model, hasFile = false) {
  if (!isCacheable(message, hasFile)) return;
  if (!answer || answer.length < 20) return;

  const normalized = normalizeQuestion(message);
  const hash = hashQuestion(normalized);
  const cost = estimateCost(answer, model);

  try {
    await prisma.knowledgeCache.upsert({
      where: { questionHash: hash },
      create: {
        questionHash: hash,
        question: message.slice(0, 2000),
        answer,
        model,
        hitCount:  1,
        savedCost: 0,
      },
      update: {
        answer,           // update if answer improved
        model,
        updatedAt: new Date(),
      }
    });

    // Update daily stats - this was an API miss
    await updateDailyStats({ hit: false, cost: 0 });

    console.log(`💾 CACHED [${hash.slice(0,8)}] model=${model} len=${answer.length}`);
  } catch (e) {
    console.error('Cache store error:', e.message);
  }
}

async function updateDailyStats({ hit, cost }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const existing = await prisma.cacheStats.findFirst({
      where: { date: { gte: today } }
    });

    if (existing) {
      await prisma.cacheStats.update({
        where: { id: existing.id },
        data: {
          totalHits:   hit ? { increment: 1 } : undefined,
          totalMisses: !hit ? { increment: 1 } : undefined,
          costSaved:   hit ? { increment: cost } : undefined,
        }
      });
    } else {
      await prisma.cacheStats.create({
        data: {
          totalHits:   hit ? 1 : 0,
          totalMisses: hit ? 0 : 1,
          costSaved:   hit ? cost : 0,
        }
      });
    }
  } catch (e) {
    // non-critical
  }
}

/**
 * Get flywheel stats for dashboard
 */
export async function getFlywheelStats() {
  try {
    const [totalCached, totalHits, totalSaved, topQuestions, recentStats] = await Promise.all([
      prisma.knowledgeCache.count(),
      prisma.knowledgeCache.aggregate({ _sum: { hitCount: true } }),
      prisma.knowledgeCache.aggregate({ _sum: { savedCost: true } }),
      prisma.knowledgeCache.findMany({
        orderBy: { hitCount: 'desc' },
        take: 5,
        select: { question: true, hitCount: true, model: true }
      }),
      prisma.cacheStats.findMany({
        orderBy: { date: 'desc' },
        take: 7,
      })
    ]);

    const hits   = totalHits._sum.hitCount || 0;
    const misses = recentStats.reduce((a, s) => a + s.totalMisses, 0);
    const hitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;

    return {
      totalCached,
      totalHits: hits,
      totalSavedUSD: (totalSaved._sum.savedCost || 0).toFixed(4),
      hitRate,
      topQuestions,
      recentStats,
    };
  } catch (e) {
    return { error: e.message };
  }
}
