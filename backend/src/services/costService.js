// backend/src/services/costService.js
// API cost tracking and budget management.
// Moved from costTracker.js — same logic, cleaner exports.

import prisma from '../lib/prisma.js';
import { PLAN_BUDGETS } from '../models/plan.js';

export { PLAN_BUDGETS };

// Token cost per million (input / output) in micro-dollars
const MODEL_COSTS = {
  'llama-3.3-70b-versatile':                 { input: 59,   output: 79,    provider: 'groq'       },
  'mixtral-8x7b-32768':                      { input: 24,   output: 24,    provider: 'groq'       },
  'gemini-2.0-flash':                        { input: 75,   output: 300,   provider: 'gemini'     },
  'gemini-1.5-flash':                        { input: 75,   output: 300,   provider: 'gemini'     },
  'gemini-1.5-pro':                          { input: 1250, output: 5000,  provider: 'gemini'     },
  'mistral-small-latest':                    { input: 100,  output: 300,   provider: 'mistral'    },
  'mistral-large-latest':                    { input: 2000, output: 6000,  provider: 'mistral'    },
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': { input: 880,  output: 880,   provider: 'together'   },
  'deepseek-ai/DeepSeek-V3':                 { input: 270,  output: 1100,  provider: 'together'   },
  'Qwen/Qwen2.5-72B-Instruct-Turbo':         { input: 800,  output: 800,   provider: 'together'   },
  'llama-3.1-sonar-small-128k-online':       { input: 200,  output: 200,   provider: 'perplexity' },
  'llama-3.1-sonar-large-128k-online':       { input: 1000, output: 1000,  provider: 'perplexity' },
  'claude-haiku-4-5-20251001':               { input: 800,  output: 4000,  provider: 'anthropic'  },
  'claude-haiku-4-6':                        { input: 800,  output: 4000,  provider: 'anthropic'  },
  'claude-sonnet-4-20250514':                { input: 3000, output: 15000, provider: 'anthropic'  },
  'claude-sonnet-4-6':                       { input: 3000, output: 15000, provider: 'anthropic'  },
  'claude-opus-4-6':                         { input: 15000,output: 75000, provider: 'anthropic'  },
  'gpt-4o-mini':                             { input: 150,  output: 600,   provider: 'openai'     },
  'gpt-4o':                                  { input: 2500, output: 10000, provider: 'openai'     },
  'o3':                                      { input: 10000,output: 40000, provider: 'openai'     },
  'o4-mini':                                 { input: 1100, output: 4400,  provider: 'openai'     },
  'o1-mini':                                 { input: 1100, output: 4400,  provider: 'openai'     },
};

function estimateTokens(text = '') {
  return Math.ceil(text.length / 4);
}

export function calculateCost(modelId, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[modelId];
  if (!costs) return 0;
  return Math.ceil((inputTokens / 1_000_000) * costs.input) +
         Math.ceil((outputTokens / 1_000_000) * costs.output);
}

export async function checkBudget(userId, userPlan) {
  if (userPlan === 'free') return { hasbudget: true, used: 0, limit: 0, pct: 0 };

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { apiCostUsed: true, apiCostLimit: true, apiCostReset: true },
  });
  if (!user) return { hasbudget: false, used: 0, limit: 0, pct: 100 };

  const daysSinceReset = (Date.now() - new Date(user.apiCostReset).getTime()) / 86400000;
  if (daysSinceReset >= 30) {
    await prisma.user.update({ where: { id: userId }, data: { apiCostUsed: 0, apiCostReset: new Date() } });
    return { hasbudget: true, used: 0, limit: user.apiCostLimit, pct: 0 };
  }

  const limit     = user.apiCostLimit || PLAN_BUDGETS[userPlan] || 0;
  const used      = user.apiCostUsed  || 0;
  const pct       = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return { hasbudget: used < limit, used, limit, pct };
}

export async function logApiUsage({ userId, modelId, inputText = '', outputText = '', inputTokens, outputTokens, fromCache = false }) {
  try {
    const iTokens   = inputTokens  ?? estimateTokens(inputText);
    const oTokens   = outputTokens ?? estimateTokens(outputText);
    const costMicro = fromCache ? 0 : calculateCost(modelId, iTokens, oTokens);
    const provider  = MODEL_COSTS[modelId]?.provider || 'unknown';

    await prisma.apiUsageLog.create({
      data: { userId, model: modelId, provider, inputTokens: iTokens, outputTokens: oTokens, costMicro, fromCache },
    });

    if (costMicro > 0) {
      await prisma.user.update({ where: { id: userId }, data: { apiCostUsed: { increment: costMicro } } });
    }

    return costMicro;
  } catch (err) {
    console.error('⚠️ logApiUsage error:', err.message);
    return 0;
  }
}

export async function activatePlanBudget(userId, plan) {
  const budget = PLAN_BUDGETS[plan] || 0;
  await prisma.user.update({
    where: { id: userId },
    data:  { apiCostLimit: budget, apiCostUsed: 0, apiCostReset: new Date() },
  });
  console.log(`💰 Budget activated: ${userId} → ${plan} → $${(budget / 1_000_000).toFixed(2)}/mo`);
}
