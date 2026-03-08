// ─────────────────────────────────────────────────────────────────────────────
//  costTracker.js  —  Automatic per-user API cost tracking
//
//  How it works:
//   1. Every AI response → estimate tokens → calculate cost → save to DB
//   2. Deduct from user's monthly budget (apiCostUsed / apiCostLimit)
//   3. If budget exhausted → return fallback flag → chat.js uses free model
//   4. Budget resets automatically every 30 days after payment
//
//  Costs stored in micro-dollars (µ$) to avoid float precision bugs
//  $1.00 = 1,000,000 µ$   |   $0.001 = 1,000 µ$
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Token cost table (per 1M tokens, in micro-dollars) ────────────────────────
// Source: official provider pricing pages (update monthly)
const MODEL_COSTS = {
  // FREE MODELS — near zero cost
  'llama-3.3-70b-versatile':                { input:   59, output:    79, provider: 'groq'      },
  'mixtral-8x7b-32768':                     { input:   24, output:    24, provider: 'groq'      },
  'gemini-2.0-flash':                       { input:   75, output:   300, provider: 'gemini'    },
  'gemini-1.5-flash':                       { input:   75, output:   300, provider: 'gemini'    },
  'gemini-1.5-pro':                         { input: 1250, output:  5000, provider: 'gemini'    },
  'mistral-small-latest':                   { input:  100, output:   300, provider: 'mistral'   },
  'mistral-large-latest':                   { input: 2000, output:  6000, provider: 'mistral'   },
  'meta-llama/Llama-3.3-70B-Instruct-Turbo':{ input:  880, output:  880,  provider: 'together'  },
  'deepseek-ai/DeepSeek-V3':                { input:  270, output: 1100,  provider: 'together'  },
  'Qwen/Qwen2.5-72B-Instruct-Turbo':        { input:  800, output:  800,  provider: 'together'  },

  // STARTER MODELS
  'llama-3.1-sonar-small-128k-online':      { input:  200, output:  200,  provider: 'perplexity'},
  'llama-3.1-sonar-large-128k-online':      { input: 1000, output: 1000,  provider: 'perplexity'},
  'claude-haiku-4-5-20251001':              { input:  800, output: 4000,  provider: 'anthropic' },
  'gpt-4o-mini':                            { input:  150, output:  600,  provider: 'openai'    },

  // PRO MODELS — expensive, budget matters here
  'claude-sonnet-4-20250514':               { input: 3000, output:15000,  provider: 'anthropic' },
  'gpt-4o':                                 { input: 2500, output:10000,  provider: 'openai'    },
};

// ── Monthly API budget per plan (in micro-dollars) ───────────────────────────
// This is how much you're WILLING to spend per user per month.
// Free users: $0 (free models only — near-zero cost anyway)
// Starter:    $0.80  (~₹67)  — you collect ₹199, spend max ₹67 on API
// Pro:        $3.00  (~₹250) — you collect ₹499, spend max ₹250 on API
// Max:        $8.00  (~₹665) — you collect ₹999, spend max ₹665 on API
export const PLAN_BUDGETS = {
  free:    0,
  starter:  3_000_000,   // $3.00  (~₹250) — collected ₹499
  pro:      6_000_000,   // $6.00  (~₹500) — collected ₹999
  max:     14_000_000,   // $14.00 (~₹1165) — collected ₹1999
};

// ── Rough token estimator (when API doesn't return token count) ───────────────
// ~4 chars per token is industry standard approximation
function estimateTokens(text = '') {
  return Math.ceil((text || '').length / 4);
}

// ── Calculate cost in micro-dollars ──────────────────────────────────────────
export function calculateCost(modelId, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[modelId];
  if (!costs) return 0; // unknown model = treat as free
  // cost = (tokens / 1,000,000) * cost_per_million — in µ$
  const inputCost  = Math.ceil((inputTokens  / 1_000_000) * costs.input);
  const outputCost = Math.ceil((outputTokens / 1_000_000) * costs.output);
  return inputCost + outputCost;
}

// ── Check if user has budget remaining ───────────────────────────────────────
export async function checkBudget(userId, userPlan) {
  if (userPlan === 'free') return { hasbudget: true, used: 0, limit: 0, pct: 0 };

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { apiCostUsed: true, apiCostLimit: true, apiCostReset: true },
  });
  if (!user) return { hasbudget: false, used: 0, limit: 0, pct: 100 };

  // Auto-reset if it's been 30+ days since last reset
  const daysSinceReset = (Date.now() - new Date(user.apiCostReset).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceReset >= 30) {
    await prisma.user.update({
      where: { id: userId },
      data:  { apiCostUsed: 0, apiCostReset: new Date() },
    });
    return { hasbudget: true, used: 0, limit: user.apiCostLimit, pct: 0 };
  }

  const limit    = user.apiCostLimit || PLAN_BUDGETS[userPlan] || 0;
  const used     = user.apiCostUsed  || 0;
  const pct      = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const hasbudget = used < limit;

  return { hasbudget, used, limit, pct };
}

