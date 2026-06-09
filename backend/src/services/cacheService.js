// backend/src/services/cacheService.js
// Knowledge flywheel cache. Unchanged logic from knowledgeCache.js,
// renamed to follow the *Service naming convention.

import crypto from 'crypto';
import prisma from '../lib/prisma.js';

const SIMILARITY_THRESHOLD = 0.82;
const MIN_Q_LEN = 15;
const MAX_Q_LEN = 2000;

function normalizeQuestion(q) {
  return q
    .toLowerCase().trim()
    .replace(/[?!.,;:'"()[\]{}\-]/g, ' ')
    .replace(/\b(please|can you|could you|i want|i need|tell me|what is|what are|how do|how does|how to|explain|describe|give me|show me|help me|would you|will you)\b/g, '')
    .replace(/\s+/g, ' ').trim();
}

function hashQuestion(normalized) {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function similarity(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2));
  const wb = new Set(b.split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  return intersection / (wa.size + wb.size - intersection);
}

async function getEmbedding(text) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: text.slice(0, 2000) }] } }) }
    );
    if (!res.ok) return null;
    return (await res.json())?.embedding?.values || null;
  } catch { return null; }
}

function detectTopic(message) {
  const m = message.toLowerCase();
  if (/(code|function|bug|error|api|sql|python|javascript|react|node|css|html|git|docker|algorithm|typescript|java|rust)/.test(m)) return 'coding';
  if (/(math|equation|calculus|algebra|geometry|statistics|probability|integral|derivative|formula|calculate)/.test(m)) return 'math';
  if (/(write|essay|email|letter|story|poem|grammar|paragraph|summarize|translate|content|blog|report)/.test(m)) return 'writing';
  if (/(science|physics|chemistry|biology|medical|health|astronomy|quantum|atom|molecule)/.test(m)) return 'science';
  if (/(history|politics|economy|business|finance|investment|marketing|management|legal)/.test(m)) return 'business';
  if (/(ai|machine learning|neural network|llm|gpt|model|training|nlp)/.test(m)) return 'ai';
  return 'general';
}

function scoreQuality(question, answer) {
  if (!answer || answer.length < 50) return 0.1;
  let score = answer.length > 200 ? 0.6 : 0.5;
  if (answer.length > 500)                         score += 0.1;
  if (answer.includes('```'))                      score += 0.1;
  if (/[0-9]/.test(answer))                        score += 0.05;
  if (answer.split('\n').length > 3)               score += 0.05;
  if (/example|for instance|such as/i.test(answer)) score += 0.05;
  if (/i (don't|cannot|can't) know/i.test(answer)) score -= 0.3;
  if (/i'm not sure/i.test(answer))                score -= 0.2;
  if (/as an ai/i.test(answer))                    score -= 0.1;
  return Math.max(0.1, Math.min(1.0, score));
}

export function isCacheable(message, hasFile) {
  if (hasFile || message.length < MIN_Q_LEN || message.length > MAX_Q_LEN) return false;
  const lower = message.toLowerCase();
  const personal = ['my ', 'i am', "i'm", 'my name', 'my email', 'my code', 'this code', 'this file', 'this error', 'you said', 'continue'];
  if (personal.some(p => lower.includes(p))) return false;
  const cacheable = ['what is', 'what are', 'how does', 'how do', 'how to', 'explain', 'difference between', 'define', 'example of', 'what does', 'why is', 'why does', 'when did', 'who is', 'which is', 'what happens', 'how many', 'types of', 'benefits of', 'compare', 'vs ', 'versus'];
  return cacheable.some(p => lower.includes(p));
}

export function shouldSkipCache(message, existingMessageCount) {
  if (existingMessageCount > 0) return true;
  if (message.length < 40) return true;
  const lower = message.toLowerCase().trim();
  const contextual = ['show me', 'give me', 'can you', 'what about', 'explain more', 'tell me more', 'also', 'another', 'more ', 'now ', 'then ', 'next ', 'make it', 'change ', 'update ', 'fix ', 'same ', 'that ', 'this ', 'it ', 'the above', 'previous', 'last ', 'again', 'redo'];
  return contextual.some(p => lower.startsWith(p));
}

async function trackCacheHit(isHit) {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await prisma.cacheStats.upsert({
      where: { date: today },
      create: { date: today, totalHits: isHit ? 1 : 0, totalMisses: isHit ? 0 : 1 },
      update: isHit ? { totalHits: { increment: 1 } } : { totalMisses: { increment: 1 } },
    });
  } catch {}
}

