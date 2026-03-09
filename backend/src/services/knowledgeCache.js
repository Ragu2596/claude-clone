// backend/src/services/knowledgeCache.js
//
// ─── FLYWHEEL / KNOWLEDGE CACHE ──────────────────────────────────────────────
//
// HOW IT WORKS:
//   1. User sends a message
//   2. We normalize + hash the question
//   3. Check DB for exact or near-match → if found, return cached answer FREE
//   4. If not found → call paid AI API → stream response to user
//   5. After streaming → save Q&A to DB for future users
//   6. Next user who asks the same (or similar) thing → served from DB, zero cost
//
// RESULT: Every paid API call makes the next one cheaper
//         More users = more cache hits = less API cost = more profit
//
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── How similar two strings need to be to count as a cache hit (0-1) ─────────
const SIMILARITY_THRESHOLD = 0.82; // 82% similarity = cache hit

// ── Don't cache short/personal/file messages ─────────────────────────────────
const MIN_QUESTION_LENGTH = 15;   // chars — too short = likely personal/unclear
const MAX_QUESTION_LENGTH = 2000; // chars — very long = likely unique/personal

// ── Normalize question for consistent hashing ─────────────────────────────────
// Removes punctuation, extra spaces, lowercases, removes filler words
function normalizeQuestion(q) {
  return q
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:'"()[\]{}\-]/g, ' ')  // remove punctuation
    .replace(/\b(please|can you|could you|i want|i need|tell me|what is|what are|how do|how does|how to|explain|describe|give me|show me|help me|would you|will you)\b/g, '') // remove filler
    .replace(/\s+/g, ' ')                   // collapse spaces
    .trim();
}

// ── Hash a normalized question ────────────────────────────────────────────────
function hashQuestion(normalized) {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ── Simple word-overlap similarity score (Jaccard similarity) ─────────────────
// Fast, no ML needed, works well for factual questions
function similarity(a, b) {
  const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}
async function getEmbedding(text) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text.slice(0, 2000) }] },
        }),
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.embedding?.values || null;
  } catch (e) {
    console.warn('Embedding error:', e.message);
    return null;
  }
}
// ── Auto-detect topic from question ──────────────────────────────────────────
function detectTopic(message) {
  const m = message.toLowerCase();
  if (/(code|function|bug|error|api|database|sql|python|javascript|react|node|css|html|git|deploy|docker|kubernetes|algorithm|array|object|class|component|hook|async|promise|typescript|java|cpp|rust|golang)/.test(m)) return 'coding';
  if (/(math|equation|calculus|algebra|geometry|statistics|probability|integral|derivative|matrix|vector|formula|calculate|solve|proof)/.test(m)) return 'math';
  if (/(write|essay|email|letter|story|poem|grammar|paragraph|summarize|translate|explain|describe|content|blog|report|document)/.test(m)) return 'writing';
  if (/(science|physics|chemistry|biology|medical|health|disease|evolution|astronomy|quantum|atom|molecule|experiment|research)/.test(m)) return 'science';
  if (/(history|politics|economy|business|finance|investment|startup|marketing|management|strategy|legal|law)/.test(m)) return 'business';
  if (/(ai|machine learning|neural network|llm|gpt|model|training|dataset|nlp|computer vision|deep learning)/.test(m)) return 'ai';
  return 'general';
}