// ── Log a completed API call & deduct from user budget ───────────────────────
export async function logApiUsage({
  userId,
  modelId,         // actual model id string
  inputText  = '', // prompt text (for token estimation)
  outputText = '', // response text
  inputTokens,     // actual token count if provider returned it
  outputTokens,    // actual token count if provider returned it
  fromCache  = false,
}) {
  try {
    // Estimate tokens if not provided
    const iTokens = inputTokens  ?? estimateTokens(inputText);
    const oTokens = outputTokens ?? estimateTokens(outputText);
    const costMicro = fromCache ? 0 : calculateCost(modelId, iTokens, oTokens);

    const provider = MODEL_COSTS[modelId]?.provider || 'unknown';

    // Save log
    await prisma.apiUsageLog.create({
      data: { userId, model: modelId, provider, inputTokens: iTokens, outputTokens: oTokens, costMicro, fromCache },
    });

    // Deduct from user budget (skip for free users & cache hits)
    if (costMicro > 0) {
      await prisma.user.update({
        where: { id: userId },
        data:  { apiCostUsed: { increment: costMicro } },
      });
    }

    return costMicro;
  } catch (err) {
    // Never crash the main chat flow because of tracking errors
    console.error('⚠️ costTracker.logApiUsage error:', err.message);
    return 0;
  }
}

// ── Set user's API budget when they pay ──────────────────────────────────────
// Call this from payment.js verify route after plan is activated
export async function activatePlanBudget(userId, plan, billing) {
  const budget = PLAN_BUDGETS[plan] || 0;
  // Yearly = same monthly budget (resets every 30 days automatically)
  await prisma.user.update({
    where: { id: userId },
    data: {
      apiCostLimit: budget,
      apiCostUsed:  0,          // reset usage on new payment
      apiCostReset: new Date(),
    },
  });
  console.log(`💰 Budget set: ${userId} → ${plan} → $${(budget/1_000_000).toFixed(2)}/mo`);
}

// ── Admin: get all users with cost summary ────────────────────────────────────
export async function getAllUserStats() {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [users, monthlyPayments, monthlyUsage] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, avatar: true,
        plan: true, planExpiresAt: true, createdAt: true,
        apiCostUsed: true, apiCostLimit: true, apiCostReset: true,
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Revenue this month
    prisma.payment.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      where: { createdAt: { gte: monthStart }, status: 'paid' },
    }),

    // API cost this month per user
    prisma.apiUsageLog.groupBy({
      by: ['userId'],
      _sum: { costMicro: true },
      where: { createdAt: { gte: monthStart } },
    }),
  ]);

  const revenueMap = Object.fromEntries(monthlyPayments.map(p => [p.userId, p._sum.amount || 0]));
  const costMap    = Object.fromEntries(monthlyUsage.map(u => [u.userId, u._sum.costMicro || 0]));

  return users.map(u => {
    const revenueInr  = revenueMap[u.id] || 0;
    const costMicro   = costMap[u.id]    || 0;
    const costUsd     = costMicro / 1_000_000;
    const costInr     = Math.round(costUsd * 84); // approx USD→INR
    const profitInr   = revenueInr - costInr;
    const budgetPct   = u.apiCostLimit > 0 ? Math.round((u.apiCostUsed / u.apiCostLimit) * 100) : 0;

    return {
      ...u,
      revenueInr,
      costInr,
      costUsd:   parseFloat(costUsd.toFixed(4)),
      profitInr,
      budgetPct,
      isExpired: u.plan !== 'free' && u.planExpiresAt && u.planExpiresAt < now,
    };
  });
}

// ── Admin: overall business summary ──────────────────────────────────────────
export async function getBusinessSummary() {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalUsers, paidUsers,
    revenueThisMonth, revenueLast,
    apiCostThisMonth, apiCostLast,
    planBreakdown, topModels,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: { not: 'free' } } }),

    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),  // ALL-TIME revenue
    prisma.payment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: lastMonth, lt: monthStart }, status: 'paid' } }),

    prisma.apiUsageLog.aggregate({ _sum: { costMicro: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.apiUsageLog.aggregate({ _sum: { costMicro: true }, where: { createdAt: { gte: lastMonth, lt: monthStart } } }),

    prisma.user.groupBy({ by: ['plan'], _count: { id: true } }),

    prisma.apiUsageLog.groupBy({
      by: ['model'],
      _sum: { costMicro: true },
      _count: { id: true },
      where: { createdAt: { gte: monthStart } },
      orderBy: { _sum: { costMicro: 'desc' } },
      take: 5,
    }),
  ]);

  const revINR  = revenueThisMonth._sum.amount || 0;
  const costMicro = apiCostThisMonth._sum.costMicro || 0;
  const costINR = Math.round((costMicro / 1_000_000) * 84);
  const profitINR = revINR - costINR;
  const margin  = revINR > 0 ? Math.round((profitINR / revINR) * 100) : 0;

  return {
    totalUsers,
    paidUsers,
    freeUsers: totalUsers - paidUsers,
    revenueInr:     revINR,
    lastRevenueInr: revenueLast._sum.amount || 0,
    costInr:        costINR,
    lastCostInr:    Math.round(((apiCostLast._sum.costMicro || 0) / 1_000_000) * 84),
    profitInr:      profitINR,
    marginPct:      margin,
    planBreakdown:  Object.fromEntries(planBreakdown.map(p => [p.plan, p._count.id])),
    topModels:      topModels.map(m => ({
      model:    m.model,
      calls:    m._count.id,
      costInr:  Math.round(((m._sum.costMicro || 0) / 1_000_000) * 84),
    })),
  };
}