export async function checkCache(message, hasFile = false) {
  try {
    if (!isCacheable(message, hasFile)) return null;
    const normalized = normalizeQuestion(message);
    const hash       = hashQuestion(normalized);

    const exact = await prisma.knowledgeCache.findUnique({ where: { questionHash: hash } });
    if (exact) {
      await prisma.knowledgeCache.update({ where: { id: exact.id }, data: { hitCount: { increment: 1 } } });
      await trackCacheHit(true);
      console.log(`⚡ Cache HIT (exact) | hits=${exact.hitCount + 1}`);
      return exact.answer;
    }

    const embedding = await getEmbedding(message);
    if (embedding) {
      const vectorStr = `[${embedding.join(',')}]`;
      try {
        const results = await prisma.$queryRaw`
          SELECT id, question, answer, "hitCount",
                 1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "KnowledgeCache"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorStr}::vector LIMIT 5`;
        for (const row of results) {
          if (parseFloat(row.similarity) >= 0.88) {
            await prisma.knowledgeCache.update({ where: { id: row.id }, data: { hitCount: { increment: 1 } } });
            await trackCacheHit(true);
            console.log(`⚡ Cache HIT (vector ${Math.round(row.similarity * 100)}%)`);
            return row.answer;
          }
        }
      } catch {}
    }

    const recent = await prisma.knowledgeCache.findMany({ take: 500, orderBy: { hitCount: 'desc' }, select: { id: true, question: true, answer: true, hitCount: true } });
    for (const entry of recent) {
      const score = similarity(normalized, normalizeQuestion(entry.question));
      if (score >= SIMILARITY_THRESHOLD) {
        await prisma.knowledgeCache.update({ where: { id: entry.id }, data: { hitCount: { increment: 1 } } });
        await trackCacheHit(true);
        console.log(`⚡ Cache HIT (fuzzy ${Math.round(score * 100)}%)`);
        return entry.answer;
      }
    }

    await trackCacheHit(false);
    return null;
  } catch (e) {
    console.error('Cache check error:', e.message);
    return null;
  }
}

export async function storeInCache(message, answer, modelId = 'unknown', hasFile = false) {
  try {
    if (!isCacheable(message, hasFile) || !answer || answer.length < 20) return;

    const normalized = normalizeQuestion(message);
    const hash       = hashQuestion(normalized);
    const topic      = detectTopic(message);
    const quality    = scoreQuality(message, answer);
    const embedding  = await getEmbedding(message);

    if (embedding) {
      const vectorStr = `[${embedding.join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO "KnowledgeCache" (id, "questionHash", question, answer, model, topic, quality, embedding, "hitCount", "savedCost", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${hash}, ${message.slice(0,2000)}, ${answer.slice(0,8000)}, ${modelId}, ${topic}, ${quality}, ${vectorStr}::vector, 1, 0, NOW(), NOW())
        ON CONFLICT ("questionHash") DO UPDATE SET
          answer = CASE WHEN ${quality} > "KnowledgeCache".quality THEN ${answer.slice(0,8000)} ELSE "KnowledgeCache".answer END,
          quality = CASE WHEN ${quality} > "KnowledgeCache".quality THEN ${quality} ELSE "KnowledgeCache".quality END,
          embedding = EXCLUDED.embedding, "updatedAt" = NOW()`;
    } else {
      await prisma.knowledgeCache.upsert({
        where:  { questionHash: hash },
        create: { questionHash: hash, question: message.slice(0,2000), answer: answer.slice(0,8000), model: modelId, topic, quality, hitCount: 1, savedCost: 0 },
        update: { ...(quality > 0.6 ? { answer: answer.slice(0,8000), quality, model: modelId } : {}), updatedAt: new Date() },
      });
    }

    const cacheSize = await prisma.knowledgeCache.count();
    console.log(`💾 Cached Q&A | model=${modelId} | total=${cacheSize}`);
  } catch (e) {
    console.error('Cache store error:', e.message);
  }
}

export async function getFlywheelStats() {
  try {
    const [totalEntries, topHits, stats7d] = await Promise.all([
      prisma.knowledgeCache.count(),
      prisma.knowledgeCache.findMany({ take: 5, orderBy: { hitCount: 'desc' }, select: { question: true, hitCount: true, model: true } }),
      prisma.cacheStats.findMany({ take: 7, orderBy: { date: 'desc' }, select: { date: true, totalHits: true, totalMisses: true } }),
    ]);
    const totalHits   = stats7d.reduce((s, d) => s + d.totalHits, 0);
    const totalMisses = stats7d.reduce((s, d) => s + d.totalMisses, 0);
    const hitRate     = totalHits + totalMisses > 0 ? Math.round(totalHits / (totalHits + totalMisses) * 100) : 0;
    return { totalEntries, hitRate, totalHits, totalMisses, estimatedSavings: (totalHits * 0.004).toFixed(2), topHits: topHits.map(h => ({ question: h.question.slice(0,80), hitCount: h.hitCount, model: h.model })), dailyStats: stats7d.reverse() };
  } catch (e) {
    return { totalEntries: 0, hitRate: 0, totalHits: 0, totalMisses: 0 };
  }
}