// ── Score answer quality 0-1 ──────────────────────────────────────────────────
// Higher score = better answer = serve more confidently from cache
function scoreQuality(question, answer) {
  if (!answer || answer.length < 50)  return 0.1; // too short
  if (answer.length > 200)            return 0.6; // decent length base score

  let score = 0.5;
  // Rewards
  if (answer.length > 500)                                    score += 0.1;  // detailed
  if (answer.includes('```'))                                 score += 0.1;  // has code
  if (/[0-9]/.test(answer))                                   score += 0.05; // has numbers
  if (answer.split('\n').length > 3)                          score += 0.05; // structured
  if (/example|for instance|such as/i.test(answer))          score += 0.05; // has examples
  // Penalties
  if (/i (don't|cannot|can't) know/i.test(answer))           score -= 0.3;  // uncertain
  if (/i'm not sure/i.test(answer))                           score -= 0.2;
  if (/as an ai/i.test(answer))                               score -= 0.1;  // meta

  return Math.max(0.1, Math.min(1.0, score));
}

// ── Should we cache this message? ─────────────────────────────────────────────
function isCacheable(message, hasFile) {
  if (hasFile)                              return false; // files = unique context
  if (message.length < MIN_QUESTION_LENGTH) return false; // too short
  if (message.length > MAX_QUESTION_LENGTH) return false; // too long/personal

  const lower = message.toLowerCase();

  // Personal/context-specific patterns — never cache these
  const personal = [
    'my ', 'i am', "i'm", 'my name', 'my email', 'my account', 'my plan',
    'my project', 'my code', 'my app', 'my file', 'my data', 'fix my',
    'this code', 'this file', 'this error', 'above code', 'above text',
    'you said', 'you told', 'earlier you', 'continue', 'as i mentioned',
  ];
  if (personal.some(p => lower.includes(p))) return false;

  // Only cache factual/knowledge questions
  const cacheable = [
    'what is', 'what are', 'how does', 'how do', 'how to', 'explain',
    'difference between', 'define', 'example of', 'what does', 'why is',
    'why does', 'when did', 'when was', 'who is', 'who was', 'which is',
    'what happens', 'how many', 'what causes', 'benefits of', 'advantages of',
    'disadvantages of', 'compare', 'vs ', 'versus', 'best way to', 'steps to',
    'history of', 'meaning of', 'types of',
  ];
  if (!cacheable.some(p => lower.includes(p))) return false;

  return true;
}

// ─── CHECK CACHE ──────────────────────────────────────────────────────────────
// Returns cached answer string if found, null if not
export async function checkCache(message, hasFile = false) {
  try {
    if (!isCacheable(message, hasFile)) return null;

    const normalized = normalizeQuestion(message);
    const hash       = hashQuestion(normalized);

    // 1. Exact hash match (fastest — O(1) index lookup)
    const exact = await prisma.knowledgeCache.findUnique({
      where: { questionHash: hash },
    });

    if (exact) {
      // Update hit count and saved cost estimate
      await prisma.knowledgeCache.update({
        where: { id: exact.id },
        data:  { hitCount: { increment: 1 }, updatedAt: new Date() },
      });
      await trackCacheHit(true);
      console.log(`⚡ Cache HIT (exact) — saved ~$0.004 | hits=${exact.hitCount + 1} | "${message.slice(0, 50)}"`);
      return exact.answer;
    }


    // 2. Vector similarity search
    const embedding = await getEmbedding(message);
    if (embedding) {
      const vectorStr = `[${embedding.join(',')}]`;
      try {
        const results = await prisma.$queryRaw`
          SELECT id, question, answer, "hitCount",
                 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "KnowledgeCache"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT 5
        `;
        for (const row of results) {
          if (parseFloat(row.similarity) >= 0.88) {
            await prisma.knowledgeCache.update({ where: { id: row.id }, data: { hitCount: { increment: 1 } } });
            await trackCacheHit(true);
            console.log(`⚡ Cache HIT (vector ${Math.round(row.similarity * 100)}%) | "${message.slice(0, 50)}"`);
            return row.answer;
          }
        }
      } catch (_) {}
    }

    // 2. Fuzzy match — check recent 500 entries for similar questions
    // Only runs when no exact match found
    const recent = await prisma.knowledgeCache.findMany({
      take:    500,
      orderBy: { hitCount: 'desc' }, // most popular first = better cache hits
      select:  { id: true, question: true, answer: true, hitCount: true },
    });

    for (const entry of recent) {
      const entryNorm  = normalizeQuestion(entry.question);
      const score      = similarity(normalized, entryNorm);

      if (score >= SIMILARITY_THRESHOLD) {
        await prisma.knowledgeCache.update({
          where: { id: entry.id },
          data:  { hitCount: { increment: 1 }, updatedAt: new Date() },
        });
        await trackCacheHit(true);
        console.log(`⚡ Cache HIT (fuzzy ${Math.round(score * 100)}%) — "${message.slice(0, 50)}"`);
        return entry.answer;
      }
    }

    await trackCacheHit(false);
    return null; // cache miss — will call AI API

  } catch (e) {
    console.error('Cache check error:', e.message);
    return null; // on error, always proceed to AI (fail safe)
  }
}

// ─── STORE IN CACHE ───────────────────────────────────────────────────────────
// Called AFTER AI responds — saves Q&A for future users
export async function storeInCache(message, answer, modelId = 'unknown', hasFile = false) {
  try {
    if (!isCacheable(message, hasFile)) return; // don't cache personal/short messages
    if (!answer || answer.length < 20)  return; // don't cache empty/error responses

    const normalized = normalizeQuestion(message);
    const hash       = hashQuestion(normalized);

    // upsert — if same hash exists (race condition), just update
    const topic   = detectTopic(message);
    const quality  = scoreQuality(message, answer);

 const embedding = await getEmbedding(message);
    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;

    if (vectorStr) {
      await prisma.$executeRaw`
        INSERT INTO "KnowledgeCache" (id, "questionHash", question, answer, model, topic, quality, embedding, "hitCount", "savedCost", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${hash}, ${message.slice(0,2000)}, ${answer.slice(0,8000)}, ${modelId}, ${topic}, ${quality}, ${vectorStr}::vector, 1, 0, NOW(), NOW())
        ON CONFLICT ("questionHash") DO UPDATE SET
          answer = CASE WHEN ${quality} > "KnowledgeCache".quality THEN ${answer.slice(0,8000)} ELSE "KnowledgeCache".answer END,
          quality = CASE WHEN ${quality} > "KnowledgeCache".quality THEN ${quality} ELSE "KnowledgeCache".quality END,
          embedding = EXCLUDED.embedding,
          "updatedAt" = NOW()
      `;
    } else {
      await prisma.knowledgeCache.upsert({
        where:  { questionHash: hash },
        create: { questionHash: hash, question: message.slice(0,2000), answer: answer.slice(0,8000), model: modelId, topic, quality, hitCount: 1, savedCost: 0 },
        update: { ...(quality > 0.6 ? { answer: answer.slice(0,8000), quality, model: modelId } : {}), updatedAt: new Date() },
      });
    }

    const cacheSize = await prisma.knowledgeCache.count();
    console.log(`💾 Cached Q&A | model=${modelId} | total=${cacheSize} | "${message.slice(0, 50)}"`);

  } catch (e) {
    console.error('Cache store error:', e.message);
    // Non-critical — user already got their answer, don't throw
  }
}

// ─── TRACK HIT/MISS IN DAILY STATS ───────────────────────────────────────────
async function trackCacheHit(isHit) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.cacheStats.upsert({
      where:  { date: today },
      create: { date: today, totalHits: isHit ? 1 : 0, totalMisses: isHit ? 0 : 1 },
      update: isHit
        ? { totalHits:   { increment: 1 } }
        : { totalMisses: { increment: 1 } },
    });
  } catch (_) {} // non-critical
}

// ─── FLYWHEEL STATS ───────────────────────────────────────────────────────────
// Called by GET /api/chat/flywheel-stats (admin dashboard)
export async function getFlywheelStats() {
  try {
    const [totalEntries, topHits, stats7d, recentMisses] = await Promise.all([

      // Total cached Q&As
      prisma.knowledgeCache.count(),

      // Top 5 most reused answers
      prisma.knowledgeCache.findMany({
        take:    5,
        orderBy: { hitCount: 'desc' },
        select:  { question: true, hitCount: true, model: true, createdAt: true },
      }),

      // Last 7 days hit/miss stats
      prisma.cacheStats.findMany({
        take:    7,
        orderBy: { date: 'desc' },
        select:  { date: true, totalHits: true, totalMisses: true },
      }),

      // Last 10 cache misses (questions not yet cached = opportunities)
      prisma.knowledgeCache.findMany({
        take:    10,
        orderBy: { createdAt: 'desc' },
        where:   { hitCount: 1 }, // only seen once = fresh misses
        select:  { question: true, createdAt: true, model: true },
      }),
    ]);

    const totalHits   = stats7d.reduce((s, d) => s + d.totalHits,   0);
    const totalMisses = stats7d.reduce((s, d) => s + d.totalMisses, 0);
    const hitRate     = totalHits + totalMisses > 0
      ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
      : 0;

    // Estimated savings: avg $0.004 per cache hit (mid-tier model cost)
    const estimatedSavings = (totalHits * 0.004).toFixed(2);

    return {
      totalEntries,
      hitRate,        // % of requests served from cache
      totalHits,
      totalMisses,
      estimatedSavings, // $ saved in last 7 days
      topHits:  topHits.map(h => ({
        question: h.question.slice(0, 80),
        hitCount: h.hitCount,
        model:    h.model,
      })),
      dailyStats: stats7d.reverse().map(d => ({
        date:   d.date,
        hits:   d.totalHits,
        misses: d.totalMisses,
        rate:   d.totalHits + d.totalMisses > 0
          ? Math.round((d.totalHits / (d.totalHits + d.totalMisses)) * 100)
          : 0,
      })),
      recentMisses: recentMisses.map(m => ({
        question: m.question.slice(0, 80),
        model:    m.model,
        at:       m.createdAt,
      })),
    };
  } catch (e) {
    console.error('Flywheel stats error:', e.message);
    return { totalEntries: 0, hitRate: 0, totalHits: 0, totalMisses: 0 };
  }
}